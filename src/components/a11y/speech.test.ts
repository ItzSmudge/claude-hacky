import { describe, expect, it } from "vitest";
import { RATES, cardScript, nextRate, rateLabel, toTtsText, toUtterances } from "./speech";

describe("toUtterances", () => {
  it("splits into sentences and drops empty parts", () => {
    expect(toUtterances(["First one. Second one!", "", "  ", "Third?"])).toEqual([
      "First one.",
      "Second one!",
      "Third?",
    ]);
  });

  it("keeps decimals and abbreviations like 2.5 together", () => {
    expect(toUtterances(["Effect size was 2.5 overall. Done."])).toEqual([
      "Effect size was 2.5 overall.",
      "Done.",
    ]);
  });

  it("breaks over-long sentences on word boundaries (Chrome stops long utterances)", () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ") + ".";
    const chunks = toUtterances([long], 120);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 120)).toBe(true);
    expect(chunks.join(" ")).toBe(long);
  });

  it("collapses whitespace", () => {
    expect(toUtterances(["A\n\n  line   here."])).toEqual(["A line here."]);
  });
});

describe("cardScript", () => {
  it("reads title, why it matters, then overview, with spoken labels", () => {
    expect(cardScript({ title: "T", whyItMatters: "Because.", overview: "It studied X." })).toEqual(
      ["T.", "Why it matters: Because.", "It studied X."],
    );
  });

  it("skips missing parts and doesn't double the full stop", () => {
    expect(cardScript({ title: "A question?", whyItMatters: "", overview: "" })).toEqual([
      "A question?",
    ]);
  });
});

describe("rates", () => {
  it("cycles through the speeds and wraps", () => {
    expect(nextRate(1)).toBe(1.25);
    expect(nextRate(RATES[RATES.length - 1])).toBe(RATES[0]);
    expect(nextRate(3)).toBe(1);
  });

  it("labels speeds for display", () => {
    expect(rateLabel(1)).toBe("1×");
    expect(rateLabel(0.75)).toBe("0.75×");
  });
});

describe("toTtsText", () => {
  it("joins the script into one normalised piece", () => {
    expect(toTtsText(["T.", "Why it matters:  Because.", "", "It studied X."])).toBe(
      "T. Why it matters: Because. It studied X.",
    );
  });

  it("stops at the last whole sentence that fits", () => {
    expect(toTtsText(["One two. Three four. Five six."], 20)).toBe("One two. Three four.");
  });
});
