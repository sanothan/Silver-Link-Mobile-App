/// <reference types="jest" />
import {
  REQUEST_LIFECYCLE_STAGES,
  requestLifecycleProgress,
} from "./request";

it("tracks the canonical elderly request lifecycle in order", () => {
  expect(REQUEST_LIFECYCLE_STAGES.map((stage) => stage.key)).toEqual([
    "pending",
    "accepted",
    "scheduled",
    "in_progress",
    "completed",
  ]);
  expect(requestLifecycleProgress("accepted")).toBe(1);
  expect(requestLifecycleProgress("in_progress")).toBe(3);
  expect(requestLifecycleProgress("cancelled")).toBe(-1);
});
