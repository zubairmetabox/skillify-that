import Groq from "groq-sdk";
export { DEFAULT_MODEL, SELECTABLE_MODELS } from "./groq-models";

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const GROQ_MODELS = {
  fast: "llama-3.1-8b-instant",
  balanced: "groq/compound",
  reasoning: "groq/compound",
} as const;
