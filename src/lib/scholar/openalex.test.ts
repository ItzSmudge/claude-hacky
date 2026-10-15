import { describe, expect, it, vi } from "vitest";
import { paperSchema } from "@/lib/api-schemas";
import { fixturePapers } from "@/fixtures";
import recorded from "./__fixtures__/openalex-works.json";
import {
  OpenAlexError,
  abstractFromInvertedIndex,
  searchOpenAlex,
  workToPaper,
  type OpenAlexWork,
} from "./openalex";

const works = recorded.works as unknown as Record<string, OpenAlexWork>;

describe("abstractFromInvertedIndex", () => {
  it("puts words back in position order", () => {
    expect(abstractFromInvertedIndex({ world: [1], hello: [0] })).toBe("hello world");
  });

  it("handles repeated words, gaps and non-ASCII", () => {
    expect(abstractFromInvertedIndex({ the: [0, 3], café: [1], "is—": [2], end: [6] })).toBe(
      "the café is— the end",
    );
  });

  it.each([null, undefined, {}])("returns undefined for %j", (input) => {
    expect(abstractFromInvertedIndex(input)).toBeUndefined();
  });

  it("rebuilds the recorded abstract", () => {
    expect(abstractFromInvertedIndex(works.real!.abstract_inverted_index)).toMatch(
      /^Social media have become increasingly integrated/,
    );
  });
});

describe("workToPaper", () => {
  it("maps the recorded work to the same Paper as src/fixtures", () => {
    const paper = workToPaper(works.real!);
    const fixture = fixturePapers.find((e) => e.paper.id === "openalex-W3110709293")!.paper;
    expect(paper).toEqual({
      id: fixture.id,
      source: "openalex",
      externalId: fixture.externalId,
      doi: fixture.doi,
      title: fixture.title,
      abstract: fixture.abstract,
      authors: fixture.authors,
      year: fixture.year,
      venue: fixture.venue,
      url: fixture.url,
      citationCount: fixture.citationCount,
      isPeerReviewed: true,
      topics: fixture.topics,
    });
  });

  it.each(["retracted", "paratext", "untitled"])("drops the %s work", (key) => {
    expect(workToPaper(works[key]!)).toBeNull();
  });

  it("drops a work without a usable id", () => {
    expect(workToPaper({ ...works.real!, id: "https://example.org/x" })).toBeNull();
  });

  it("keeps a sparse preprint with optional fields unset", () => {
    const paper = workToPaper(works.preprint!)!;
    expect(paper.id).toBe("openalex-W9000000004");
    expect(paper.isPeerReviewed).toBe(false);
    expect(paper.doi).toBeUndefined();
    expect(paper.abstract).toBeUndefined();
    expect(paper.authors).toEqual([{ name: "Test Author" }]);
    expect(paper.url).toBe("https://example.org/preprint/9000000004");
    expect(paper.pdfUrl).toBe("https://example.org/preprint/9000000004.pdf");
    expect(paper.topics).toEqual(["Synthetic Topic"]);
    expect(paper).not.toHaveProperty("tldr");
  });

  it("strips markup from titles and lowercases DOIs", () => {
    const paper = workToPaper(works.markup!)!;
    expect(paper.title).toBe("Synthetic in vitro work with CO2 title");
    expect(paper.doi).toBe("10.9999/synth.5");
    expect(paper.url).toBe("https://doi.org/10.9999/synth.5");
    expect(paper.venue).toBeUndefined();
    expect(paper.isPeerReviewed).toBe(false);
  });

  it("counts conference proceedings as peer reviewed, but not repositories", () => {
    const at = (type: string) =>
      workToPaper({
        ...works.real!,
        type: "conference-paper",
        primary_location: {
          ...works.real!.primary_location,
          source: { display_name: "Proceedings of the AAAI Conference", type },
        },
      })!.isPeerReviewed;
    expect(at("conference")).toBe(true);
    expect(at("repository")).toBe(false);
  });

  it("keeps a bare < in titles", () => {
    const paper = workToPaper({ ...works.markup!, display_name: "Effects at p < 0.05 vs q > 1" })!;
    expect(paper.title).toBe("Effects at p < 0.05 vs q > 1");
  });

  it("encodes DOIs in the url but not in doi", () => {
    const doi = "https://doi.org/10.1002/(SICI)1097-4571(199806)49:8<693::AID-ASI4>3.0.CO;2-#";
    const paper = workToPaper({ ...works.markup!, doi })!;
    expect(paper.doi).toBe("10.1002/(sici)1097-4571(199806)49:8<693::aid-asi4>3.0.co;2-#");
    expect(paper.url).toBe(
      "https://doi.org/10.1002/(sici)1097-4571(199806)49%3A8%3C693%3A%3Aaid-asi4%3E3.0.co%3B2-%23",
    );
  });

  it("only passes through http(s) links", () => {
    const paper = workToPaper({
      ...works.preprint!,
      primary_location: { landing_page_url: "javascript:alert(1)" },
      best_oa_location: { pdf_url: "data:text/html,x" },
    })!;
    expect(paper.url).toBe("https://openalex.org/W9000000004");
    expect(paper.pdfUrl).toBeUndefined();
  });

  it("falls back to the OpenAlex page for url", () => {
    const bare = workToPaper({ ...works.markup!, doi: null })!;
    expect(bare.url).toBe("https://openalex.org/W9000000005");
  });

  it("caps topics at 3", () => {
    const many = ["a", "b", "c", "d"].map((display_name) => ({ display_name }));
    expect(workToPaper({ ...works.real!, topics: many })!.topics).toEqual(["a", "b", "c"]);
  });

  it("produces records that pass paperSchema", () => {
    for (const work of Object.values(works)) {
      const paper = workToPaper(work);
      if (paper) expect(paperSchema.safeParse(paper).success).toBe(true);
    }
  });
});

