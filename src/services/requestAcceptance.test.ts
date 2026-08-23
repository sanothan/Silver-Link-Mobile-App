import { acceptRequest, cancelRequest, confirmAssignedVolunteer, getOpenRequests, getRequestForVolunteer, getVolunteerRequests, RequestAcceptanceError } from './requestService';
import { createAcceptanceNotifications } from './notificationService';
import { getUserProfile } from './userService';
import type { UserProfile } from '../types/user';

jest.mock('./firebaseConfig', () => ({ db: { id: 'test-db' } }));
jest.mock('./notificationService', () => ({ createAcceptanceNotifications: jest.fn(async () => undefined) }));
jest.mock('./userService', () => ({ getUserProfile: jest.fn() }));

/**
 * Minimal in-memory Firestore. Documents carry a version so `runTransaction`
 * can reproduce the real optimistic-concurrency behaviour: if a document read
 * during the transaction changed before the commit, the commit is thrown away
 * and the callback re-runs against fresh data.
 *
 * `__hooks.afterRead` lets a test commit a *second* volunteer's acceptance at a
 * chosen point inside the first volunteer's transaction, which is what makes
 * the race deterministic instead of timing-dependent.
 */
jest.mock('firebase/firestore', () => {
  const store = new Map<string, { data: Record<string, unknown>; version: number }>();
  const hooks: { afterRead?: ((path: string) => Promise<void> | void) | undefined } = {};
  let autoId = 0;

  const snapshotOf = (path: string) => {
    const entry = store.get(path);
    return { id: path.slice(path.indexOf('/') + 1), exists: () => Boolean(entry), data: () => entry?.data };
  };
  const write = (path: string, data: Record<string, unknown>, merge: boolean) => {
    const existing = store.get(path);
    store.set(path, { data: merge ? { ...existing?.data, ...data } : { ...data }, version: (existing?.version ?? 0) + 1 });
  };

  const doc = (_db: unknown, col: string, id: string) => ({ path: `${col}/${id}`, id, col });
  const collection = (_db: unknown, col: string) => ({ col });
  const where = (field: string, op: string, value: unknown) => ({ kind: 'where' as const, field, op, value });
  const limit = (count: number) => ({ kind: 'limit' as const, count });
  const query = (base: { col: string }, ...constraints: unknown[]) => ({ col: base.col, constraints });

  return {
    __store: store,
    __hooks: hooks,
    __reset: () => { store.clear(); hooks.afterRead = undefined; autoId = 0; },
    doc, collection, where, limit, query,
    serverTimestamp: () => ({ __serverTimestamp: true }),
    Timestamp: { fromDate: (date: Date) => ({ toDate: () => date }) },
    getDoc: async (ref: { path: string }) => snapshotOf(ref.path),
    getDocs: async (q: { col: string; constraints?: { kind: string; field?: string; op?: string; value?: unknown; count?: number }[] }) => {
      let docs = [...store.keys()].filter((path) => path.startsWith(`${q.col}/`)).map(snapshotOf);
      for (const constraint of q.constraints ?? []) {
        if (constraint.kind === 'where') docs = docs.filter((entry) => {
          const value = entry.data()?.[constraint.field as string];
          return constraint.op === 'in' ? (constraint.value as unknown[]).includes(value) : value === constraint.value;
        });
        if (constraint.kind === 'limit') docs = docs.slice(0, constraint.count);
      }
      return { docs };
    },
    addDoc: async (ref: { col: string }, data: Record<string, unknown>) => {
      autoId += 1; const id = `auto-${autoId}`; write(`${ref.col}/${id}`, data, false); return { id };
    },
    updateDoc: async (ref: { path: string }, data: Record<string, unknown>) => write(ref.path, data, true),
    runTransaction: async (_db: unknown, callback: (transaction: unknown) => Promise<unknown>) => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const reads = new Map<string, number>();
        const writes: { path: string; data: Record<string, unknown>; merge: boolean }[] = [];
        const transaction = {
          get: async (ref: { path: string }) => {
            const snapshot = snapshotOf(ref.path);
            reads.set(ref.path, store.get(ref.path)?.version ?? 0);
            if (hooks.afterRead) await hooks.afterRead(ref.path);
            return snapshot;
          },
          update: (ref: { path: string }, data: Record<string, unknown>) => { writes.push({ path: ref.path, data, merge: true }); },
          set: (ref: { path: string }, data: Record<string, unknown>) => { writes.push({ path: ref.path, data, merge: false }); },
        };
        const result = await callback(transaction);
        // Anything we read that has since moved means another writer won; the
        // real SDK discards this attempt and runs the callback again.
        if ([...reads].some(([path, version]) => (store.get(path)?.version ?? 0) !== version)) continue;
        for (const entry of writes) write(entry.path, entry.data, entry.merge);
        return result;
      }
      throw new Error('Transaction failed: too much contention.');
    },
  };
});

