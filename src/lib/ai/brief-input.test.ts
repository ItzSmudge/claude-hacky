import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { BriefInputError } from "./errors";

vi.mock("server-only", () => ({}));
const { MAX_BRIEF_BYTES, MAX_BRIEF_CHARS, readBrief, resolveBriefKind } =
  await import("./brief-input");

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const docx = new Uint8Array(readFileSync(new URL("./__fixtures__/brief.docx", import.meta.url)));
const bytes = (text: string) => new TextEncoder().encode(text);
const pdf = bytes("%PDF-1.7\n% header is all readBrief checks\n");

describe("resolveBriefKind", () => {
  it.each([
    ["application/pdf", "brief.pdf", "pdf"],
    [DOCX, "brief.docx", "docx"],
    ["text/plain", "brief.txt", "text"],
    ["text/markdown", "brief.md", "text"],
    ["text/plain; charset=utf-8", "brief", "text"],
    ["APPLICATION/PDF", "brief", "pdf"],
  ])("%s (%s) → %s", (mimeType, filename, kind) => {
    expect(resolveBriefKind({ mimeType, filename })).toBe(kind);
  });

  it.each([
    ["brief.docx", "docx"],
    ["BRIEF.PDF", "pdf"],
    ["notes.MD", "text"],
    ["brief.txt", "text"],
  ])("falls back to the extension of %s", (filename, kind) => {
    expect(resolveBriefKind({ mimeType: "application/octet-stream", filename })).toBe(kind);
    expect(resolveBriefKind({ mimeType: "", filename })).toBe(kind);
  });

  it.each([
    ["application/msword", "brief.doc"],
    ["image/png", "scan.png"],
    ["application/octet-stream", "brief"],
  ])("rejects %s (%s)", (mimeType, filename) => {
    expect(() => resolveBriefKind({ mimeType, filename })).toThrow(BriefInputError);
  });
});

describe("readBrief", () => {
  it("sends a PDF as base64 and stores no text", async () => {
    const result = await readBrief({ data: pdf, mimeType: "application/pdf", filename: "b.pdf" });
    expect(result).toEqual({
      content: { kind: "pdf", base64: Buffer.from(pdf).toString("base64") },
      extractedText: null,
    });
  });

  it("extracts DOCX text with mammoth", async () => {
    const { content, extractedText } = await readBrief({
      data: docx,
      mimeType: DOCX,
      filename: "b.docx",
    });
    const expected =
      "Essay brief: social media and adolescent wellbeing\n\nArgue whether heavy social media use harms teenage mental health. Use sources from 2015 onwards.";
    expect(extractedText).toBe(expected);
    expect(content).toEqual({ kind: "text", text: expected, truncated: false });
  });

  it("decodes UTF-8 text, dropping a BOM and squashing blank lines", async () => {
    const data = new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...bytes("Line one\r\n\r\n\r\n\r\nLine two — café\r\n"),
    ]);
    const { content, extractedText } = await readBrief({
      data,
      mimeType: "text/plain",
      filename: "b.txt",
    });
    expect(extractedText).toBe("Line one\n\nLine two — café");
    expect(content).toEqual({
      kind: "text",
      text: "Line one\n\nLine two — café",
      truncated: false,
    });
  });

  it("cuts long text for the model but keeps all of it as extractedText", async () => {
    const long = "word ".repeat(MAX_BRIEF_CHARS / 2).trim();
    const { content, extractedText } = await readBrief({
      data: bytes(long),
      mimeType: "text/plain",
      filename: "b.txt",
    });
    expect(content).toMatchObject({ kind: "text", truncated: true });
    expect(content.kind === "text" ? content.text.length : 0).toBe(MAX_BRIEF_CHARS);
    expect(extractedText).toBe(long);
  });

  it.each([
    ["text/plain", "b.txt", new Uint8Array(0)],
    ["text/plain", "b.txt", bytes("  \n\t ")],
    [DOCX, "b.docx", new Uint8Array(0)],
  ])("treats an empty %s as no brief", async (mimeType, filename, data) => {
    expect(await readBrief({ data, mimeType, filename })).toEqual({
      content: { kind: "empty" },
      extractedText: "",
    });
  });

  it("treats a zero-byte PDF as no brief, with no text", async () => {
    expect(
      await readBrief({ data: new Uint8Array(0), mimeType: "application/pdf", filename: "b.pdf" }),
    ).toEqual({ content: { kind: "empty" }, extractedText: null });
  });

  it("rejects files over 10 MB", async () => {
    await expect(
      readBrief({
        data: new Uint8Array(MAX_BRIEF_BYTES + 1),
        mimeType: "application/pdf",
        filename: "b.pdf",
      }),
    ).rejects.toMatchObject({ name: "BriefInputError", reason: "too-large" });
  });

  it("rejects a .docx that isn't a Word file", async () => {
    await expect(
      readBrief({ data: bytes("just text"), mimeType: DOCX, filename: "b.docx" }),
    ).rejects.toMatchObject({ name: "BriefInputError", reason: "unreadable" });
  });

  it("rejects a .pdf without a PDF header", async () => {
    await expect(
      readBrief({ data: bytes("hello"), mimeType: "application/pdf", filename: "b.pdf" }),
    ).rejects.toMatchObject({ name: "BriefInputError", reason: "unreadable" });
  });
});
