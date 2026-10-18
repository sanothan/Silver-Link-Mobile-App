// Run against the Firestore emulator on 127.0.0.1:8185 (demo-withdrawal).
// Uses unique documents and does not reset the emulator database.
const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase/app');
const {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} = require('firebase/firestore');

const projectId = 'demo-withdrawal';
const emulatorHost = '127.0.0.1';
const emulatorPort = 8185;
const documentsUrl = `http://${emulatorHost}:${emulatorPort}/v1/projects/${projectId}/databases/(default)/documents`;
const runId = `${Date.now()}-${process.pid}`;
const apps = [];
const testDocuments = [];

async function seed(path, data) {
  const fields = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, { stringValue: value }]),
  );
  const response = await fetch(`${documentsUrl}/${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer owner',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  assert.equal(response.status, 200, await response.text());
}

async function acceptRequest(label, initialCaregiverId) {
  const elderlyId = `elder-link-test-${runId}-${label}`;
  const caregiverId = `caregiver-link-test-${runId}-${label}`;
  const linkId = `caregiver-link-test-${runId}-${label}`;
  testDocuments.push(`users/${elderlyId}`, `caregiverLinks/${linkId}`);
  const userData = { uid: elderlyId, role: 'elderly', status: 'active' };
  if (initialCaregiverId !== undefined) userData.caregiverId = initialCaregiverId;

  await seed(`users/${elderlyId}`, userData);
  await seed(`caregiverLinks/${linkId}`, {
    caregiverId,
    elderlyUserId: elderlyId,
    status: 'pending',
    requestedBy: 'caregiver',
  });

  const app = initializeApp({ projectId, apiKey: 'demo' }, `caregiver-link-${label}-${runId}`);
  apps.push(app);
  const database = getFirestore(app);
  connectFirestoreEmulator(database, emulatorHost, emulatorPort, {
    mockUserToken: { sub: elderlyId, user_id: elderlyId },
  });

  await runTransaction(database, async (transaction) => {
    const linkRef = doc(database, 'caregiverLinks', linkId);
    const elderlyRef = doc(database, 'users', elderlyId);
    const [linkSnapshot, elderlySnapshot] = await Promise.all([
      transaction.get(linkRef),
      transaction.get(elderlyRef),
    ]);
    assert.equal(linkSnapshot.exists(), true);
    assert.equal(elderlySnapshot.exists(), true);
    transaction.update(linkRef, {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(elderlyRef, {
      caregiverId,
      caregiverLinkId: linkId,
      updatedAt: serverTimestamp(),
    });
  });

  const [acceptedLink, linkedElderly] = await Promise.all([
    getDoc(doc(database, 'caregiverLinks', linkId)),
    getDoc(doc(database, 'users', elderlyId)),
  ]);
  assert.equal(acceptedLink.data().status, 'accepted');
  assert.equal(linkedElderly.data().caregiverId, caregiverId);
  assert.equal(linkedElderly.data().caregiverLinkId, linkId);
}

async function main() {
  await acceptRequest('missing-caregiver-id', undefined);
  await acceptRequest('empty-caregiver-id', '');
  console.log('PASS: caregiver link acceptance works when caregiverId is missing or empty.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(apps.map(deleteApp));
    await Promise.all(testDocuments.map(async (path) => {
      const response = await fetch(`${documentsUrl}/${path}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer owner' },
      });
      if (response.status !== 200 && response.status !== 404) {
        throw new Error(`Could not clean up emulator test document ${path}: ${response.status}`);
      }
    }));
  });
