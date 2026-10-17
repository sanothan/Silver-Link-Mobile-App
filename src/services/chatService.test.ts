import {
  getRequestChat,
  sendRequestChatMessage,
} from "./chatService";
import { createChatMessageNotification } from "./notificationService";
import {
  getRequestById,
  getRequestForVolunteer,
} from "./requestService";

jest.mock("./firebaseConfig", () => ({ db: { id: "test-db" } }));
jest.mock("./caregiverLinkService", () => ({
  hasAcceptedCaregiverLink: jest.fn(async () => true),
}));
jest.mock("./notificationService", () => ({
  createChatMessageNotification: jest.fn(async () => undefined),
}));
jest.mock("./requestService", () => ({
  getRequestById: jest.fn(),
  getRequestForVolunteer: jest.fn(),
}));

jest.mock("firebase/firestore", () => {
  const store = new Map<string, Record<string, unknown>>();
  let messageId = 0;
  const collection = (parent: { path?: string } | unknown, name: string) => ({
    path: parent && typeof parent === "object" && "path" in parent
      ? `${String(parent.path)}/${name}`
      : name,
  });
  const doc = (_database: unknown, name: string, id: string) => ({
    id,
    path: `${name}/${id}`,
  });
  const snapshot = (path: string) => ({
    id: path.split("/").at(-1),
    exists: () => store.has(path),
    data: () => store.get(path),
  });

  return {
    __store: store,
    __reset: () => {
      store.clear();
      messageId = 0;
    },
    addDoc: async (reference: { path: string }, data: Record<string, unknown>) => {
      messageId += 1;
      const id = `message-${messageId}`;
      store.set(`${reference.path}/${id}`, data);
      return { id };
    },
    collection,
    doc,
    getDoc: async (reference: { path: string }) => snapshot(reference.path),
    onSnapshot: () => () => undefined,
    serverTimestamp: () => ({ toDate: () => new Date("2026-10-17T12:00:00Z") }),
    setDoc: async (
      reference: { path: string },
      data: Record<string, unknown>,
      options?: { merge?: boolean },
    ) => {
      store.set(
        reference.path,
        options?.merge ? { ...store.get(reference.path), ...data } : data,
      );
    },
  };
});

const firestore = jest.requireMock("firebase/firestore") as {
  __store: Map<string, Record<string, unknown>>;
  __reset: () => void;
};
const mockedGetRequestById = getRequestById as jest.Mock;
const mockedGetRequestForVolunteer = getRequestForVolunteer as jest.Mock;
const mockedCreateNotification = createChatMessageNotification as jest.Mock;

const request = {
  id: "request-1",
  createdBy: "elder-1",
  createdByName: "Elder One",
  caregiverId: undefined,
  activityType: "Walking Companionship",
  preferredDate: new Date("2026-10-20T10:00:00Z"),
  preferredTime: "10:00 AM",
  location: "Colombo",
  status: "scheduled" as const,
  assignedVolunteerId: "volunteer-1",
  volunteerName: "Volunteer One",
};

beforeEach(() => {
  firestore.__reset();
  jest.clearAllMocks();
  mockedGetRequestById.mockResolvedValue({ ...request });
  mockedGetRequestForVolunteer.mockResolvedValue({ ...request });
});

it("lets a linked caregiver start a chat for an older request without caregiverId", async () => {
  const result = await getRequestChat(
    "request-1",
    "caregiver-1",
    "caregiver",
    "elder-1",
  );

  expect(result.canSend).toBe(true);
  expect(result.chat).toMatchObject({
    requestId: "request-1",
    elderlyUserId: "elder-1",
    caregiverId: "caregiver-1",
    volunteerId: "volunteer-1",
  });
  expect(firestore.__store.get("requestChats/request-1")).toMatchObject({
    caregiverId: "caregiver-1",
  });
});

it("lets the assigned volunteer join the caregiver-created chat when the request has no caregiverId", async () => {
  firestore.__store.set("requestChats/request-1", {
    requestId: "request-1",
    elderlyUserId: "elder-1",
    caregiverId: "caregiver-1",
    volunteerId: "volunteer-1",
  });

  const result = await getRequestChat("request-1", "volunteer-1", "volunteer");

  expect(result.canSend).toBe(true);
  expect(result.chat?.caregiverId).toBe("caregiver-1");
});

it("routes messages both ways using the chat participant IDs when the request lacks caregiverId", async () => {
  await getRequestChat("request-1", "caregiver-1", "caregiver", "elder-1");

  await sendRequestChatMessage({
    requestId: "request-1",
    senderId: "caregiver-1",
    senderRole: "caregiver",
    elderlyUserId: "elder-1",
    text: "I will meet you by the entrance.",
  });
  await sendRequestChatMessage({
    requestId: "request-1",
    senderId: "volunteer-1",
    senderRole: "volunteer",
    text: "Understood. See you then.",
  });

  const messages = [...firestore.__store.entries()]
    .filter(([path]) => path.startsWith("requestChats/request-1/messages/"));
  expect(messages).toHaveLength(2);
  expect(messages.map(([, message]) => message.senderRole)).toEqual([
    "caregiver",
    "volunteer",
  ]);
  expect(mockedCreateNotification).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ recipientId: "volunteer-1", senderRole: "caregiver" }),
  );
  expect(mockedCreateNotification).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ recipientId: "caregiver-1", senderRole: "volunteer" }),
  );
});
