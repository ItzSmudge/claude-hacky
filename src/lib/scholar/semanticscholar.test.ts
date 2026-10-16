import { describe, expect, it, vi } from "vitest";
import { paperSchema } from "@/lib/api-schemas";
import { fixturePapers } from "@/fixtures";
import recorded from "./__fixtures__/semanticscholar-papers.json";
import {
  SemanticScholarError,
  lookupSemanticScholarByDoi,
  s2PaperToPaper,
  searchSemanticScholar,
  type S2Paper,
} from "./semanticscholar";

const papers = recorded.papers as unknown as Record<string, S2Paper>;

describe("s2PaperToPaper", () => {
  it("maps the recorded paper to the same bibliographic data as src/fixtures", () => {
    const paper = s2PaperToPaper(papers.real!)!;
    const fixture = fixturePapers.find((e) => e.paper.id === "openalex-W3110709293")!.paper;
    expect(paper.id).toBe("semanticscholar-4dbdefe3d0f5ccae521c12b80a7d666932dc504b");
    expect(paper.source).toBe("semanticscholar");
    expect(paper.externalId).toBe("4dbdefe3d0f5ccae521c12b80a7d666932dc504b");
    expect(paper.doi).toBe(fixture.doi);
    expect(paper.title).toBe(fixture.title);
    expect(paper.year).toBe(fixture.year);
    expect(paper.authors.map((a) => a.name)).toEqual([
      "M. Boer",
      "G. Stevens",
      "C. Finkenauer",
      "M. D. de Looze",
      "R. van den Eijnden",
    ]);
    expect(paper.venue).toBe("Computers in Human Behavior");
    expect(paper.citationCount).toBeGreaterThanOrEqual(0);
    expect(paper.tldr).toMatch(/^Findings of the study suggest/);
    expect(paper.abstract).toMatch(/^Abstract Social media have become/);
    expect(paper.isPeerReviewed).toBe(true);
    expect(paper.topics).toEqual(["Computer Science", "Psychology"]);
    expect(paper.url).toBe("https://doi.org/10.1016/j.chb.2020.106645");
    expect(paper.pdfUrl).toBe(
      "https://www.sciencedirect.com/science/article/pii/S0747563220303927/pdf",
    );
  });

  it.each(["noTitle", "noId"])("drops the %s paper", (key) => {
    expect(s2PaperToPaper(papers[key]!)).toBeNull();
  });

  it("keeps a sparse paper with optional fields unset", () => {
    const paper = s2PaperToPaper(papers.sparse!)!;
    for (const key of ["doi", "abstract", "tldr", "venue", "pdfUrl"]) {
      expect(paper).not.toHaveProperty(key);
    }
    expect(paper.title).toBe("Sparse Synthetic Paper");
    expect(paper.url).toBe(
      "https://www.semanticscholar.org/paper/9000000000000000000000000000000000000004",
    );
    expect(paper.isPeerReviewed).toBe(false);
    expect(paper.topics).toEqual([]);
    expect(paper.citationCount).toBe(0);
  });

  it("cleans a messy record instead of crashing", () => {
    const paper = s2PaperToPaper(papers.messy!)!;
    expect(paper.authors).toEqual([{ name: "Kept Author" }]);
    expect(paper).not.toHaveProperty("year");
    expect(paper.doi).toBe("10.1/abc");
    expect(paper).not.toHaveProperty("tldr");
    expect(paper.topics).toEqual(["A", "B", "C"]);
    expect(paper.url).toBe("https://doi.org/10.1/abc");
  });

  it("never uses a non-http S2 url", () => {
    expect(s2PaperToPaper(papers.noDoiBadUrl!)).not.toHaveProperty("url");
  });

  it("does not count a repository as peer reviewed", () => {
    expect(s2PaperToPaper(papers.preprint!)!.isPeerReviewed).toBe(false);
  });

  it("produces records that pass paperSchema", () => {
    for (const raw of Object.values(papers)) {
      const paper = s2PaperToPaper(raw);
      if (paper) expect(() => paperSchema.parse(paper)).not.toThrow();
    }
  });
});

