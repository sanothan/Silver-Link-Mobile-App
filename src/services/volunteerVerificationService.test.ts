import {
  VolunteerVerificationAuthError,
  approveVolunteerProfile,
  canVerifyVolunteers,
  getVolunteerVerificationHistory,
  listVolunteerVerifications,
  rejectVolunteerProfile,
  resolveVerificationStatus,
} from './volunteerVerificationService';
import { createVolunteerVerificationNotification } from './notificationService';
import type { UserProfile } from '../types/user';

jest.mock('./firebaseConfig', () => ({ db: { id: 'test-db' } }));
jest.mock('./notificationService', () => ({
  createVolunteerVerificationNotification: jest.fn(async () => undefined),
}));

jest.mock('firebase/firestore', () => {
  const store = new Map<string, Record<string, unknown>>();
  let autoId = 0;
  const snapshot = (path: string) => ({
    id: path.split('/')[1],
    exists: () => store.has(path),
    data: () => store.get(path),
  });
  const collection = (_database: unknown, name: string) => ({ name });
  const doc = (...args: unknown[]) => {
    if (args.length === 1) {
      autoId += 1;
      const name = (args[0] as { name: string }).name;
      return { id: `auto-${autoId}`, path: `${name}/auto-${autoId}` };
    }
    const [, name, id] = args as [unknown, string, string];
    return { id, path: `${name}/${id}` };
  };
  const where = (field: string, operator: string, value: unknown) => ({ field, operator, value });
  const query = (base: { name: string }, ...constraints: unknown[]) => ({ ...base, constraints });
  const write = (path: string, values: Record<string, unknown>) =>
    store.set(path, { ...store.get(path), ...values });

  return {
    __store: store,
    __reset: () => { store.clear(); autoId = 0; },
    collection,
    doc,
    where,
    query,
    serverTimestamp: () => ({ serverTimestamp: true }),
    getDoc: async (reference: { path: string }) => snapshot(reference.path),
    getDocs: async (request: { name: string; constraints?: { field: string; value: unknown }[] }) => {
      const docs = [...store.keys()]
        .filter((path) => path.startsWith(`${request.name}/`))
        .map(snapshot)
        .filter((item) => (request.constraints ?? []).every((constraint) => item.data()?.[constraint.field] === constraint.value));
      return { docs, empty: docs.length === 0, size: docs.length };
    },
    setDoc: async (reference: { path: string }, values: Record<string, unknown>) => write(reference.path, values),
    updateDoc: async (reference: { path: string }, values: Record<string, unknown>) => write(reference.path, values),
    // Mirrors a real batch: every write is staged and only applied once the
    // whole batch is known to succeed, so a failing update leaves nothing behind.
    writeBatch: () => {
      const staged: { path: string; values: Record<string, unknown>; requireExisting: boolean }[] = [];
      const batch = {
        set: (reference: { path: string }, values: Record<string, unknown>) => {
          staged.push({ path: reference.path, values, requireExisting: false });
          return batch;
        },
        update: (reference: { path: string }, values: Record<string, unknown>) => {
          staged.push({ path: reference.path, values, requireExisting: true });
          return batch;
        },
        commit: async () => {
          const missing = staged.find((operation) => operation.requireExisting && !store.has(operation.path));
          if (missing) throw new Error(`No document to update: ${missing.path}`);
          staged.forEach((operation) => write(operation.path, operation.values));
        },
      };
      return batch;
    },
  };
});

const firestoreMock = jest.requireMock('firebase/firestore') as {
  __store: Map<string, Record<string, unknown>>;
  __reset: () => void;
};

const admin: UserProfile = { uid: 'admin-1', fullName: 'Ada Admin', email: 'admin@example.com', role: 'admin', status: 'active' };
const elderly: UserProfile = { uid: 'elder-1', fullName: 'Edward Elder', email: 'edward@example.com', role: 'elderly', status: 'active' };
const volunteerUser: UserProfile = { uid: 'vol-1', fullName: 'Vera Volunteer', email: 'vera@example.com', role: 'volunteer', status: 'active' };

function seedVolunteer(uid: string, overrides: Record<string, unknown> = {}) {
  firestoreMock.__store.set(`users/${uid}`, {
    uid,
    fullName: 'Vera Volunteer',
    email: 'vera@example.com',
    role: 'volunteer',
    status: 'pending',
    createdAt: new Date('2026-01-05T10:00:00Z'),
    ...overrides,
  });
}

beforeEach(() => {
  firestoreMock.__reset();
  jest.clearAllMocks();
});

describe('authorization', () => {
  it('lets an active admin verify volunteers', () => {
    expect(canVerifyVolunteers(admin)).toBe(true);
  });

  it('refuses normal users, including the volunteer themselves', () => {
    expect(canVerifyVolunteers(elderly)).toBe(false);
    expect(canVerifyVolunteers(volunteerUser)).toBe(false);
    expect(canVerifyVolunteers(null)).toBe(false);
  });

  it('refuses an admin whose own account is suspended', () => {
    expect(canVerifyVolunteers({ ...admin, status: 'suspended' })).toBe(false);
  });

  it('rejects a non-admin approval attempt without writing anything', async () => {
    seedVolunteer('vol-1');
    await expect(approveVolunteerProfile(elderly, 'vol-1', 'Vera Volunteer')).rejects.toBeInstanceOf(VolunteerVerificationAuthError);
    expect(firestoreMock.__store.get('users/vol-1')?.status).toBe('pending');
    expect(firestoreMock.__store.has('volunteerProfiles/vol-1')).toBe(false);
    expect(createVolunteerVerificationNotification).not.toHaveBeenCalled();
  });

  it('refuses a non-admin listing the verification queue', async () => {
    await expect(listVolunteerVerifications(volunteerUser)).rejects.toBeInstanceOf(VolunteerVerificationAuthError);
  });
});