const firestore = jest.requireMock('firebase/firestore') as {
  __store: Map<string, { data: Record<string, unknown>; version: number }>;
  __hooks: { afterRead?: (path: string) => Promise<void> | void };
  __reset: () => void;
};

const PROFILES: Record<string, UserProfile> = {
  'vol-a': { uid: 'vol-a', fullName: 'Nadia Fernando', email: 'nadia@example.com', role: 'volunteer', status: 'active' },
  'vol-b': { uid: 'vol-b', fullName: 'Ravi Silva', email: 'ravi@example.com', role: 'volunteer', status: 'active' },
  'vol-suspended': { uid: 'vol-suspended', fullName: 'Blocked Volunteer', email: 'b@example.com', role: 'volunteer', status: 'suspended' },
  'elderly-1': { uid: 'elderly-1', fullName: 'Margaret Perera', email: 'm@example.com', role: 'elderly', status: 'active', caregiverId: 'caregiver-1' },
  'caregiver-1': { uid: 'caregiver-1', fullName: 'Anil Perera', email: 'a@example.com', role: 'caregiver', status: 'active' },
};

function seedRequest(id: string, overrides: Record<string, unknown> = {}) {
  firestore.__store.set(`requests/${id}`, {
    version: 1,
    data: { createdBy: 'elderly-1', createdByName: 'Margaret Perera', caregiverId: 'caregiver-1', activityType: 'Grocery Collection', description: 'Weekly shopping', preferredDate: { toDate: () => new Date(2026, 8, 3) }, preferredTime: '10:00 AM', durationMinutes: 60, location: 'Colombo 5', status: 'pending', ...overrides },
  });
}

const requestData = (id: string) => firestore.__store.get(`requests/${id}`)?.data;
const assignmentData = (id: string) => firestore.__store.get(`requestAssignments/${id}`)?.data;
const capture = (promise: Promise<unknown>) => promise.then(() => 'accepted' as const).catch((error: unknown) => error);

beforeEach(() => {
  firestore.__reset();
  jest.clearAllMocks();
  (getUserProfile as jest.Mock).mockImplementation(async (uid: string) => {
    const profile = PROFILES[uid];
    if (!profile) throw new Error('No user profile exists for this account.');
    return profile;
  });
  (createAcceptanceNotifications as jest.Mock).mockResolvedValue(undefined);
});

describe('acceptRequest — happy path', () => {
  it('1. accepts an available request', async () => {
    seedRequest('r1');
    await expect(acceptRequest('r1', 'vol-a')).resolves.toMatchObject({ id: 'r1', activityType: 'Grocery Collection' });
  });

  it('6. moves the request status from pending to accepted', async () => {
    seedRequest('r1');
    await acceptRequest('r1', 'vol-a');
    expect(requestData('r1')?.status).toBe('accepted');
  });

  it('7. links the accepting volunteer to the request', async () => {
    seedRequest('r1');
    await acceptRequest('r1', 'vol-a');
    expect(requestData('r1')).toMatchObject({ assignedVolunteerId: 'vol-a', volunteerName: 'Nadia Fernando', volunteerVerified: true });
    expect(assignmentData('r1')).toMatchObject({ requestId: 'r1', volunteerId: 'vol-a', status: 'accepted', activityType: 'Grocery Collection', generalLocation: 'Colombo 5' });
  });

  it('marks an unverified (still pending) volunteer as unverified on the request', async () => {
    seedRequest('r1');
    (getUserProfile as jest.Mock).mockResolvedValue({ ...PROFILES['vol-a'], status: 'pending' });
    await acceptRequest('r1', 'vol-a');
    expect(requestData('r1')?.volunteerVerified).toBe(false);
  });

  it('writes exactly one assignment document, keyed by the request id', async () => {
    seedRequest('r1');
    await acceptRequest('r1', 'vol-a');
    expect([...firestore.__store.keys()].filter((path) => path.startsWith('requestAssignments/'))).toEqual(['requestAssignments/r1']);
  });
});

