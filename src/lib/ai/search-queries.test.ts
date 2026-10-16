import { describe, expect, it, vi } from "vitest";
import { finaliseSearchQueries } from "./search-queries";

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({ askJson: vi.fn() }));

describe("finaliseSearchQueries", () => {
  it("trims, strips wildcards and quotes, dedupes case-insensitively and caps at three", () => {
    expect(
      finaliseSearchQueries([
        "  MEMS   acoustic injection ",
        "mems acoustic injection",
        'MEMS "EMI" attack?',
        "",
        "inertial sensor spoofing detection",
        "embedded anomaly detection IMU",
      ]),
    ).toEqual(["MEMS acoustic injection", "MEMS EMI attack", "inertial sensor spoofing detection"]);
  });
});