describe('resolveVerificationStatus', () => {
  it('prefers the stored verification status', () => {
    expect(resolveVerificationStatus('verified', 'pending')).toBe('verified');
    expect(resolveVerificationStatus('REJECTED', 'active')).toBe('rejected');
  });

  it('falls back to the account status for profiles saved before the field existed', () => {
    expect(resolveVerificationStatus(undefined, 'pending')).toBe('pending');
    expect(resolveVerificationStatus(undefined, 'active')).toBe('verified');
    expect(resolveVerificationStatus('', 'suspended')).toBe('rejected');
  });
});

describe('listVolunteerVerifications', () => {
  it('returns volunteers with their verification status, newest application first', async () => {
    seedVolunteer('vol-1', { createdAt: new Date('2026-01-05T10:00:00Z') });
    seedVolunteer('vol-2', { fullName: 'Victor Volunteer', status: 'active', createdAt: new Date('2026-02-05T10:00:00Z') });
    firestoreMock.__store.set('volunteerProfiles/vol-2', { verificationStatus: 'verified', verificationDecidedByName: 'Ada Admin' });
    firestoreMock.__store.set('users/elder-1', { role: 'elderly', status: 'active', fullName: 'Edward Elder' });

    const rows = await listVolunteerVerifications(admin);

    expect(rows.map((row) => row.uid)).toEqual(['vol-2', 'vol-1']);
    expect(rows[0].verificationStatus).toBe('verified');
    expect(rows[0].decidedByName).toBe('Ada Admin');
    expect(rows[1].verificationStatus).toBe('pending');
  });
});

describe('approve / reject', () => {
  it('stores an approval, activates the account, records the audit entry and notifies the volunteer', async () => {
    seedVolunteer('vol-1');

    await approveVolunteerProfile(admin, 'vol-1', 'Vera Volunteer', '  Documents checked  ');

    expect(firestoreMock.__store.get('volunteerProfiles/vol-1')).toMatchObject({
      verificationStatus: 'verified',
      verificationDecidedBy: 'admin-1',
      verificationDecidedByName: 'Ada Admin',
      verificationNote: 'Documents checked',
    });
    expect(firestoreMock.__store.get('users/vol-1')?.status).toBe('active');

    const audit = [...firestoreMock.__store.entries()].find(([path]) => path.startsWith('volunteerVerifications/'));
    expect(audit?.[1]).toMatchObject({ volunteerId: 'vol-1', decision: 'approved', adminId: 'admin-1', adminName: 'Ada Admin', note: 'Documents checked' });

    expect(createVolunteerVerificationNotification).toHaveBeenCalledWith({
      volunteerId: 'vol-1',
      volunteerName: 'Vera Volunteer',
      decision: 'approved',
      note: 'Documents checked',
    });
  });

  it('stores a rejection, suspends the account and notifies the volunteer', async () => {
    seedVolunteer('vol-1');

    await rejectVolunteerProfile(admin, 'vol-1', 'Vera Volunteer', 'References incomplete');

    expect(firestoreMock.__store.get('volunteerProfiles/vol-1')).toMatchObject({ verificationStatus: 'rejected', verificationNote: 'References incomplete' });
    expect(firestoreMock.__store.get('users/vol-1')?.status).toBe('suspended');
    expect(createVolunteerVerificationNotification).toHaveBeenCalledWith(expect.objectContaining({ decision: 'rejected', note: 'References incomplete' }));
  });

  it('treats a blank note as no note', async () => {
    seedVolunteer('vol-1');
    await approveVolunteerProfile(admin, 'vol-1', 'Vera Volunteer', '   ');
    expect(firestoreMock.__store.get('volunteerProfiles/vol-1')?.verificationNote).toBeNull();
    expect(createVolunteerVerificationNotification).toHaveBeenCalledWith(expect.objectContaining({ note: undefined }));
  });

  it('leaves the account untouched and does not notify when the batch fails', async () => {
    await expect(approveVolunteerProfile(admin, 'missing-volunteer', 'Nobody')).rejects.toThrow();
    expect(firestoreMock.__store.has('volunteerProfiles/missing-volunteer')).toBe(false);
    expect(createVolunteerVerificationNotification).not.toHaveBeenCalled();
  });
});

describe('getVolunteerVerificationHistory', () => {
  it('returns the volunteer decisions, most recent first', async () => {
    firestoreMock.__store.set('volunteerVerifications/a', { volunteerId: 'vol-1', volunteerName: 'Vera Volunteer', decision: 'rejected', adminId: 'admin-1', adminName: 'Ada Admin', decidedAt: new Date('2026-01-10T10:00:00Z') });
    firestoreMock.__store.set('volunteerVerifications/b', { volunteerId: 'vol-1', volunteerName: 'Vera Volunteer', decision: 'approved', adminId: 'admin-1', adminName: 'Ada Admin', decidedAt: new Date('2026-03-10T10:00:00Z') });
    firestoreMock.__store.set('volunteerVerifications/c', { volunteerId: 'vol-2', volunteerName: 'Victor Volunteer', decision: 'approved', adminId: 'admin-1', adminName: 'Ada Admin', decidedAt: new Date('2026-02-10T10:00:00Z') });

    const history = await getVolunteerVerificationHistory(admin, 'vol-1');

    expect(history.map((record) => record.id)).toEqual(['b', 'a']);
    expect(history[0].decision).toBe('approved');
  });

  it('refuses a non-admin caller', async () => {
    await expect(getVolunteerVerificationHistory(elderly, 'vol-1')).rejects.toBeInstanceOf(VolunteerVerificationAuthError);
  });
});
