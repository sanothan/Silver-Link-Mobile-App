// Run against a Firestore emulator on 127.0.0.1:8185 (demo-chat).
// Uses unique documents and cleans up only the documents it creates.
const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase/app');
const {
  addDoc,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
} = require('firebase/firestore');

const projectId = 'demo-chat';
const emulatorHost = '127.0.0.1';
const emulatorPort = 8187;
const documentsUrl = `http://${emulatorHost}:${emulatorPort}/v1/projects/${projectId}/databases/(default)/documents`;
const runId = `${Date.now()}-${process.pid}`;
const apps = [];
const cleanupPaths = new Set();

async function seed(path, data) {
  cleanupPaths.add(path);
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

function client(uid) {
  const app = initializeApp({ projectId, apiKey: 'demo' }, `chat-rules-${uid}-${runId}`);
  apps.push(app);
  const database = getFirestore(app);
  connectFirestoreEmulator(database, emulatorHost, emulatorPort, {
    mockUserToken: { sub: uid, user_id: uid },
  });
  return database;
}

async function cleanup() {
  await Promise.all(apps.map(deleteApp));
  await Promise.all([...cleanupPaths].map(async (path) => {
    const response = await fetch(`${documentsUrl}/${path}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer owner' },
    });
    if (response.status !== 200 && response.status !== 404) {
      throw new Error(`Could not clean up emulator test document ${path}: ${response.status}`);
    }
  }));
}

async function main() {
  const elderId = `elder-chat-test-${runId}`;
  const caregiverId = `caregiver-chat-test-${runId}`;
  const volunteerId = `volunteer-chat-test-${runId}`;
  const otherVolunteerId = `other-volunteer-chat-test-${runId}`;
  const requestId = `request-chat-test-${runId}`;
  const chatId = requestId;

  await Promise.all([
    seed(`users/${elderId}`, { uid: elderId, role: 'elderly', status: 'active', caregiverId }),
    seed(`users/${caregiverId}`, { uid: caregiverId, role: 'caregiver', status: 'active' }),
    seed(`users/${volunteerId}`, { uid: volunteerId, role: 'volunteer', status: 'active' }),
    seed(`users/${otherVolunteerId}`, { uid: otherVolunteerId, role: 'volunteer', status: 'active' }),
    // Deliberately omit caregiverId to represent an activity created before the caregiver link.
    seed(`requests/${requestId}`, { createdBy: elderId, assignedVolunteerId: volunteerId, status: 'scheduled' }),
  ]);

  const caregiverDb = client(caregiverId);
  const volunteerDb = client(volunteerId);
  const otherVolunteerDb = client(otherVolunteerId);
  const chatRef = doc(caregiverDb, 'requestChats', chatId);
  const caregiverMessages = collection(chatRef, 'messages');

  cleanupPaths.add(`requestChats/${chatId}`);
  await assert.rejects(getDoc(doc(otherVolunteerDb, 'requestChats', chatId)));
  const missingChatSnapshot = await getDoc(chatRef);
  assert.equal(missingChatSnapshot.exists(), false);
  await setDoc(chatRef, {
    requestId,
    elderlyUserId: elderId,
    caregiverId,
    volunteerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  const chatSnapshot = await getDoc(doc(volunteerDb, 'requestChats', chatId));
  assert.equal(chatSnapshot.exists(), true);

  const caregiverMessage = await addDoc(caregiverMessages, {
    senderId: caregiverId,
    senderRole: 'caregiver',
    text: 'I will meet you by the entrance.',
    readBy: [caregiverId],
    createdAt: serverTimestamp(),
  });
  cleanupPaths.add(`requestChats/${chatId}/messages/${caregiverMessage.id}`);
  await setDoc(doc(caregiverDb, 'notifications', `chat-notice-caregiver-${runId}`), {
    userId: volunteerId,
    audience: 'volunteer',
    type: 'chat_message',
    requestId,
    chatId,
    senderId: caregiverId,
    read: false,
    createdAt: serverTimestamp(),
  });
  cleanupPaths.add(`notifications/chat-notice-caregiver-${runId}`);

  const volunteerMessage = await addDoc(collection(doc(volunteerDb, 'requestChats', chatId), 'messages'), {
    senderId: volunteerId,
    senderRole: 'volunteer',
    text: 'Understood. See you then.',
    readBy: [volunteerId],
    createdAt: serverTimestamp(),
  });
  cleanupPaths.add(`requestChats/${chatId}/messages/${volunteerMessage.id}`);
  await setDoc(doc(volunteerDb, 'notifications', `chat-notice-volunteer-${runId}`), {
    userId: caregiverId,
    audience: 'caregiver',
    type: 'chat_message',
    requestId,
    chatId,
    senderId: volunteerId,
    read: false,
    createdAt: serverTimestamp(),
  });
  cleanupPaths.add(`notifications/chat-notice-volunteer-${runId}`);

  const messages = await getDocs(collection(doc(caregiverDb, 'requestChats', chatId), 'messages'));
  assert.equal(messages.size, 2);
  await assert.rejects(getDoc(doc(otherVolunteerDb, 'requestChats', chatId)));

  console.log('PASS: linked caregiver and assigned volunteer can read, exchange messages, and create reciprocal notifications for a request without caregiverId; unrelated volunteer is denied.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