// Opt-in, hits the real API: S2_LIVE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/scholar/semanticscholar.test.ts
describe.skipIf(!process.env.S2_LIVE)("searchSemanticScholar (live)", () => {
  it("returns valid papers, or a retryable 429 when the pool is busy", async () => {
    try {
      const res = await searchSemanticScholar(
        { q: "social media adolescent mental health", yearFrom: 2018, yearTo: 2022, perPage: 5 },
        { apiKey: process.env.SEMANTIC_SCHOLAR_API_KEY },
      );
      for (const paper of res.papers) paperSchema.parse(paper);
      const first = res.papers[0];
      console.log(`live: ${res.papers.length}/${res.total}`, first?.title, "| tldr:", first?.tldr);
    } catch (err) {
      expect(err).toMatchObject({ status: 429, retryable: true });
      console.log("live: 429 after retries (no key or busy pool)");
    }
  }, 30_000);
});

describe("searchSemanticScholar", () => {
  const FIELDS =
    "paperId,externalIds,title,abstract,year,venue,publicationVenue,publicationTypes,authors,citationCount,openAccessPdf,tldr,url,fieldsOfStudy";
  const body = (data: S2Paper[] | undefined, total = data?.length ?? 0) =>
    new Response(JSON.stringify(data ? { total, offset: 0, data } : { total, offset: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  const status = (code: number, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify({ message: "nope" }), { status: code, headers });
  const sleep = vi.fn<(ms: number, signal?: AbortSignal) => Promise<void>>(async () => {});
  const urlOf = (fetch: ReturnType<typeof vi.fn>, call = 0) =>
    new URL((fetch.mock.calls[call] as unknown as [string])[0]);
  const initOf = (fetch: ReturnType<typeof vi.fn>, call = 0) =>
    (fetch.mock.calls[call] as unknown as [string, RequestInit])[1];

  it("builds the request URL", async () => {
    const fetch = vi.fn(async () => body([papers.real!]));
    await searchSemanticScholar(
      { q: "self-esteem  social-media", yearFrom: 2018, yearTo: 2022, page: 3, perPage: 10 },
      { fetch, sleep },
    );
    const url = urlOf(fetch);
    expect(url.origin + url.pathname).toBe("https://api.semanticscholar.org/graph/v1/paper/search");
    expect(url.searchParams.get("query")).toBe("self esteem social media");
    expect(url.searchParams.get("offset")).toBe("20");
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("fields")).toBe(FIELDS);
    expect(url.searchParams.get("year")).toBe("2018-2022");
  });

  it.each([
    [{ yearFrom: 2018 }, "2018-"],
    [{ yearTo: 2022 }, "-2022"],
    [{ yearFrom: 2022, yearTo: 2018 }, "2018-2022"],
    [{}, null],
  ])("formats years %j as %s", async (years, expected) => {
    const fetch = vi.fn(async () => body([]));
    await searchSemanticScholar({ q: "x", ...years }, { fetch, sleep });
    expect(urlOf(fetch).searchParams.get("year")).toBe(expected);
  });

  it("sends the API key as a header only", async () => {
    const fetch = vi.fn(async () => body([]));
    await searchSemanticScholar({ q: "x" }, { fetch, sleep, apiKey: "secret-key" });
    expect(new Headers(initOf(fetch).headers).get("x-api-key")).toBe("secret-key");
    expect(urlOf(fetch).toString()).not.toContain("secret-key");

    const anonymous = vi.fn(async () => body([]));
    await searchSemanticScholar({ q: "x" }, { fetch: anonymous, sleep });
    expect(new Headers(initOf(anonymous).headers).has("x-api-key")).toBe(false);
  });

  it("maps results, drops unusable papers and computes nextPage", async () => {
    const fetch = vi.fn(async () => body([papers.real!, papers.noTitle!], 50));
    const res = await searchSemanticScholar({ q: "x", page: 1, perPage: 20 }, { fetch, sleep });
    expect(res.papers.map((p) => p.id)).toEqual([
      "semanticscholar-4dbdefe3d0f5ccae521c12b80a7d666932dc504b",
    ]);
    expect(res.total).toBe(50);
    expect(res.nextPage).toBe(2);
  });

  it("stops paging at S2's 1,000-result window", async () => {
    const fetch = vi.fn(async () => body([], 5000));
    const res = await searchSemanticScholar({ q: "x", page: 50, perPage: 20 }, { fetch, sleep });
    expect(res.nextPage).toBeNull();
  });

  it("shrinks the last page so offset + limit stays within 1,000", async () => {
    const fetch = vi.fn(async () => body([], 5000));
    const res = await searchSemanticScholar({ q: "x", page: 34, perPage: 30 }, { fetch, sleep });
    expect(urlOf(fetch).searchParams.get("offset")).toBe("990");
    expect(urlOf(fetch).searchParams.get("limit")).toBe("10");
    expect(res.nextPage).toBeNull();
  });

  it("returns an empty page past the 1,000-result window without calling S2", async () => {
    const fetch = vi.fn(async () => body([], 5000));
    const res = await searchSemanticScholar({ q: "x", page: 60, perPage: 20 }, { fetch, sleep });
    expect(res).toEqual({ papers: [], total: 0, nextPage: null });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("clamps perPage to 100", async () => {
    const fetch = vi.fn(async () => body([]));
    await searchSemanticScholar({ q: "x", perPage: 500 }, { fetch, sleep });
    expect(urlOf(fetch).searchParams.get("limit")).toBe("100");
  });

  it("returns an empty page when S2 omits data", async () => {
    const fetch = vi.fn(async () => body(undefined, 0));
    await expect(searchSemanticScholar({ q: "x" }, { fetch, sleep })).resolves.toEqual({
      papers: [],
      total: 0,
      nextPage: null,
    });
  });

  it.each(["", "   "])("rejects the query %j without calling S2", async (q) => {
    const fetch = vi.fn(async () => body([]));
    const err = await searchSemanticScholar({ q }, { fetch, sleep }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SemanticScholarError);
    expect(err).toMatchObject({ status: 400, retryable: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retries 429s, honouring Retry-After, then succeeds", async () => {
    sleep.mockClear();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(status(429, { "retry-after": "2" }))
      .mockResolvedValueOnce(status(429))
      .mockResolvedValueOnce(body([papers.real!]));
    const res = await searchSemanticScholar({ q: "x" }, { fetch, sleep });
    expect(res.papers).toHaveLength(1);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([2000, 1500]);
  });

  it.each([
    ["Wed, 21 Oct 2026 07:28:00 GMT", 500],
    ["soon", 500],
    ["60", 5000],
  ])("treats Retry-After %j as a %i ms wait", async (header, ms) => {
    sleep.mockClear();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(status(429, { "retry-after": header }))
      .mockResolvedValueOnce(body([]));
    await searchSemanticScholar({ q: "x" }, { fetch, sleep });
    expect(sleep.mock.calls[0]![0]).toBe(ms);
  });

  it("gives up after 2 retries with a retryable 429", async () => {
    sleep.mockClear();
    const fetch = vi.fn(async () => status(429));
    const err = await searchSemanticScholar({ q: "x" }, { fetch, sleep }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SemanticScholarError);
    expect(err).toMatchObject({ status: 429, retryable: true });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 1500]);
  });

  it.each([
    [400, 2],
    [403, 1],
  ])("does not back off on a %i and keeps the key out of the error", async (code, calls) => {
    sleep.mockClear();
    const fetch = vi.fn(async () => status(code));
    const err = (await searchSemanticScholar(
      { q: "x" },
      { fetch, sleep, apiKey: "secret-key" },
    ).catch((e: unknown) => e)) as SemanticScholarError;
    expect(err).toMatchObject({ status: code, retryable: false });
    expect(err.message).not.toContain("secret-key");
    expect(fetch).toHaveBeenCalledTimes(calls);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries a 400 once without tldr, in case search rejects that field", async () => {
    sleep.mockClear();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(status(400))
      .mockResolvedValueOnce(body([papers.real!]));
    const res = await searchSemanticScholar({ q: "x" }, { fetch, sleep });
    expect(res.papers).toHaveLength(1);
    expect(urlOf(fetch, 0).searchParams.get("fields")).toContain("tldr");
    expect(urlOf(fetch, 1).searchParams.get("fields")).toBe(FIELDS.replace(",tldr", ""));
    expect(sleep).not.toHaveBeenCalled();
  });

  it("throws a 502 on a malformed body", async () => {
    const fetch = vi.fn(async () => new Response("<html>", { status: 200 }));
    await expect(searchSemanticScholar({ q: "x" }, { fetch, sleep })).rejects.toMatchObject({
      status: 502,
      retryable: false,
    });
  });

  it("retries a network error", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(body([papers.real!]));
    const res = await searchSemanticScholar({ q: "x" }, { fetch, sleep });
    expect(res.papers).toHaveLength(1);
  });

  it("retries when reading the body fails", async () => {
    const broken = {
      ok: true,
      status: 200,
      headers: new Headers(),
      body: null,
      text: () => Promise.reject(new TypeError("terminated")),
    } as unknown as Response;
    const fetch = vi.fn().mockResolvedValueOnce(broken).mockResolvedValueOnce(body([]));
    await expect(searchSemanticScholar({ q: "x" }, { fetch, sleep })).resolves.toMatchObject({
      papers: [],
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not call S2 when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetch = vi.fn(async () => body([]));
    await expect(
      searchSemanticScholar({ q: "x" }, { fetch, sleep, signal: controller.signal }),
    ).rejects.toBeInstanceOf(SemanticScholarError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stops retrying when the caller aborts during backoff", async () => {
    const controller = new AbortController();
    const abortingSleep = vi.fn(async () => controller.abort());
    const fetch = vi.fn(async () => status(429));
    await expect(
      searchSemanticScholar({ q: "x" }, { fetch, sleep: abortingSleep, signal: controller.signal }),
    ).rejects.toMatchObject({ retryable: false });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(initOf(fetch).signal).toBeInstanceOf(AbortSignal);
  });
});

describe("lookupSemanticScholarByDoi", () => {
  const json = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  const sleep = vi.fn<(ms: number, signal?: AbortSignal) => Promise<void>>(async () => {});
  const callOf = (fetch: ReturnType<typeof vi.fn>, call = 0) =>
    fetch.mock.calls[call] as unknown as [string, RequestInit];

  it("posts the DOIs to /paper/batch with the key as a header", async () => {
    const fetch = vi.fn(async () => json([null, null]));
    await lookupSemanticScholarByDoi(["10.1/a", "10.2/b"], { fetch, sleep, apiKey: "secret-key" });
    const [url, init] = callOf(fetch);
    expect(url).toBe("https://api.semanticscholar.org/graph/v1/paper/batch?fields=tldr,abstract");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ ids: ["DOI:10.1/a", "DOI:10.2/b"] });
    const headers = new Headers(init.headers);
    expect(headers.get("x-api-key")).toBe("secret-key");
    expect(headers.get("content-type")).toBe("application/json");
    expect(url).not.toContain("secret-key");

    const anonymous = vi.fn(async () => json([null]));
    await lookupSemanticScholarByDoi(["10.1/a"], { fetch: anonymous, sleep });
    expect(new Headers(callOf(anonymous)[1].headers).has("x-api-key")).toBe(false);
  });

  it.each([[[]], [["not a doi", ""]]])("makes no request for %j", async (dois) => {
    const fetch = vi.fn(async () => json([]));
    await expect(lookupSemanticScholarByDoi(dois, { fetch, sleep })).resolves.toEqual(new Map());
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends each DOI once, normalised and lowercased", async () => {
    const fetch = vi.fn(async () => json([null]));
    await lookupSemanticScholarByDoi(["10.1/ABC", "https://doi.org/10.1/abc", "10.1/abc"], {
      fetch,
      sleep,
    });
    expect(JSON.parse(callOf(fetch)[1].body as string)).toEqual({ ids: ["DOI:10.1/abc"] });
  });

  it("maps results by position and skips unknown papers", async () => {
    const fetch = vi.fn(async () =>
      json([
        { paperId: "x", tldr: { model: "tldr@v2.0.0", text: " Short  one. " }, abstract: "Abs." },
        null,
        { paperId: "y", tldr: null, abstract: null },
      ]),
    );
    const map = await lookupSemanticScholarByDoi(["10.1/a", "10.2/b", "10.3/c"], { fetch, sleep });
    expect(map.get("10.1/a")).toEqual({ tldr: "Short one.", abstract: "Abs." });
    expect(map.has("10.2/b")).toBe(false);
    expect(map.get("10.3/c")).toEqual({});
  });

  it.each([
    ["a shorter array", JSON.stringify([null])],
    ["an object", JSON.stringify({ data: [] })],
    ["HTML", "<html>"],
  ])("throws a 502 on %s", async (_label, body) => {
    const fetch = vi.fn(async () => new Response(body, { status: 200 }));
    await expect(
      lookupSemanticScholarByDoi(["10.1/a", "10.2/b"], { fetch, sleep }),
    ).rejects.toMatchObject({ status: 502, retryable: false });
  });

  it("retries one 429, then succeeds", async () => {
    sleep.mockClear();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ message: "busy" }, 429))
      .mockResolvedValueOnce(json([{ tldr: { text: "T" } }]));
    const map = await lookupSemanticScholarByDoi(["10.1/a"], { fetch, sleep });
    expect(map.get("10.1/a")).toEqual({ tldr: "T" });
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500]);
  });

  it("honours a Retry-After that fits the budget, capped at 2 s", async () => {
    for (const [header, ms] of [
      ["2", 2000],
      ["30", 2000],
    ] as const) {
      sleep.mockClear();
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(json({}, 429, { "retry-after": header }))
        .mockResolvedValueOnce(json([null]));
      await lookupSemanticScholarByDoi(["10.1/a"], { fetch, sleep });
      expect(sleep.mock.calls[0]![0]).toBe(ms);
    }
  });

  it("gives up after one retry with a retryable 429", async () => {
    const fetch = vi.fn(async () => json({}, 429));
    await expect(lookupSemanticScholarByDoi(["10.1/a"], { fetch, sleep })).rejects.toMatchObject({
      status: 429,
      retryable: true,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 400 and keeps the key out of the error", async () => {
    const fetch = vi.fn(async () => json({ error: "bad" }, 400));
    const err = (await lookupSemanticScholarByDoi(["10.1/a"], {
      fetch,
      sleep,
      apiKey: "secret-key",
    }).catch((e: unknown) => e)) as SemanticScholarError;
    expect(err).toBeInstanceOf(SemanticScholarError);
    expect(err).toMatchObject({ status: 400, retryable: false });
    expect(err.message).not.toContain("secret-key");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not call S2 when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetch = vi.fn(async () => json([null]));
    await expect(
      lookupSemanticScholarByDoi(["10.1/a"], { fetch, sleep, signal: controller.signal }),
    ).rejects.toBeInstanceOf(SemanticScholarError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stops when the caller aborts during the retry wait", async () => {
    const controller = new AbortController();
    const abortingSleep = vi.fn(async () => controller.abort());
    const fetch = vi.fn(async () => json({}, 429));
    await expect(
      lookupSemanticScholarByDoi(["10.1/a"], {
        fetch,
        sleep: abortingSleep,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ retryable: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
