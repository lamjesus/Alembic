import "dotenv/config";
import { readFileSync } from "node:fs";
import { generateText, Output } from "ai";
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

type DistillResult =
  | { status: "skipped"; review: ReviewDecision }
  | { status: "distilled"; distillation: Distillation; review: ReviewDecision };

async function distill(content: string): Promise<DistillResult> {
  const inputReasons = checkInput(content);
  if (inputReasons.length > 0) {
    return { status: "skipped", review: decideReview(inputReasons) };
  }

  try {
    // Part C, option "instructions": the declared list goes in the trusted instructions,
    // never in the prompt (the prompt is external content). If loading fails, it throws here.
    const declared = loadDeclared();
    const result = await generateText({
      model: models.saveModel,
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
    console.error(error);
    throw new Error("Failed to distill content", { cause: error });
  }
}

const distilled = await distill(readFileSync("samples/article.txt", "utf8"));
console.dir(distilled, { depth: null });
