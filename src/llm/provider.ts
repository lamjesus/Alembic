// src/llm/provider.ts

import { createOpenAI, OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { defaultSettingsMiddleware, wrapLanguageModel } from "ai";

(() => {
  if (!process.env.NAN_BASE_URL) {
    throw new Error("Missing NAN_BASE_URL  config");
  }

  if (!process.env.NAN_API_KEY) {
    throw new Error("Missing NAN_API_KEY  config");
  }
})();
type NaNModelId = "mimo-v2.6-flash" | "glm5.3-flash";

const NaNProvider = createOpenAI({
  baseURL: process.env.NAN_BASE_URL,
  apiKey: process.env.NAN_API_KEY,
});

const nanModel = (modelId: NaNModelId) => {
  return wrapLanguageModel({
    model: NaNProvider(modelId),
    middleware: defaultSettingsMiddleware({
      settings: {
        providerOptions: {
          openai: { store: false } satisfies OpenAIResponsesProviderOptions,
        },
      },
    }),
  });
};

export const models = {
  saveModel: nanModel("mimo-v2.6-flash"),
  queryModel: nanModel("glm5.3-flash"),
};
