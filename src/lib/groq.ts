import Groq from "groq-sdk";

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const GROQ_MODELS = {
  fast: "llama-3.1-8b-instant",
  balanced: "llama-3.3-70b-versatile",
  reasoning: "deepseek-r1-distill-llama-70b",
} as const;
