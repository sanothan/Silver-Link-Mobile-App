// Run against a local Firestore emulator on port 8185, project demo-withdrawal.
const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase/app');
const { getFirestore, connectFirestoreEmulator, doc, getDoc, writeBatch, serverTimestamp } = require('firebase/firestore');
const projectId = 'demo-withdrawal';
const root = `http://127.0.0.1:8185/v1/projects/${projectId}/databases/(default)/documents`;
const apps = [];
function client(uid) {
  const app = initializeApp({ projectId, apiKey: 'demo' }, uid);
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8185, { mockUserToken: { sub: uid, user_id: uid } });
  return db;
}
async function seed(path, data) {
  const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key,
    value === null ? { nullValue: null } : { stringValue: value }]));
  const response = await fetch(`${root}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  assert.equal(response.status, 200, await response.text());
}
async function setup(id, status = 'accepted') {
  await seed(`requests/${id}`, { createdBy: 'elder', caregiverId: 'carer', status, assignedVolunteerId: 'vol-a' });
  await seed(`requestAssignments/${id}`, { requestId: id, volunteerId: 'vol-a', status });
}
function withdrawal(db, id, overrides = {}, assignment = true) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'requests', id), {
    status: 'pending', assignedVolunteerId: null, volunteerName: null, volunteerVerified: false,
    volunteerPhotoUrl: null, volunteerBio: null, volunteerExperience: null, volunteerRating: null,
    acceptedAt: null, elderConfirmedAt: null, rescheduledAt: null,
    withdrawnAt: serverTimestamp(), withdrawnBy: 'vol-a', updatedAt: serverTimestamp(), ...overrides,
  });
  if (assignment) {
    batch.update(doc(db, 'requestAssignments', id), { status: 'withdrawn', withdrawnAt: serverTimestamp(), updatedAt: serverTimestamp() });
    batch.set(doc(db, 'requestAssignmentHistory', id), { requestId: id, volunteerId: 'vol-a', status: 'withdrawn', withdrawnAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  for (const [userId, audience] of [['elder', 'elderly'], ['carer', 'caregiver']]) {
    batch.set(doc(db, 'notifications', `${id}_${userId}`), { userId, audience, requestId: id, type: 'volunteer_withdrawn', volunteerId: 'vol-a', read: false, createdAt: serverTimestamp() });
  }
  return batch.commit();
}
async function main() {
  // Clear only the fixed, local demo database so this check can be rerun.
  const reset = await fetch(`http://127.0.0.1:8185/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
  assert.equal(reset.status, 200);
  for (const [uid, role] of [['vol-a', 'volunteer'], ['vol-b', 'volunteer'], ['elder', 'elderly'], ['carer', 'caregiver']])
    await seed(`users/${uid}`, { role, status: 'active', ...(uid === 'elder' ? { caregiverId: 'carer' } : {}) });
  const a = client('vol-a'), b = client('vol-b'), elder = client('elder');
  for (const status of ['accepted', 'scheduled']) {
    await setup(status, status);
    await withdrawal(a, status);
    assert.equal((await getDoc(doc(a, 'requests', status))).data().status, 'pending');
    assert.equal((await getDoc(doc(b, 'requestAssignments', status))).data().status, 'withdrawn');
    await assert.rejects(withdrawal(a, status));
    const batch = writeBatch(b);
    batch.update(doc(b, 'requests', status), { status: 'accepted', assignedVolunteerId: 'vol-b', acceptedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    batch.set(doc(b, 'requestAssignments', status), { requestId: status, volunteerId: 'vol-b', status: 'accepted', createdAt: serverTimestamp() });
    await batch.commit();
  }
  for (const status of ['in_progress', 'completed', 'cancelled']) {
    await setup(status, status);
    await assert.rejects(withdrawal(a, status));
  }
  await setup('restricted');
  await assert.rejects(withdrawal(b, 'restricted'));
  await assert.rejects(withdrawal(elder, 'restricted'));
  await assert.rejects(withdrawal(a, 'restricted', { createdBy: 'vol-a' }));
  await assert.rejects(withdrawal(a, 'restricted', {}, false));
  assert.equal((await getDoc(doc(a, 'requests', 'restricted'))).data().status, 'accepted');
  console.log('PASS: accepted/scheduled withdrawal, notifications, history, reassignment, duplicate/status/role/owner checks and atomic assignment enforcement.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await Promise.all(apps.map(deleteApp)); });