describe("searchOpenAlex", () => {
  const body = (results: OpenAlexWork[], count = results.length) =>
    new Response(JSON.stringify({ meta: { count }, results }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  const status = (code: number, headers: Record<string, string> = {}) =>
    new Response("{}", { status: code, headers });
  const sleep = vi.fn<(ms: number, signal?: AbortSignal) => Promise<void>>(async () => {});
  const urlOf = (fetch: ReturnType<typeof vi.fn>, call = 0) =>
    new URL((fetch.mock.calls[call] as unknown as [string])[0]);

  it("builds the request URL", async () => {
    const fetch = vi.fn(async () => body([works.real!]));
    await searchOpenAlex(
      { q: "social media, teens | wellbeing & sleep", page: 2, perPage: 80 },
      { fetch, mailto: "team@example.com", sleep },
    );
    const url = urlOf(fetch);
    expect(url.origin + url.pathname).toBe("https://api.openalex.org/works");
    expect(url.searchParams.get("search")).toBe("social media, teens | wellbeing & sleep");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("per-page")).toBe("50");
    expect(url.searchParams.get("mailto")).toBe("team@example.com");
    expect(url.searchParams.get("select")).toContain("abstract_inverted_index");
    expect(url.searchParams.has("filter")).toBe(false);
  });

  it.each([
    [{ yearFrom: 2015, yearTo: 2020 }, "publication_year:2015-2020"],
    [{ yearFrom: 2015 }, "publication_year:>2014"],
    [{ yearTo: 2020 }, "publication_year:<2021"],
    [{ yearFrom: 2020, yearTo: 2015 }, "publication_year:2015-2020"],
  ])("filters years %j", async (years, filter) => {
    const fetch = vi.fn(async () => body([]));
    await searchOpenAlex({ q: "x", ...years }, { fetch, mailto: undefined, sleep });
    expect(urlOf(fetch).searchParams.get("filter")).toBe(filter);
    expect(urlOf(fetch).searchParams.has("mailto")).toBe(false);
  });

  it("maps results, drops unusable works and computes nextPage", async () => {
    const fetch = vi.fn(async () => body([works.real!, works.retracted!, works.preprint!], 45));
    const res = await searchOpenAlex({ q: "x", page: 1, perPage: 20 }, { fetch, sleep });
    expect(res.papers.map((p) => p.id)).toEqual(["openalex-W3110709293", "openalex-W9000000004"]);
    expect(res.total).toBe(45);
    expect(res.nextPage).toBe(2);
    const last = await searchOpenAlex({ q: "x", page: 3, perPage: 20 }, { fetch, sleep });
    expect(last.nextPage).toBeNull();
  });

  it("stops paging at OpenAlex's 10,000-result limit", async () => {
    const fetch = vi.fn(async () => body([], 50_000));
    expect(
      (await searchOpenAlex({ q: "x", page: 199, perPage: 50 }, { fetch, sleep })).nextPage,
    ).toBe(200);
    expect(
      (await searchOpenAlex({ q: "x", page: 200, perPage: 50 }, { fetch, sleep })).nextPage,
    ).toBeNull();
  });

  it("rejects an empty query without calling OpenAlex", async () => {
    const fetch = vi.fn(async () => body([]));
    await expect(searchOpenAlex({ q: "  " }, { fetch, sleep })).rejects.toMatchObject({
      status: 400,
      retryable: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retries when reading the body fails", async () => {
    const broken = new Response(
      new ReadableStream({
        start(c) {
          c.error(new Error("socket hang up"));
        },
      }),
      { status: 200 },
    );
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(broken)
      .mockResolvedValueOnce(body([works.real!]));
    expect((await searchOpenAlex({ q: "x" }, { fetch, sleep })).papers).toHaveLength(1);
  });

  it("stops retrying when the caller aborts during backoff", async () => {
    const controller = new AbortController();
    const fetch = vi.fn(async () => status(503));
    const abortingSleep = vi.fn(async () => controller.abort());
    await expect(
      searchOpenAlex({ q: "x" }, { fetch, sleep: abortingSleep, signal: controller.signal }),
    ).rejects.toMatchObject({ retryable: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("returns an empty page", async () => {
    const fetch = vi.fn(async () => body([], 0));
    expect(await searchOpenAlex({ q: "x" }, { fetch, sleep })).toEqual({
      papers: [],
      total: 0,
      nextPage: null,
    });
  });

  it("retries a 429, honouring Retry-After", async () => {
    sleep.mockClear();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(status(429, { "retry-after": "2" }))
      .mockResolvedValueOnce(body([works.real!]));
    const res = await searchOpenAlex({ q: "x" }, { fetch, sleep });
    expect(res.papers).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls[0]![0]).toBe(2000);
  });

  it("gives up after 2 retries with a retryable OpenAlexError", async () => {
    sleep.mockClear();
    const fetch = vi.fn(async () => status(503));
    const err = await searchOpenAlex({ q: "x" }, { fetch, sleep }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OpenAlexError);
    expect(err).toMatchObject({ status: 503, retryable: true });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 1500]);
  });

  it("does not retry a 400", async () => {
    const fetch = vi.fn(async () => status(400));
    await expect(searchOpenAlex({ q: "x" }, { fetch, sleep })).rejects.toMatchObject({
      status: 400,
      retryable: false,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("throws on a malformed body", async () => {
    const fetch = vi.fn(async () => new Response("<html>", { status: 200 }));
    await expect(searchOpenAlex({ q: "x" }, { fetch, sleep })).rejects.toBeInstanceOf(
      OpenAlexError,
    );
  });

  it("retries a network error, then throws", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(searchOpenAlex({ q: "x" }, { fetch, sleep })).rejects.toMatchObject({
      status: 0,
      retryable: true,
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("passes an abort signal and stops when the caller aborts", async () => {
    const fetch = vi.fn(async () => body([]));
    await searchOpenAlex({ q: "x" }, { fetch, sleep });
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const controller = new AbortController();
    controller.abort();
    const failing = vi.fn(async () => status(503));
    await expect(
      searchOpenAlex({ q: "x" }, { fetch: failing, sleep, signal: controller.signal }),
    ).rejects.toBeInstanceOf(OpenAlexError);
    expect(failing).toHaveBeenCalledTimes(0);
  });
});
