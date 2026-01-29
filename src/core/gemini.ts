import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is required. Get one at https://aistudio.google.com/apikey"
      );
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export interface GeminiOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

// Available models (as of Jan 2026):
// - gemini-2.5-flash (stable, best price-performance) - DEFAULT
// - gemini-2.5-flash-lite (fastest, most cost-efficient)
// - gemini-2.5-pro (stable, most capable)
// - gemini-3-flash-preview (latest flash, preview)
// - gemini-3-pro-preview (latest pro, preview)
// See: https://ai.google.dev/gemini-api/docs/models
export const AVAILABLE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
] as const;

export type GeminiModel = (typeof AVAILABLE_MODELS)[number];

const DEFAULT_MODEL: GeminiModel = "gemini-3-flash-preview";
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

function getModel(override?: string): string {
  // Priority: explicit override > env var > default
  return override || process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

export async function generateWithGemini(
  prompt: string,
  options: GeminiOptions = {}
): Promise<string> {
  const genai = getClient();

  const model = getModel(options.model);
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  const maxOutputTokens = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

  const response = await genai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature,
      maxOutputTokens,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  return text;
}

export async function generateJsonWithGemini<T>(
  prompt: string,
  options: GeminiOptions = {}
): Promise<T> {
  const genai = getClient();

  const model = getModel(options.model);
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  const maxOutputTokens = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

  const jsonPrompt = `${prompt}

IMPORTANT: You must respond with ONLY valid JSON. No markdown code blocks, no explanations, no additional text. Just the raw JSON object.`;

  const response = await genai.models.generateContent({
    model,
    contents: jsonPrompt,
    config: {
      temperature,
      maxOutputTokens,
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim()) as T;
    }

    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as T;
    }

    throw new Error(`Failed to parse JSON response: ${text.slice(0, 200)}`);
  }
}
