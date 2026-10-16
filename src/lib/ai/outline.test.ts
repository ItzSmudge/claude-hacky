import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixturePapers, fixtureProject } from "@/fixtures";
import { projectOutlineSchema, type OutlineOutput } from "./schemas";

vi.mock("server-only", () => ({}));
const askJson = vi.hoisted(() => vi.fn());
vi.mock("./client", () => ({ askJson }));

const { buildOutlinePrompt, draftOutline, finaliseOutline } = await import("./outline");

const { claims, topic } = fixtureProject.context;
const papers = fixturePapers.slice(0, 3).map((f) => f.paper);
const analyses = new Map(fixturePapers.slice(0, 3).map((f) => [f.paper.id, f.analysis]));
const [p1, p2, p3] = papers.map((p) => p.id);
const aliases = new Map([
  ["P1", p1!],
  ["P2", p2!],
  ["P3", p3!],
]);

const point = (text: string, papers: string[]) => ({ text, papers });
const reply = (...sections: OutlineOutput["sections"]): OutlineOutput => ({ sections });

describe("finaliseOutline", () => {
  it("maps aliases to ids, drops unknown ones and repeats", () => {
    const out = finaliseOutline(
      reply({ heading: "Background", points: [point("A point.", ["P1", "p1", " P1", "P99"])] }),
      aliases,
    );
    expect(out).toEqual([
      { heading: "Background", points: [{ text: "A point.", paperIds: [p1] }] },
    ]);
  });

  it("drops points left with no papers and sections left with no points", () => {
    const out = finaliseOutline(
      reply(
        { heading: "Empty", points: [point("Nothing known.", ["P99"])] },
        { heading: "Kept", points: [point("Gone.", []), point("Stays.", ["P2"])] },
      ),
      aliases,
    );
    expect(out).toEqual([{ heading: "Kept", points: [{ text: "Stays.", paperIds: [p2] }] }]);
  });

  it("drops a point whose text names an alias", () => {
    const out = finaliseOutline(
      reply({
        heading: "Themes",
        points: [point("As P3 shows, effects are small.", ["P3"]), point("Fine.", ["P1"])],
      }),
      aliases,
    );
    expect(out[0]!.points).toEqual([{ text: "Fine.", paperIds: [p1] }]);
  });

  it.each([
    "Early work [@smith2019] found small effects.",
    "Early work \\cite{smith2019} found small effects.",
    "Smith et al. found small effects.",
    "Small effects were found (2019).",
    "Small effects were found (Smith, 2019).",
  ])("drops a point that writes its own citation: %s", (text) => {
    const out = finaliseOutline(
      reply({ heading: "Themes", points: [point(text, ["P1"]), point("Fine.", ["P2"])] }),
      aliases,
    );
    expect(out[0]!.points).toEqual([{ text: "Fine.", paperIds: [p2] }]);
  });

  it("drops a section whose heading writes a citation", () => {
    const out = finaliseOutline(
      reply({ heading: "Smith et al. revisited", points: [point("Fine.", ["P1"])] }),
      aliases,
    );
    expect(out).toEqual([]);
  });

  it("keeps text that only looks like an alias", () => {
    const out = finaliseOutline(
      reply({
        heading: "Mechanisms",
        points: [point("p53 and P300 responses differ since 2019.", ["P1"])],
      }),
      aliases,
    );
    expect(out[0]!.points).toHaveLength(1);
  });

  it("drops a section whose heading echoes a saved title", () => {
    const title = "Social media use and adolescent wellbeing";
    const out = finaliseOutline(
      reply({ heading: title, points: [point("A point.", ["P1"])] }),
      aliases,
      [title],
    );
    expect(out).toEqual([]);
  });
});

describe("buildOutlinePrompt", () => {
  it("shows papers by alias only", () => {
    const { messages, aliases: built } = buildOutlinePrompt({ topic, claims }, papers, analyses);
    expect([...built.keys()]).toEqual(["P1", "P2", "P3"]);
    const text = JSON.stringify(messages);
    for (const paper of papers) expect(text).not.toContain(paper.id);
  });
});

describe("draftOutline", () => {
  beforeEach(() => askJson.mockReset());

  it("returns no sections for fewer than two papers without calling the model", async () => {
    const outline = await draftOutline({
      projectId: "p",
      topic,
      claims,
      papers: papers.slice(0, 1),
      analyses,
    });
    expect(outline).toEqual({ projectId: "p", paperCount: 1, sections: [] });
    expect(askJson).not.toHaveBeenCalled();
  });

  it("asks the smart model and returns a valid outline", async () => {
    askJson.mockResolvedValueOnce({
      data: reply({ heading: "Background", points: [point("A point.", ["P1", "P2"])] }),
    });
    const outline = await draftOutline({ projectId: "p", topic, claims, papers, analyses });
    expect(projectOutlineSchema.parse(outline).sections[0]!.points[0]!.paperIds).toEqual([p1, p2]);
    expect(askJson.mock.calls[0]![0]).toMatchObject({ tier: "smart", cacheSystem: true });
  });
});
