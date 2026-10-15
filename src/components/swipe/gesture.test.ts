import { describe, expect, it } from "vitest";
import { classifyGesture, type GestureInput } from "./gesture";

const g = (over: Partial<GestureInput>) =>
  classifyGesture({ x: 0, y: 0, vx: 0, vy: 0, width: 400, ...over });

describe("classifyGesture — distance (width 400 → 120px)", () => {
  it.each([
    [{ x: 116 }, null], // 29%
    [{ x: 124 }, "save"], // 31%
    [{ x: -124 }, "skip"],
    [{ x: 124, y: 150 }, "save"], // big downward drift still saves
  ] as const)("%o → %s", (input, expected) => {
    expect(g(input)).toBe(expected);
  });
});

describe("classifyGesture — fling", () => {
  it.each([
    [{ x: 50, vx: 600 }, "save"], // short fast flick
    [{ x: -50, vx: -600 }, "skip"],
    [{ x: 50, vx: 300 }, null], // short slow drag
    [{ x: 30, vx: 900 }, null], // below 40px minimum
    [{ x: 50, vx: -600 }, null], // flicking back toward centre
  ] as const)("%o → %s", (input, expected) => {
    expect(g(input)).toBe(expected);
  });
});

describe("classifyGesture — up for details", () => {
  it.each([
    [{ y: -120, x: 20 }, "details"],
    [{ y: -50, vy: -700 }, "details"], // fast upward flick
    [{ y: -20, vy: -900 }, null], // below 40px minimum
    [{ y: -120, x: 110 }, null], // diagonal: 120 < 1.2 × 110, and 110 < 120px
    [{ y: 200 }, null], // down never commits
  ] as const)("%o → %s", (input, expected) => {
    expect(g(input)).toBe(expected);
  });
});

describe("classifyGesture — degenerate input", () => {
  it("returns null for no movement", () => {
    expect(g({})).toBeNull();
  });

  it("falls back to a 320px width when width is 0", () => {
    expect(g({ width: 0, x: 100 })).toBe("save"); // 100 > 96
    expect(g({ width: 0, x: 90 })).toBeNull();
  });
});
