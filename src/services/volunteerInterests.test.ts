import { getVolunteerPreferences, saveVolunteerInterests } from './userService';

jest.mock('./firebaseConfig', () => ({ db: {}, auth: { currentUser: { uid: 'volunteer' } } }));
jest.mock('firebase/auth', () => ({ updateProfile: jest.fn() }));
jest.mock('firebase/firestore', () => {
  const documents = new Map<string, Record<string, unknown>>();
  return {
    __documents: documents,
    doc: (_db: unknown, collection: string, uid: string) => `${collection}/${uid}`,
    serverTimestamp: () => 'server-time',
    getDoc: jest.fn(async (path: string) => ({ exists: () => documents.has(path), data: () => documents.get(path), id: path.split('/')[1] })),
    setDoc: jest.fn(async (path: string, data: Record<string, unknown>, options: { merge: boolean }) => {
      documents.set(path, options.merge ? { ...documents.get(path), ...data } : data);
    }),
  };
});
const { __documents: documents, getDoc, setDoc } = jest.requireMock('firebase/firestore') as {
  __documents: Map<string, Record<string, unknown>>; getDoc: jest.Mock; setDoc: jest.Mock;
};
beforeEach(() => {
  documents.clear(); jest.clearAllMocks();
  documents.set('users/volunteer', { role: 'volunteer', status: 'active' });
});

it('loads no interests for a missing profile and persists canonical interests without replacing verification fields', async () => {
  expect(await getVolunteerPreferences('volunteer')).toEqual({ preferredActivityTypes: [] });
  documents.set('volunteerProfiles/volunteer', { verificationStatus: 'verified', bio: 'Existing biography' });
  await saveVolunteerInterests('volunteer', [' smartphone help ', 'Smartphone Help', 'Unknown']);
  expect(await getVolunteerPreferences('volunteer')).toEqual({ preferredActivityTypes: ['Smartphone Help'] });
  expect(documents.get('volunteerProfiles/volunteer')).toMatchObject({ verificationStatus: 'verified', bio: 'Existing biography' });
  await saveVolunteerInterests('volunteer', []);
  expect(await getVolunteerPreferences('volunteer')).toEqual({ preferredActivityTypes: [] });
});
it('rejects another identity and non-volunteer profiles without writing', async () => {
  await expect(saveVolunteerInterests('other', [])).rejects.toThrow();
  await expect(getVolunteerPreferences('other')).rejects.toThrow();
  documents.set('users/volunteer', { role: 'elderly', status: 'active' });
  await expect(saveVolunteerInterests('volunteer', [])).rejects.toThrow();
  expect(setDoc).not.toHaveBeenCalled();
});
it('propagates read failure so screens can distinguish an error from no interests', async () => {
  getDoc.mockRejectedValueOnce(new Error('unavailable'));
  await expect(getVolunteerPreferences('volunteer')).rejects.toThrow('unavailable');
});