describe('acceptRequest — rejections', () => {
  it('2 & 5. rejects a second volunteer once the request is accepted', async () => {
    seedRequest('r1');
    await acceptRequest('r1', 'vol-a');
    const error = await capture(acceptRequest('r1', 'vol-b'));
    expect(error).toBeInstanceOf(RequestAcceptanceError);
    expect((error as RequestAcceptanceError).reason).toBe('already-accepted');
    expect((error as Error).message).toBe('This request has already been accepted by another volunteer.');
    expect(requestData('r1')?.assignedVolunteerId).toBe('vol-a');
    expect(assignmentData('r1')?.volunteerId).toBe('vol-a');
  });

  it('3. rejects a non-volunteer (elderly) user', async () => {
    seedRequest('r1');
    const error = await capture(acceptRequest('r1', 'elderly-1'));
    expect((error as RequestAcceptanceError).reason).toBe('not-a-volunteer');
    expect(requestData('r1')?.status).toBe('pending');
  });

  it('3b. rejects a caregiver and a suspended volunteer', async () => {
    seedRequest('r1');
    expect(((await capture(acceptRequest('r1', 'caregiver-1'))) as RequestAcceptanceError).reason).toBe('not-a-volunteer');
    expect(((await capture(acceptRequest('r1', 'vol-suspended'))) as RequestAcceptanceError).reason).toBe('not-a-volunteer');
    expect(requestData('r1')?.status).toBe('pending');
  });

  it('4. rejects a request id that does not exist', async () => {
    const error = await capture(acceptRequest('missing', 'vol-a'));
    expect((error as RequestAcceptanceError).reason).toBe('not-found');
  });

  it('rejects a cancelled request as unavailable', async () => {
    seedRequest('r1', { status: 'cancelled' });
    expect(((await capture(acceptRequest('r1', 'vol-a'))) as RequestAcceptanceError).reason).toBe('unavailable');
  });

  it('rejects a volunteer accepting a request they created themselves', async () => {
    seedRequest('r1', { createdBy: 'vol-a' });
    expect(((await capture(acceptRequest('r1', 'vol-a'))) as RequestAcceptanceError).reason).toBe('own-request');
  });

  it('does not notify anyone when the acceptance is rejected', async () => {
    seedRequest('r1');
    await acceptRequest('r1', 'vol-a');
    (createAcceptanceNotifications as jest.Mock).mockClear();
    await capture(acceptRequest('r1', 'vol-b'));
    expect(createAcceptanceNotifications).not.toHaveBeenCalled();
  });
});

describe('acceptRequest — concurrent volunteers (duplicate prevention)', () => {
  it('lets only one win when the second commits before the first reads the assignment', async () => {
    seedRequest('r1');
    let second: unknown;
    firestore.__hooks.afterRead = async (path) => {
      if (path !== 'requests/r1') return;
      firestore.__hooks.afterRead = undefined;
      second = await capture(acceptRequest('r1', 'vol-b'));
    };
    const first = await capture(acceptRequest('r1', 'vol-a'));

    expect(second).toBe('accepted');
    expect(first).toBeInstanceOf(RequestAcceptanceError);
    expect((first as RequestAcceptanceError).reason).toBe('already-accepted');
    expect(requestData('r1')?.assignedVolunteerId).toBe('vol-b');
    expect(assignmentData('r1')?.volunteerId).toBe('vol-b');
  });

  it('lets only one win when the second commits after the first has read everything', async () => {
    seedRequest('r1');
    let second: unknown;
    // Volunteer A has already seen the request as pending and the assignment as
    // absent. B commits in that window, so A's commit is stale and re-runs.
    firestore.__hooks.afterRead = async (path) => {
      if (path !== 'requestAssignments/r1') return;
      firestore.__hooks.afterRead = undefined;
      second = await capture(acceptRequest('r1', 'vol-b'));
    };
    const first = await capture(acceptRequest('r1', 'vol-a'));

    expect(second).toBe('accepted');
    expect((first as RequestAcceptanceError).reason).toBe('already-accepted');
    expect(requestData('r1')?.assignedVolunteerId).toBe('vol-b');
    expect([...firestore.__store.keys()].filter((path) => path.startsWith('requestAssignments/'))).toHaveLength(1);
  });
});

