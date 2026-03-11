// Client-safe model constants — no SDK instantiation here

export const DEFAULT_MODEL = "llama-3.1-8b-instant";

export const SELECTABLE_MODELS = [
  {
    id: "llama-3.1-8b-instant",
    label: "Fast",
    description: "llama-3.1-8b-instant · 128K context · best for high-volume ingestion",
  },
  {
    id: "llama-3.3-70b-versatile",
    label: "Quality",
    description: "llama-3.3-70b-versatile · 128K context · deeper reasoning, slower",
  },
] as const;
