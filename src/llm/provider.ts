// src/llm/provider.ts

import { createOpenAI } from "@ai-sdk/openai";

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

// /chat/completions, not /responses: NaN recommends it and may retire /responses,
// and only this endpoint forwards `seed` (needed to repeat eval runs).
const nanModel = (modelId: NaNModelId) => NaNProvider.chat(modelId);

export const models = {
  saveModel: nanModel("mimo-v2.6-flash"),
  queryModel: nanModel("glm5.3-flash"),
};
