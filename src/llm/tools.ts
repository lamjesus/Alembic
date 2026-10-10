// src/llm/tools.ts
import { tool } from "ai";
import { z } from "zod";
import { loadDeclared } from "../data/declared";

// Read-only: returns the user's live projects and areas. Not used in ingestion (list goes in instructions).
export const getDeclaredProjects = tool({
  description:
    "Returns the user's active projects and areas. Call it before classifying anything into PARA.",
  inputSchema: z.object({}),
  execute: async () => {
    return loadDeclared();
  },
});
