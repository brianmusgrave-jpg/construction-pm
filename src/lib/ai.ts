/**
 * @file src/lib/ai.ts
 * @description Core AI provider abstraction for Construction PM.
 *
 * Provides a single `callAI()` entry point that routes to OpenAI or Anthropic
 * depending on the active AISettings configuration. Handles:
 *   - Provider-agnostic message format (role + content pairs)
 *   - Token usage extraction from both provider response shapes
 *   - Cost estimation based on published per-token pricing
 *   - Fire-and-forget usage logging to AIUsageLog via `logAIUsage()`
 *
 * Usage tracking intentionally does NOT await the log write so callers are
 * never delayed by a DB write. If logging fails it is swallowed silently —
 * cost tracking is best-effort, not a gate on AI availability.
 *
 * No SDK dependencies — uses native `fetch()` so no extra packages are needed.
 */

// ── Types ──────────────────────────────────────────────────────────────────

/** AI provider identifier — matches the Prisma AIProvider enum. */
export type AIProvider = "OPENAI" | "ANTHROPIC";

/** A single message in a conversation, following the OpenAI chat format. */
export interface AIMessage {
  /** Conversation role. Use "system" for instructions, "user" for input. */
  role: "system" | "user" | "assistant";
  /** Plain-text content of the message. */
  content: string;
}

/** Optional per-call overrides for the AI request. */
export interface AIOptions {
  /** Override the provider for this call only. Defaults to AISettings.provider. */
  provider?: AIProvider;
  /** Override the model for this call only. Defaults to AISettings.model. */
  model?: string;
  /** Override max tokens for this call. Defaults to AISettings.maxTokens. */
  maxTokens?: number;
  /** Sampling temperature — lower = more deterministic. Defaults to 0.3. */
  temperature?: number;
  /** Feature label written to AIUsageLog for dashboard breakdowns. */
  feature?: string;
  /** User ID for usage attribution. Omit to skip usage logging. */
  userId?: string;
}

/** Structured response returned by `callAI()`. */
export interface AIResponse {
  /** The completion text, or null if the call failed. */
  text: string | null;
  /** Whether the API call succeeded. */
  success: boolean;
  /** Human-readable error message when success is false. */
  error?: string;
  /** Token counts as reported by the provider. */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Estimated USD cost for this call. */
  costUsd: number;
}

// ── Pricing table ─────────────────────────────────────────────────────────

/**
 * Per-million-token prices (USD) for supported models.
 * Prices are approximate — update when providers change their pricing.
 * Format: [input_price_per_M_tokens, output_price_per_M_tokens]
 */
const MODEL_PRICING: Record<string, [number, number]> = {
  // OpenAI
  "gpt-4o-mini": [0.15, 0.6],
  "gpt-4o": [2.5, 10.0],
  "gpt-4-turbo": [10.0, 30.0],
  // Anthropic
  "claude-3-haiku-20240307": [0.25, 1.25],
  "claude-3-5-sonnet-20241022": [3.0, 15.0],
  "claude-3-5-haiku-20241022": [0.8, 4.0],
  "claude-3-opus-20240229": [15.0, 75.0],
};

/**
 * Estimate the USD cost for a given token count and model.
 * Falls back to a conservative default if the model isn't in the pricing table.
 *
 * @param promptTokens - Input token count
 * @param completionTokens - Output token count
 * @param model - Model identifier string
 * @returns Estimated cost in USD
 */
export function estimateCost(
  promptTokens: number,
  completionTokens: number,
  model: string
): number {
  // Strip provider-appended version suffixes for lookup (e.g. "gpt-4o-mini-2024-07-18" → "gpt-4o-mini")
  const baseModel = Object.keys(MODEL_PRICING).find((k) => model.startsWith(k));
  const [inPrice, outPrice] = MODEL_PRICING[baseModel ?? "gpt-4o-mini"];
  return (promptTokens * inPrice + completionTokens * outPrice) / 1_000_000;
}

// ── OpenAI request ────────────────────────────────────────────────────────

/**
 * Make a chat completion request to OpenAI.
 *
 * @param messages - Conversation messages
 * @param model - OpenAI model identifier
 * @param maxTokens - Token limit for the response
 * @param temperature - Sampling temperature
 * @returns Raw OpenAI API response object, or null on network failure
 */
