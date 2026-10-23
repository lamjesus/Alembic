import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { APICallError, generateText, Output, RetryError, type LanguageModel } from "ai";
import { models } from "./llm/provider";
import { SAVE_INSTRUCTIONS } from "./llm/prompts";
import { DistillationSchema } from "./llm/schemas";
import {
  checkInput,
  checkOutput,
  decideReview,
  type Distillation,
  type ReviewDecision,
} from "./utils/review";
import { loadDeclared } from "./data/declared";

type NextStep = "retry-later" | "manual-review" | "fix-config";

type DistillResult =
  | { status: "skipped"; review: ReviewDecision }
  | { status: "distilled"; distillation: Distillation; review: ReviewDecision }
  | { status: "failed"; nextStep: NextStep; error: Error };

const NEXT_STEP_BY_STATUS: Record<number, NextStep> = {
  429: "retry-later",
  500: "retry-later",
  400: "manual-review",
  406: "manual-review",
  401: "fix-config",
};

// Maps an SDK error to a next step. undefined = status not mapped: the caller rethrows.
// A RetryError carries the status in its last attempt (lastError); an APICallError carries it directly.
function classifyFailure(error: unknown): NextStep | undefined {
  const apiError = RetryError.isInstance(error) ? error.lastError : error;
  if (!APICallError.isInstance(apiError) || apiError.statusCode === undefined) {
    return undefined;
  }
  return NEXT_STEP_BY_STATUS[apiError.statusCode];
}

export async function distill(
  content: string,
  model: LanguageModel = models.saveModel,
  declaredPath?: string,
): Promise<DistillResult> {
  const inputReasons = checkInput(content);
  if (inputReasons.length > 0) {
    return { status: "skipped", review: decideReview(inputReasons) };
  }

  // Part C, option "instructions": the declared list goes in the trusted instructions,
  // never in the prompt (the prompt is external content). Own try: a failure here is local config.
  let declared: ReturnType<typeof loadDeclared>;
  try {
    declared = loadDeclared(declaredPath);
  } catch (error) {
    return { status: "failed", nextStep: "fix-config", error: error as Error };
  }

  try {
    const result = await generateText({
      model,
      prompt: content,
      instructions: `${SAVE_INSTRUCTIONS}\nUser's declared projects and areas (JSON):\n${JSON.stringify(declared)}`,
      output: Output.object({ schema: DistillationSchema }),
    });
    const review = decideReview(
      checkOutput(result.output, result.finishReason),
    );
    console.log("stop reason\n", result.finishReason);
    console.log("steps \n", result.steps.length);
    return { status: "distilled", distillation: result.output, review };
  } catch (error) {
    const nextStep = classifyFailure(error);
    if (nextStep) {
      return { status: "failed", nextStep, error: error as Error };
    }
    console.error(error);
    throw new Error("Failed to distill content", { cause: error });
  }
}

// The real caller will store/stop per next step later; for now it only says what it would do.
const ACTION_BY_NEXT_STEP: Record<NextStep, string> = {
  "retry-later": "would save the article to retry later",
  "manual-review": "would save the article for manual review",
  "fix-config": "would stop everything: fix your config (key or declared.json)",
};

// Only when run directly (yarn start): importing distill() from evals or probes must not trigger a real call.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const distilled = await distill(readFileSync("samples/article.txt", "utf8"));
  if (distilled.status === "failed") {
    console.error(`failed (${distilled.nextStep}): ${ACTION_BY_NEXT_STEP[distilled.nextStep]}`);
    console.error(distilled.error.message);
  } else {
    console.dir(distilled, { depth: null });
  }
}


