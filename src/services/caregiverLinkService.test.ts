import {
  acceptCaregiverLink,
  getCaregiverLinks,
  getCaregiverLinksForElderly,
  rejectCaregiverLink,
} from "./caregiverLinkService";
import {
  createCaregiverLinkDecisionNotification,
} from "./notificationService";
import { getUserProfile } from "./userService";

jest.mock("./firebaseConfig", () => ({ db: { id: "test-db" } }));
jest.mock("./notificationService", () => ({
  createCaregiverLinkDecisionNotification: jest.fn(async () => undefined),
  createCaregiverLinkRequestNotification: jest.fn(async () => undefined),
}));
jest.mock("./userService", () => ({ getUserProfile: jest.fn() }));

jest.mock("firebase/firestore", () => {
  const store = new Map<string, Record<string, unknown>>();
  let autoId = 0;
  const snapshot = (path: string) => ({
    id: path.split("/")[1],
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
  const query = (base: { name: string }, ...constraints: { field: string; operator: string; value: unknown }[]) => ({ ...base, constraints });
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
    runTransaction: async (_database: unknown, callback: (transaction: unknown) => Promise<unknown>) => callback({
      get: async (reference: { path: string }) => snapshot(reference.path),
      update: (reference: { path: string }, values: Record<string, unknown>) => write(reference.path, values),
    }),
  };
});

const firestore = jest.requireMock("firebase/firestore") as {
  __store: Map<string, Record<string, unknown>>;
  __reset: () => void;
};

function seedLink(id: string, overrides: Record<string, unknown> = {}) {
  firestore.__store.set(`caregiverLinks/${id}`, {
    caregiverId: "caregiver-1",
    elderlyUserId: "elderly-1",
    caregiverName: "Nimali Perera",
    status: "pending",
    requestedBy: "caregiver",
    createdAt: new Date("2026-09-08T08:00:00Z"),
    updatedAt: new Date("2026-09-08T08:00:00Z"),
    ...overrides,
  });
}

beforeEach(() => {
  firestore.__reset();
  jest.clearAllMocks();
  firestore.__store.set("users/elderly-1", {
    uid: "elderly-1",
    fullName: "Margaret Silva",
    role: "elderly",
    status: "active",
  });
  (getUserProfile as jest.Mock).mockResolvedValue({
    uid: "elderly-1",
    fullName: "Margaret Silva",
    email: "margaret@example.com",
    role: "elderly",
    status: "active",
  });
});

it("returns only caregiver links targeted to the current elderly user", async () => {
  seedLink("mine");
  seedLink("other", { elderlyUserId: "elderly-2" });
  expect((await getCaregiverLinksForElderly("elderly-1")).map((item) => item.id)).toEqual(["mine"]);
});

it("accepts a pending request, links the user, and notifies the caregiver", async () => {
  seedLink("link-1");
  await acceptCaregiverLink("link-1", "elderly-1");
  expect(firestore.__store.get("caregiverLinks/link-1")?.status).toBe("accepted");
  expect(firestore.__store.get("users/elderly-1")).toMatchObject({ caregiverId: "caregiver-1", caregiverLinkId: "link-1" });
  expect(createCaregiverLinkDecisionNotification).toHaveBeenCalledWith(expect.objectContaining({ linkId: "link-1", decision: "accepted" }));
});

it("rejects a pending request without linking the user", async () => {
  seedLink("link-1");
  await rejectCaregiverLink("link-1", "elderly-1");
  expect(firestore.__store.get("caregiverLinks/link-1")?.status).toBe("rejected");
  expect(firestore.__store.get("users/elderly-1")?.caregiverId).toBeUndefined();
  expect(createCaregiverLinkDecisionNotification).toHaveBeenCalledWith(expect.objectContaining({ decision: "rejected" }));
});

it("prevents a second decision and blocks the wrong elderly user", async () => {
  seedLink("link-1");
  await acceptCaregiverLink("link-1", "elderly-1");
  await expect(rejectCaregiverLink("link-1", "elderly-1")).rejects.toThrow("already been updated");
  seedLink("link-2");
  await expect(acceptCaregiverLink("link-2", "elderly-2")).rejects.toThrow();
});

it("shows accepted links as connected and hides rejected history on the caregiver side", async () => {
  seedLink("accepted", { status: "accepted" });
  seedLink("rejected", { status: "rejected" });
  const links = await getCaregiverLinks("caregiver-1");
  expect(links.map((item) => [item.id, item.status])).toEqual([["accepted", "accepted"]]);
});
