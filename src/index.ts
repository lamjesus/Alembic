import "dotenv/config";
import { readFileSync } from "node:fs";
import {
  FinishReason,
  generateText,
  LanguageModelUsage,
  Output,
  streamText,
} from "ai";
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

type DistillResult =
  | { status: "skipped"; review: ReviewDecision }
  | { status: "distilled"; distillation: Distillation; review: ReviewDecision };

async function ask(
  prompt: string,
  instructions: string,
): Promise<{
  text: string;
  tokens: number | undefined;
  finishReason: FinishReason;
}> {
  const result = await generateText({
    model: models.saveModel,
    prompt,
    instructions,
  });
  console.log(result.text);
  console.log("finish reason", result.finishReason);
  console.log("usage", result.usage);
  return {
    text: result.text,
    tokens: result.usage.totalTokens,
    finishReason: result.finishReason,
  };
}

async function distill(content: string): Promise<DistillResult> {
  const inputReasons = checkInput(content);
  if (inputReasons.length > 0) {
    return { status: "skipped", review: decideReview(inputReasons) };
  }

  try {
    const result = await generateText({
      model: models.saveModel,
      prompt: content,
      instructions: SAVE_INSTRUCTIONS,
      output: Output.object({ schema: DistillationSchema }),
    });
    const review = decideReview(
      checkOutput(content, result.output, result.finishReason),
    );
    return { status: "distilled", distillation: result.output, review };
  } catch (error) {
    console.error(error);
    throw new Error("Failed to distill content", { cause: error });
  }
}

//await ask(readFileSync("samples/article.txt", "utf8"), SAVE_INSTRUCTIONS);
//const distilled = await distill(readFileSync("samples/article2.txt", "utf8"));
const distilled = await distill("Notas del hackathon de NaN");
console.dir(distilled, { depth: null });
