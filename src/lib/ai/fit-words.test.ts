import { describe, expect, it } from "vitest";
import { clampToSentences, endsMidClause, introducesNewFacts, splitSentences } from "./fit-words";

describe("splitSentences", () => {
  it("splits on sentence ends", () => {
    expect(splitSentences("A study of teens. It found an effect! Was it big?")).toEqual([
      "A study of teens.",
      "It found an effect!",
      "Was it big?",
    ]);
  });

  it.each([
    ["decimals", "Mean age was 13.1 years in the sample. Done."],
    ["e.g.", "Used several methods, e.g. surveys and diaries. Done."],
    ["i.e.", "The older group, i.e. those over 15, differed. Done."],
    ["initials", "Data from the U.K. cohort were used. Done."],
    ["et al.", "Builds on Smith et al. findings from before. Done."],
    // review should-fix 2: these split before, so a clamp could end "A sample of ca."
    ["ca.", "A sample of ca. 300 teens was used. Done."],
    ["Dr.", "Led by Dr. Stevens at the clinic. Done."],
    ["M.Sc.", "Data from M.Sc. Students in two schools. Done."],
    ["Eq.", "As in Eq. 3 of the model. Done."],
    ["Sept.", "Collected in Sept. 2019 across sites. Done."],
    // review should-fix 3: an ellipsis is not a sentence end
    ["...", "Findings were mixed... Further work is needed. Done."],
    ["…", "Findings were mixed… Further work is needed. Done."],
  ])("does not split inside %s", (_label, text) => {
    expect(splitSentences(text)).toHaveLength(2);
  });

  it("keeps text without an end mark as one unit", () => {
    expect(splitSentences("Longitudinal data on the main claim")).toEqual([
      "Longitudinal data on the main claim",
    ]);
  });
});

describe("clampToSentences", () => {
  it("leaves text within the limit unchanged", () => {
    expect(clampToSentences("One two three. Four five.", 5)).toBe("One two three. Four five.");
  });

  it("keeps the longest run of whole sentences that fits", () => {
    expect(clampToSentences("One two three. Four five six. Seven eight nine ten.", 7)).toBe(
      "One two three. Four five six.",
    );
  });

  it("returns null when even the first sentence is too long", () => {
    expect(clampToSentences("One two three four five six. Seven.", 4)).toBeNull();
  });

  it("returns null for a single over-long phrase", () => {
    expect(clampToSentences("Strong longitudinal evidence on the main claim here", 4)).toBeNull();
  });

  it("never touches not stated", () => {
    expect(clampToSentences("not stated", 1)).toBe("not stated");
  });
});

describe("introducesNewFacts", () => {
  const original =
    "A three-wave study of 2109 adolescents in the Netherlands found problematic use mattered.";

  it("accepts a rewrite that only reuses the original's facts", () => {
    expect(
      introducesNewFacts(
        original,
        "Among 2,109 adolescents in the Netherlands, problematic use mattered.",
      ),
    ).toBe(false);
    expect(introducesNewFacts(original, "Problematic use, not intensity, mattered.")).toBe(false);
  });

  it.each([
    ["a new number", "A study of 312 adolescents found problematic use mattered."],
    ["a new year", "A 2019 study found problematic use mattered."],
    ["a new name", "A study in Germany found problematic use mattered."],
  ])("rejects a rewrite with %s", (_label, rewrite) => {
    expect(introducesNewFacts(original, rewrite)).toBe(true);
  });

  // review should-fix 4 and 5
  it.each([
    ["a new name at the start of a sentence", "Orben found problematic use mattered."],
    ["a changed number word", "A five-wave study found problematic use mattered."],
    ["a new number word", "Twice as many adolescents found problematic use mattered."],
  ])("rejects a rewrite with %s", (_label, rewrite) => {
    expect(introducesNewFacts(original, rewrite)).toBe(true);
  });

  it("allows a function word or an original word at the start of a sentence", () => {
    expect(
      introducesNewFacts(original, "The three-wave study found problematic use mattered."),
    ).toBe(false);
  });

  it("allows the capital at the start of a sentence", () => {
    expect(
      introducesNewFacts(original, "Problematic use mattered. Adolescents were studied."),
    ).toBe(false);
  });
});

describe("endsMidClause", () => {
  it.each([
    "A study of teens,",
    "Teens and",
    "It looked at the",
    "Findings were mixed;",
    "Cut short…",
    "Results were about the.",
  ])("flags %j", (text) => {
    expect(endsMidClause(text)).toBe(true);
  });

  it.each([
    "A study of teens.",
    "Longitudinal data on the main claim",
    "not stated",
    "Was it big?",
  ])("accepts %j", (text) => {
    expect(endsMidClause(text)).toBe(false);
  });
});
