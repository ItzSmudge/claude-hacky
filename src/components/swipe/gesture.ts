import type { SwipeDecision } from "@/types/domain";

/** Turns a released drag into a deck outcome. Values from the SW-02 spec. */
export const GESTURE = {
  distanceRatio: 0.3,
  flingVelocity: 500,
  minOffset: 40,
  upDistance: 100,
  upVelocity: 600,
  verticalBias: 1.2,
  fallbackWidth: 320,
} as const;

export type GestureOutcome = SwipeDecision | "details" | null;

export interface GestureInput {
  /** Offset from rest, px. */
  x: number;
  y: number;
  /** Release velocity, px/s. */
  vx: number;
  vy: number;
  /** Current card width, px. */
  width: number;
}

export function classifyGesture({ x, y, vx, vy, width }: GestureInput): GestureOutcome {
  const absX = Math.abs(x);
  const absY = Math.abs(y);

  const mostlyUp = y < 0 && absY > GESTURE.verticalBias * absX;
  if (
    mostlyUp &&
    (y < -GESTURE.upDistance || (absY >= GESTURE.minOffset && vy < -GESTURE.upVelocity))
  ) {
    return "details";
  }

  const w = width > 0 ? width : GESTURE.fallbackWidth;
  const side: SwipeDecision = x > 0 ? "save" : "skip";
  if (absX > w * GESTURE.distanceRatio) return side;
  if (
    absX >= GESTURE.minOffset &&
    Math.abs(vx) > GESTURE.flingVelocity &&
    Math.sign(vx) === Math.sign(x)
  ) {
    return side;
  }
  return null;
}
