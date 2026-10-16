import { describe, expect, it } from "vitest";
import { inviteUrl, normaliseJoinCode } from "./join-code";

describe("normaliseJoinCode", () => {
  it("upper-cases and trims", () => {
    expect(normaliseJoinCode("  demo42 ")).toBe("DEMO42");
  });

  it("drops spaces and dashes people type or paste", () => {
    expect(normaliseJoinCode("abc-234")).toBe("ABC234");
    expect(normaliseJoinCode("ABC 234")).toBe("ABC234");
  });

  it("decodes a URL-encoded segment", () => {
    expect(normaliseJoinCode("ABC%20234")).toBe("ABC234");
  });

  it.each(["", "   ", "AB1", "ABCDEFGHJKMNP", "ABC!23", "ÄBC234", "%E0%A4%A"])(
    "rejects %j",
    (input) => {
      expect(normaliseJoinCode(input)).toBeNull();
    },
  );
});

describe("inviteUrl", () => {
  it("builds an absolute join link", () => {
    expect(inviteUrl("https://papercut-ten.vercel.app", "DEMO42")).toBe(
      "https://papercut-ten.vercel.app/app/join/DEMO42",
    );
  });

  it("ignores a trailing slash on the origin", () => {
    expect(inviteUrl("http://localhost:3000/", "ABC234")).toBe(
      "http://localhost:3000/app/join/ABC234",
    );
  });
});
