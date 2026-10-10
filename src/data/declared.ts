import { readFileSync } from "node:fs";
import type { z } from "zod";
import { DeclaredSchema } from "../llm/schemas";

export type Declared = z.infer<typeof DeclaredSchema>;

const DECLARED_PATH = "src/data/declared.json";

// Only live projects reach the model: closed ones (DONE, CANCELLED) are filtered here, in code.
const LIVE_STATUSES: ReadonlySet<Declared["projects"][number]["status"]> = new Set([
  "IN_PROGRESS",
  "BLOCKED",
  "POSTPONED",
]);

// Reads, validates and filters the user's declared projects and areas.
// Any failure throws: the caller decides what to do, nothing fails silently.
export function loadDeclared(): Declared {
  let raw: string;
  try {
    raw = readFileSync(DECLARED_PATH, "utf8");
  } catch (error) {
    throw new Error(`Cannot read ${DECLARED_PATH}`, { cause: error });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${DECLARED_PATH} is not valid JSON`, { cause: error });
  }

  const result = DeclaredSchema.safeParse(json);
  if (!result.success) {
    throw new Error(`${DECLARED_PATH} does not match DeclaredSchema`, {
      cause: result.error,
    });
  }

  return {
    ...result.data,
    projects: result.data.projects.filter((p) => LIVE_STATUSES.has(p.status)),
  };
}
