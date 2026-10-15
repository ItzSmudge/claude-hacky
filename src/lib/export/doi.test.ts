import { describe, expect, it, vi } from "vitest";
import { fetchDoiBibtex, normaliseDoi } from "./doi";

const BIB = "@article{X_2020, title={T}, year={2020}}";

const ok = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, {
    status: 200,
    headers: { "content-type": "application/x-bibtex", ...headers },
  });

describe("normaliseDoi", () => {
  it.each([
    ["10.1016/j.chb.2020.106645", "10.1016/j.chb.2020.106645"],
    ["https://doi.org/10.1016/J.CHB.2020.106645", "10.1016/J.CHB.2020.106645"],
    ["http://dx.doi.org/10.1/x", "10.1/x"],
    ["doi:10.1/x", "10.1/x"],
    ["  10.1/x  ", "10.1/x"],
  ])("%s → %s", (input, expected) => {
    expect(normaliseDoi(input)).toBe(expected);
  });

  it.each(["", "not a doi", "11.1/x", "10.1/"])("rejects %j", (input) => {
    expect(normaliseDoi(input)).toBeNull();
  });
});

describe("fetchDoiBibtex", () => {
  it("asks doi.org for BibTeX and returns the text", async () => {
    const fetch = vi.fn(async () => ok(` ${BIB} `));
    expect(await fetchDoiBibtex("10.1016/j.chb.2020.106645", { fetch })).toBe(BIB);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://doi.org/10.1016/j.chb.2020.106645");
    expect(new Headers(init.headers).get("accept")).toBe("application/x-bibtex; charset=utf-8");
    expect(init.redirect).toBe("follow");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("percent-encodes unusual DOI characters but keeps the slashes", async () => {
    const fetch = vi.fn(async () => ok(BIB));
    await fetchDoiBibtex("10.1002/(SICI)1097-4571#x?y", { fetch });
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe(
      "https://doi.org/10.1002/(SICI)1097-4571%23x%3Fy",
    );
  });

  it.each([
    ["a 404", () => new Response("DOI Not Found", { status: 404 })],
    ["an HTML page", () => ok("<html></html>", { "content-type": "text/html" })],
    ["an oversized body", () => ok(`@article{x, title={${"a".repeat(70_000)}}}`)],
    ["a declared oversized body", () => ok(BIB, { "content-length": "100000" })],
  ])("returns null for %s", async (_label, respond) => {
    expect(await fetchDoiBibtex("10.1/x", { fetch: async () => respond() })).toBeNull();
  });

  it("returns null when fetch throws or the DOI is invalid", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("network down");
    });
    expect(await fetchDoiBibtex("10.1/x", { fetch })).toBeNull();
    expect(await fetchDoiBibtex("nope", { fetch })).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives up after the timeout", async () => {
    const fetch = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    expect(await fetchDoiBibtex("10.1/x", { fetch, timeoutMs: 10 })).toBeNull();
  });
});
