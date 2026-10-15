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

  it.each(["", "not a doi", "11.1/x", "10.1/", "10.1/../x", "10.1/a/./b"])(
    "rejects %j",
    (input) => {
      expect(normaliseDoi(input)).toBeNull();
    },
  );
});

describe("fetchDoiBibtex", () => {
  it("asks doi.org for BibTeX and returns the text", async () => {
    const fetch = vi.fn(async () => ok(` ${BIB} `));
    expect(await fetchDoiBibtex("10.1016/j.chb.2020.106645", { fetch })).toBe(BIB);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://doi.org/10.1016/j.chb.2020.106645");
    expect(new Headers(init.headers).get("accept")).toBe("application/x-bibtex; charset=utf-8");
    expect(init.redirect).toBe("manual");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends the user agent when given", async () => {
    const fetch = vi.fn(async () => ok(BIB));
    await fetchDoiBibtex("10.1/x", { fetch, userAgent: "PaperCut/1.0 (mailto:a@b.c)" });
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).get("user-agent")).toBe("PaperCut/1.0 (mailto:a@b.c)");
  });

  it("follows redirects to registration agencies only", async () => {
    const redirect = (location: string) =>
      new Response(null, { status: 302, headers: { location } });
    const fetch = vi.fn(async (url: string) =>
      url.startsWith("https://doi.org/")
        ? redirect("https://api.crossref.org/v1/works/10.1/x/transform")
        : ok(BIB),
    );
    expect(await fetchDoiBibtex("10.1/x", { fetch })).toBe(BIB);
    expect(fetch).toHaveBeenCalledTimes(2);

    for (const location of [
      "http://api.crossref.org/x",
      "https://publisher.example/landing",
      "https://localhost:54421/x",
      "https://doi.org.evil.example/x",
    ]) {
      expect(await fetchDoiBibtex("10.1/x", { fetch: async () => redirect(location) })).toBeNull();
    }
  });

  it("stops after 3 redirects", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(null, { status: 302, headers: { location: "https://doi.org/10.1/x" } }),
    );
    expect(await fetchDoiBibtex("10.1/x", { fetch })).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("stops reading a streamed body past the size cap", async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(new Uint8Array(16 * 1024).fill(97));
      },
    });
    const fetch = async () =>
      new Response(stream, { headers: { "content-type": "application/x-bibtex" } });
    expect(await fetchDoiBibtex("10.1/x", { fetch })).toBeNull();
    expect(pulled).toBeLessThan(10);
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
    ["a non-BibTeX content type", () => ok(BIB, { "content-type": "text/plain" })],
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