async function callOpenAI(
  messages: AIMessage[],
  model: string,
  maxTokens: number,
  temperature: number
): Promise<AIResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { text: null, success: false, error: "OPENAI_API_KEY not configured", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, costUsd: 0 };
  }

  let raw: Response;
  try {
    raw = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { text: null, success: false, error: msg, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, costUsd: 0 };
  }

  if (!raw.ok) {
    const body = await raw.text();
    return { text: null, success: false, error: `OpenAI ${raw.status}: ${body.slice(0, 200)}`, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, costUsd: 0 };
  }

  const data = await raw.json();
  const promptTokens: number = data.usage?.prompt_tokens ?? 0;
  const completionTokens: number = data.usage?.completion_tokens ?? 0;
  const totalTokens: number = data.usage?.total_tokens ?? 0;
  const text: string = data.choices?.[0]?.message?.content ?? "";

  return {
    text,
    success: true,
    usage: { promptTokens, completionTokens, totalTokens },
    costUsd: estimateCost(promptTokens, completionTokens, model),
  };
}

// ── Anthropic request ─────────────────────────────────────────────────────

/**
 * Make a message request to the Anthropic API.
 *
 * @param messages - Conversation messages (system messages extracted separately)
 * @param model - Anthropic model identifier
 * @param maxTokens - Token limit for the response
 * @param temperature - Sampling temperature
 * @returns Structured AIResponse
 */
async function callAnthropic(
  messages: AIMessage[],
  model: string,
  maxTokens: number,
  temperature: number
): Promise<AIResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { text: null, success: false, error: "ANTHROPIC_API_KEY not configured", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, costUsd: 0 };
  }

  // Anthropic separates system prompt from conversation messages
  const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
  const conversationMsgs = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  let raw: Response;
  try {
    raw = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemMsg || undefined,
        messages: conversationMsgs,
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { text: null, success: false, error: msg, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, costUsd: 0 };
  }

  if (!raw.ok) {
    const body = await raw.text();
    return { text: null, success: false, error: `Anthropic ${raw.status}: ${body.slice(0, 200)}`, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, costUsd: 0 };
  }

  const data = await raw.json();
  const promptTokens: number = data.usage?.input_tokens ?? 0;
  const completionTokens: number = data.usage?.output_tokens ?? 0;
  const totalTokens = promptTokens + completionTokens;
  const text: string = data.content?.[0]?.text ?? "";

  return {
    text,
    success: true,
    usage: { promptTokens, completionTokens, totalTokens },
    costUsd: estimateCost(promptTokens, completionTokens, model),
  };
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Call the configured AI provider and return a completion.
 *
 * Reads provider/model/maxTokens from AISettings in the DB (via a lazy import
 * of the settings action to avoid circular deps). Per-call overrides in `options`
 * take precedence over stored settings.
 *
 * If AI is globally disabled via AISettings.enabled = false, returns an error
 * immediately without making an API call.
 *
 * Usage is logged fire-and-forget when `options.userId` is provided.
 *
 * @param messages - The conversation to send to the AI
 * @param options - Optional per-call overrides and usage attribution
 * @returns Structured response with text, token counts, and cost
 */
export async function callAI(
  messages: AIMessage[],
  options: AIOptions = {}
): Promise<AIResponse> {
  // Lazy import to avoid circular: aiSettings → ai → aiSettings
  const { getAISettingsInternal } = await import("@/actions/aiSettings");
  const settings = await getAISettingsInternal();

  // Master kill-switch: return early if AI is globally disabled
  if (!settings.enabled) {
    return {
      text: null,
      success: false,
      error: "ai_disabled",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      costUsd: 0,
    };
  }

  const provider: AIProvider = options.provider ?? (settings.provider as AIProvider);
  const model = options.model ?? settings.model;
  const maxTokens = options.maxTokens ?? settings.maxTokens;
  const temperature = options.temperature ?? 0.3;

  // Route to the appropriate provider
  const response =
    provider === "ANTHROPIC"
      ? await callAnthropic(messages, model, maxTokens, temperature)
      : await callOpenAI(messages, model, maxTokens, temperature);

  // Fire-and-forget usage log — never block the caller on DB writes
  if (options.userId) {
    const { logAIUsageInternal } = await import("@/actions/aiSettings");
    logAIUsageInternal({
      userId: options.userId,
      provider,
      model,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
      costUsd: response.costUsd,
      feature: options.feature ?? "unknown",
      success: response.success,
    }).catch(() => {
      // Usage logging is best-effort — swallow silently
    });
  }

  return response;
}
