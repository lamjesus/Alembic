import "dotenv/config";
import { FinishReason, generateText, LanguageModelUsage, streamText } from "ai";
import { models } from "./llm/provider";

async function ask(
  prompt: string,
): Promise<{
  text: string;
  tokens: number | undefined;
  finishReason: FinishReason;
}> {
  const result = await generateText({
    model: models.distillModel,
    prompt,
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

async function askStream(prompt: string): Promise<{
  tokens: LanguageModelUsage;
  finishReason: FinishReason;
}> {
  const result = streamText({
    model: models.distillModel,
    prompt,
  });

  const start = Date.now();
  let ttft: number | undefined;
  for await (const chunk of result.textStream) {
    ttft ??= Date.now() - start;
    process.stdout.write(chunk);
  }
  const total = Date.now() - start;

  const usage = await result.usage;
  const finishReason = await result.finishReason;

  console.log("\nTTFT ms", ttft);
  console.log("total ms", total);
  console.log("finish reason", finishReason);
  console.log("usage", usage);

  return { tokens: usage, finishReason };
}

// Compara la experiencia de usuario
// To AI porque await aqui para que salga 1 despues d ela otra ?
await ask("¿Qué es RAG en una oración?");
//esta sale muy rapido deberia ser mas texto ?
await askStream("¿Qué es RAG en multiples lineas de texto ?");
