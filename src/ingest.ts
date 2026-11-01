// ingest(): turns a source (URL or local PDF path) into text and hands it to distill().
// Spec by the author (lesson 009, Part C, 2026-11-01):
// - v1 stores only text, hash and source in a JSON file. The original file is not stored.
// - The hash is SHA-256 of the extracted text with whitespace collapsed.
// - Same source + same hash -> "unchanged", distill() is not called.
// - Same source + different hash -> the stored entry is overwritten.
// - Fewer than MIN_CHARS characters of text -> failed. HTTP 403 -> "blocked".
// - A host in UNSUPPORTED_HOSTS (YouTube) -> "unsupported-source", before any request.
// - A failure carries a fixed `reason` (counted by type), a free-text `detail` and a `nextStep`.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { extractText, getDocumentProxy } from "unpdf";
import { distill } from "./index";

type DistillResult = Awaited<ReturnType<typeof distill>>;
type NextStep = "retry-later" | "manual-review";

export const MIN_CHARS = 100;

// Hosts v1 does not ingest (video pages have no readable text). Maintained by hand.
const UNSUPPORTED_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];

// The single place that lists every failure type. The type below is derived from it.
export const FAILURE_REASONS = [
  "http-error",
  "blocked",
  "unsupported-source",
  "too-short",
  "no-text-layer",
  "unsupported-type",
  "fetch-error",
  "other",
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

export type IngestResult =
  | { status: "unchanged"; source: string; hash: string }
  | { status: "failed"; reason: FailureReason; detail: string; nextStep: NextStep }
  | DistillResult;

type Stored = { source: string; hash: string; text: string };
type Store = Record<string, Stored>;

type Options = {
  storePath?: string;
  model?: Parameters<typeof distill>[1];
  declaredPath?: string;
  // Injectable so a test can check that distill() was (not) called without a real model call.
  distillFn?: typeof distill;
};

class IngestFailure extends Error {
  constructor(
    readonly reason: FailureReason,
    readonly detail: string,
    readonly nextStep: NextStep,
  ) {
    super(detail);
  }
}

export function hashText(text: string): string {
  return createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex");
}

// charset from the content-type; else the <meta charset> in the first bytes; else UTF-8
function decodeHtml(bytes: Uint8Array, contentType?: string): string {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 2048));
  const charset =
    contentType?.match(/charset=([\w-]+)/i)?.[1] ??
    head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ??
    "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

const isUrl = (source: string) => /^https?:\/\//i.test(source);

async function load(source: string): Promise<{ bytes: Uint8Array; kind: "html" | "pdf"; contentType?: string }> {
  if (isUrl(source)) {
    const host = new URL(source).hostname.toLowerCase();
    if (UNSUPPORTED_HOSTS.includes(host)) {
      throw new IngestFailure("unsupported-source", host, "manual-review");
    }
    let res: Response;
    try {
      res = await fetch(source);
    } catch (error) {
      throw new IngestFailure("fetch-error", (error as Error).message, "retry-later");
    }
    if (res.status === 403) {
      throw new IngestFailure("blocked", "HTTP 403", "manual-review");
    }
    if (res.status < 200 || res.status > 299) {
      const nextStep = res.status >= 500 || res.status === 429 ? "retry-later" : "manual-review";
      throw new IngestFailure("http-error", `HTTP ${res.status}`, nextStep);
    }
    const contentType = res.headers.get("content-type") ?? "";
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (contentType.includes("application/pdf")) return { bytes, kind: "pdf", contentType };
    if (/text\/html|application\/xhtml/.test(contentType)) return { bytes, kind: "html", contentType };
    throw new IngestFailure("unsupported-type", contentType || "no content-type", "manual-review");
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await readFile(source));
  } catch (error) {
    throw new IngestFailure("other", (error as Error).message, "manual-review");
  }
  if (new TextDecoder().decode(bytes.slice(0, 4)) === "%PDF") return { bytes, kind: "pdf" };
  if (/\.html?$/i.test(source)) return { bytes, kind: "html" };
  throw new IngestFailure("unsupported-type", "local file is not a PDF or .html", "manual-review");
}

async function extract(source: string): Promise<string> {
  const { bytes, kind, contentType } = await load(source);
  let text: string;
  try {
    if (kind === "html") {
      const { document } = parseHTML(decodeHtml(bytes, contentType));
      // Readability returns null when it finds no article: treated as empty text
      text = new Readability(document).parse()?.textContent ?? "";
    } else {
      text = (await extractText(await getDocumentProxy(bytes), { mergePages: true })).text;
    }
  } catch (error) {
    throw new IngestFailure("other", (error as Error).message, "manual-review");
  }
  if (text.length < MIN_CHARS) {
    const reason = kind === "pdf" ? "no-text-layer" : "too-short";
    throw new IngestFailure(reason, `${text.length} characters`, "manual-review");
  }
  return text;
}

function readStore(storePath: string): Store {
  try {
    return JSON.parse(readFileSync(storePath, "utf8")) as Store;
  } catch {
    return {};
  }
}

export async function ingest(source: string, options: Options = {}): Promise<IngestResult> {
  const storePath = options.storePath ?? "samples/ingested.json";
  const distillFn = options.distillFn ?? distill;

  let text: string;
  try {
    text = await extract(source);
  } catch (error) {
    if (error instanceof IngestFailure) {
      return { status: "failed", reason: error.reason, detail: error.detail, nextStep: error.nextStep };
    }
    throw error;
  }

  const hash = hashText(text);
  const store = readStore(storePath);
  if (store[source]?.hash === hash) {
    return { status: "unchanged", source, hash };
  }

  const result = await distillFn(text, options.model, options.declaredPath);
  // Saved only after distill() did not fail: otherwise a retry would find the hash and answer "unchanged".
  if (result.status !== "failed") {
    store[source] = { source, hash, text };
    mkdirSync(dirname(storePath), { recursive: true });
    writeFileSync(storePath, JSON.stringify(store, null, 2));
  }
  return result;
}
