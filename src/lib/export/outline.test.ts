import { describe, expect, it } from "vitest";
import type { ProjectOutline } from "@/lib/ai/schemas";
import { outlineLatex, outlineMarkdown, unusedPaperIds } from "./outline";

const keys = new Map([
  ["id-a", "a2020x"],
  ["id-b", "b2021y"],
  ["id-c", "c2022z"],
]);
const one: ProjectOutline["sections"] = [
  { heading: "Heading", points: [{ text: "Text.", paperIds: ["id-a", "id-b"] }] },
];

describe("outlineLatex", () => {
  it("renders sections, items and cite keys", () => {
    expect(outlineLatex(one, keys)).toBe(
      "\\section{Heading}\n\\begin{itemize}\n  \\item Text. \\cite{a2020x,b2021y}\n\\end{itemize}\n",
    );
  });

  it("escapes LaTeX specials in model text", () => {
    const out = outlineLatex(
      [{ heading: "A & B", points: [{ text: "50% & x_1 #2", paperIds: ["id-a"] }] }],
      keys,
    );
    expect(out).toContain("\\section{A \\& B}");
    expect(out).toContain("50\\% \\& x\\_1 \\#2");
  });

  it("skips ids missing from the library and drops an empty \\cite", () => {
    const out = outlineLatex(
      [{ heading: "H", points: [{ text: "Gone.", paperIds: ["removed"] }] }],
      keys,
    );
    expect(out).toContain("\\item Gone.\n");
    expect(out).not.toContain("\\cite");
  });

  it("only ever cites keys from the library", () => {
    const outline: ProjectOutline["sections"] = [
      ...one,
      { heading: "Two", points: [{ text: "More.", paperIds: ["id-c", "nope", "id-a"] }] },
    ];
    const cited = [...outlineLatex(outline, keys).matchAll(/\\cite\{([^}]*)\}/g)].flatMap((m) =>
      m[1]!.split(","),
    );
    expect(cited.length).toBeGreaterThan(0);
    for (const key of cited) expect([...keys.values()]).toContain(key);
  });

  it("separates sections with a blank line", () => {
    expect(outlineLatex([...one, ...one], keys)).toContain("\\end{itemize}\n\n\\section{Heading}");
  });
});

describe("outlineMarkdown", () => {
  it("renders headings, bullets and pandoc citations", () => {
    expect(outlineMarkdown(one, keys)).toBe("## Heading\n\n- Text. [@a2020x; @b2021y]\n");
  });
});

describe("unusedPaperIds", () => {
  it("lists library papers the outline doesn't cite, in library order", () => {
    expect(unusedPaperIds(one, ["id-c", "id-a", "id-d", "id-b"])).toEqual(["id-c", "id-d"]);
  });
});
