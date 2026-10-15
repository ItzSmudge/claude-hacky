import { describe, expect, it } from "vitest";
import { idsToAnalyse } from "./queue-state";

const ids = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id }));
const none = new Set<string>();

describe("idsToAnalyse", () => {
  it("asks for the top card plus three ahead", () => {
    expect(
      idsToAnalyse({ candidates: ids, analysed: {}, inflight: none, failed: none, decided: none }),
    ).toEqual(["a", "b", "c", "d"]);
  });
  it("skips analysed, in-flight and decided papers", () => {
    expect(
      idsToAnalyse({
        candidates: ids,
        analysed: { b: 1 },
        inflight: new Set(["c"]),
        failed: none,
        decided: new Set(["a"]),
      }),
    ).toEqual(["d", "e"]);
  });
  it("slides the window past failed papers", () => {
    expect(
      idsToAnalyse({
        candidates: ids,
        analysed: {},
        inflight: none,
        failed: new Set(["a"]),
        decided: none,
      }),
    ).toEqual(["b", "c", "d", "e"]);
  });
});
