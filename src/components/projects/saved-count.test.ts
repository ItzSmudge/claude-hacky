import { describe, expect, it } from "vitest";
import { countSaved } from "./saved-count";

describe("countSaved", () => {
  it("counts each saved paper once, however many people saved it", () => {
    expect(countSaved([{ paper_id: "a" }, { paper_id: "a" }, { paper_id: "b" }])).toBe(2);
  });

  it("is 0 for no rows", () => {
    expect(countSaved([])).toBe(0);
    expect(countSaved(null)).toBe(0);
    expect(countSaved(undefined)).toBe(0);
  });
});
