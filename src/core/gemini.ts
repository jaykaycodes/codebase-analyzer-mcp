import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

let client: GoogleGenAI | null = null;

/**
 * Resolve the Gemini API key from multiple sources:
 * 1. GEMINI_API_KEY env var (standard)
 * 2. ~/.config/codebase-analyzer/config.json (fallback for plugin installs)
 */
function resolveApiKey(): string | undefined {
  // 1. Environment variable (works for ~/.mcp.json and CLI usage)
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  // 2. Config file fallback (works for plugin installs where env vars don't propagate)
  try {
    const configPath = join(homedir(), ".config", "codebase-analyzer", "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    if (config.geminiApiKey) {
      return config.geminiApiKey;
    }
  } catch {
    // Config file doesn't exist or is invalid — that's fine
  }

  return undefined;
}

/**
 * Check if a Gemini API key is available without throwing.
 */
export function hasGeminiKey(): boolean {
  return !!resolveApiKey();
}

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = resolveApiKey();
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY not found. Set it up using one of these methods:\n\n" +
        "Option 1: Config file (recommended for plugin installs):\n" +
        "  mkdir -p ~/.config/codebase-analyzer\n" +
        '  echo \'{"geminiApiKey":"your_key"}\' > ~/.config/codebase-analyzer/config.json\n\n' +
        "Option 2: MCP server env (for ~/.mcp.json installs):\n" +
        '  "env": { "GEMINI_API_KEY": "your_key" }\n\n' +
        "Get a free key at https://aistudio.google.com/apikey"
      );
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

/**
 * Check if an error is retryable (rate limiting, temporary failure)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Rate limiting
    if (message.includes("429") || message.includes("rate limit") || message.includes("quota")) {
      return true;
    }
    // Temporary server errors
    if (message.includes("500") || message.includes("502") || message.includes("503") || message.includes("504")) {
      return true;
    }
    // Network errors
    if (message.includes("network") || message.includes("timeout") || message.includes("econnreset")) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateDelay(attempt: number): number {
  const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, MAX_DELAY_MS);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  context: string = "API call"
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        const delay = calculateDelay(attempt);
        console.error(
          `[Gemini] ${context} failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay)}ms: ${lastError.message}`
        );
        await sleep(delay);
      } else {
        break;
      }
    }
  }

  throw lastError || new Error(`${context} failed after ${MAX_RETRIES + 1} attempts`);
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

  return withRetry(async () => {
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
  }, "generateWithGemini");
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

  return withRetry(async () => {
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
  }, "generateJsonWithGemini");
}
