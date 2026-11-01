import { readFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { extractText, getDocumentProxy } from "unpdf";

const SOURCES: string[] = [
  "https://alphasignal.ai/news/ccore-s-qwen3-5-4b-3d-coder-turns-text-prompts-into-3d-browser-scenes",
  "https://cincodias.elpais.com/herramientas/calculadora-irpf/",
  "https://x.com/lam_jesus19/status/2110013991938666845",
  "https://x.com/lam_jesus19/status/2110013991938666845?a=lw0WN2zDqt5wbuxW9Mw&s=20",
  "https://www.elmundo.es/",
  "https://www.zeit.de/index",
  "https://www.reddit.com/r/programming/",
  // add a local PDF path here: it is read from disk and checked for a text layer
];

const MIN_CHARS = 100;

type Extracted = {
  kind: "html" | "pdf" | "unsupported";
  text: string;
  pages?: number;
  httpStatus?: number;
  contentType?: string;
};

const isUrl = (source: string) => /^https?:\/\//i.test(source);

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

async function extract(source: string): Promise<Extracted> {
  let bytes: Uint8Array;
  let kind: "html" | "pdf" | "unsupported";
  let httpStatus: number | undefined;
  let contentType: string | undefined;

  if (isUrl(source)) {
    // URL: decided by the response content-type
    const res = await fetch(source);
    httpStatus = res.status;
    contentType = res.headers.get("content-type") ?? "";
    bytes = new Uint8Array(await res.arrayBuffer());
    kind = contentType.includes("application/pdf")
      ? "pdf"
      : /text\/html|application\/xhtml/.test(contentType)
        ? "html"
        : "unsupported";
  } else {
    // local path: there is no content-type, so it is decided by the first bytes
    bytes = new Uint8Array(await readFile(source));
    kind =
      new TextDecoder().decode(bytes.slice(0, 4)) === "%PDF"
        ? "pdf"
        : /\.html?$/i.test(source)
          ? "html"
          : "unsupported";
  }

  if (kind === "unsupported") {
    return { kind, text: "", httpStatus, contentType };
  }

  if (kind === "html") {
    const { document } = parseHTML(decodeHtml(bytes, contentType));
    const article = new Readability(document).parse();
    // Readability returns null when it finds no article: treated as empty text
    return { kind, text: article?.textContent ?? "", httpStatus, contentType };
  }

  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  return { kind, text, pages: totalPages, httpStatus, contentType };
}

for (const source of SOURCES) {
  console.log("=".repeat(70));
  console.log(source);
  try {
    const { kind, text, pages, httpStatus, contentType } = await extract(source);
    console.log("kind:", kind);
    if (httpStatus !== undefined) console.log("http:", httpStatus, contentType);
    console.log("characters:", text.length);
    if (pages !== undefined) {
      console.log("pages:", pages);
      console.log("characters per page:", Math.round(text.length / pages));
    }
    console.log("first 300:", JSON.stringify(text.slice(0, 300)));
    if (kind === "unsupported") {
      console.log("VERDICT: failed, unsupported-type:", contentType ?? source);
    } else if (httpStatus === 403) {
      console.log("VERDICT: failed, blocked (HTTP 403)");
    } else if (httpStatus !== undefined && (httpStatus < 200 || httpStatus > 299)) {
      console.log("VERDICT: failed, http-error", httpStatus);
    } else if (text.length < MIN_CHARS) {
      console.log(`VERDICT: failed, ${kind === "pdf" ? "no-text-layer" : "too-short"}, fewer than ${MIN_CHARS} characters (${text.length})`);
    } else {
      console.log("VERDICT: ok");
    }
  } catch (error) {
    console.log("ERROR:", error instanceof Error ? error.message : error);
  }
}
