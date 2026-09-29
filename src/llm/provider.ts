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

const NaNProvider = createOpenAI({
  baseURL: process.env.NAN_BASE_URL,
  apiKey: process.env.NAN_API_KEY,
});

export const models = {
  saveModel: NaNProvider("mimo-v2.6-flash"),
  queryModel: NaNProvider("glm5.3-flash"),
};
