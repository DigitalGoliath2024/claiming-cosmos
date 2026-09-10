import { viewUpdatesToApplyThisFrame } from "../../src/client/viewUpdatePump";

describe("viewUpdatesToApplyThisFrame", () => {
  test("applies one tick per frame when the queue is small", () => {
    expect(viewUpdatesToApplyThisFrame(1, false)).toBe(1);
    expect(viewUpdatesToApplyThisFrame(6, false)).toBe(1);
  });

  test("applies extra ticks only when the view is behind", () => {
    expect(viewUpdatesToApplyThisFrame(7, false)).toBe(2);
    expect(viewUpdatesToApplyThisFrame(13, false)).toBe(3);
  });

  test("drains the whole queue while the tab is hidden", () => {
    expect(viewUpdatesToApplyThisFrame(20, true)).toBe(20);
  });

  test("applies nothing when empty", () => {
    expect(viewUpdatesToApplyThisFrame(0, false)).toBe(0);
  });
});