describe('acceptRequest — notification (AC7)', () => {
  it('8. notifies with the request and volunteer details', async () => {
    seedRequest('r1');
    await acceptRequest('r1', 'vol-a');
    expect(createAcceptanceNotifications).toHaveBeenCalledTimes(1);
    expect((createAcceptanceNotifications as jest.Mock).mock.calls[0][0]).toMatchObject({
      elderlyId: 'elderly-1', elderlyName: 'Margaret Perera', caregiverId: 'caregiver-1',
      requestId: 'r1', activityType: 'Grocery Collection', preferredTime: '10:00 AM',
      volunteerId: 'vol-a', volunteerName: 'Nadia Fernando', volunteerVerified: true,
    });
  });

  it('keeps the acceptance when the notification write fails', async () => {
    seedRequest('r1');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (createAcceptanceNotifications as jest.Mock).mockRejectedValue(new Error('offline'));
    await expect(acceptRequest('r1', 'vol-a')).resolves.toBeDefined();
    expect(requestData('r1')?.assignedVolunteerId).toBe('vol-a');
    warn.mockRestore();
  });
});

describe('cancelRequest — keeps the assignment record in step', () => {
  it('marks the assignment cancelled once an accepted request is cancelled', async () => {
    seedRequest('r1');
    await acceptRequest('r1', 'vol-a');
    await cancelRequest('r1', 'elderly-1');
    expect(requestData('r1')?.status).toBe('cancelled');
    expect(assignmentData('r1')?.status).toBe('cancelled');
  });

  it('does not touch requestAssignments when the request was never accepted', async () => {
    seedRequest('r1');
    await cancelRequest('r1', 'elderly-1');
    expect(firestore.__store.has('requestAssignments/r1')).toBe(false);
  });
});

describe('confirmAssignedVolunteer — elderly approval', () => {
  it('moves an accepted request and assignment to scheduled', async () => {
    seedRequest('r1');
    await acceptRequest('r1', 'vol-a');
    await confirmAssignedVolunteer('r1', 'elderly-1');
    expect(requestData('r1')?.status).toBe('scheduled');
    expect(assignmentData('r1')?.status).toBe('scheduled');
  });

  it('rejects confirmation by someone other than the request owner', async () => {
    seedRequest('r1');
    await acceptRequest('r1', 'vol-a');
    await expect(confirmAssignedVolunteer('r1', 'caregiver-1')).rejects.toThrow('You cannot access this request.');
  });

  it('rejects confirmation before a volunteer accepts', async () => {
    seedRequest('r1');
    await expect(confirmAssignedVolunteer('r1', 'elderly-1')).rejects.toThrow('This volunteer can no longer be confirmed.');
  });
});

describe('getRequestForVolunteer — request-details screen', () => {
  it('returns the request once it is assigned to that volunteer', async () => {
    seedRequest('r1');
    await acceptRequest('r1', 'vol-a');
    await expect(getRequestForVolunteer('r1', 'vol-a')).resolves.toMatchObject({ id: 'r1', assignedVolunteerId: 'vol-a', createdByName: 'Margaret Perera' });
  });

  it('rejects a volunteer who was not assigned this request', async () => {
    seedRequest('r1');
    await acceptRequest('r1', 'vol-a');
    await expect(getRequestForVolunteer('r1', 'vol-b')).rejects.toThrow('This request is not assigned to you.');
  });

  it('rejects a request that has not been accepted by anyone yet', async () => {
    seedRequest('r1');
    await expect(getRequestForVolunteer('r1', 'vol-a')).rejects.toThrow('This request is not assigned to you.');
  });

  it('rejects a non-existent request id', async () => {
    await expect(getRequestForVolunteer('missing', 'vol-a')).rejects.toThrow('Request not found.');
  });
});

describe('after acceptance (AC8 / reload)', () => {
  it('9. shows the request in the volunteer activities list', async () => {
    seedRequest('r1'); seedRequest('r2');
    await acceptRequest('r1', 'vol-a');
    const mine = await getVolunteerRequests('vol-a');
    expect(mine.map((item) => item.id)).toEqual(['r1']);
    expect(mine[0]).toMatchObject({ status: 'accepted', volunteerName: 'Nadia Fernando' });
    expect(await getVolunteerRequests('vol-b')).toEqual([]);
  });

  it('10. keeps the accepted state on reload and drops it from the open list', async () => {
    seedRequest('r1'); seedRequest('r2');
    await acceptRequest('r1', 'vol-a');
    expect((await getOpenRequests()).map((item) => item.id)).toEqual(['r2']);
    expect((await getVolunteerRequests('vol-a'))[0].assignedVolunteerId).toBe('vol-a');
  });
});
