import "dotenv/config";
import { readFileSync } from "node:fs";
import { FinishReason, generateText, LanguageModelUsage, streamText } from "ai";
import { models } from "./llm/provider";
import { SAVE_INSTRUCTIONS } from "./llm/prompts";

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

await ask(readFileSync("samples/article.txt", "utf8"), SAVE_INSTRUCTIONS);

