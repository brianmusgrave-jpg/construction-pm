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
export type AIProvider = "OPENAI" | "ANTHROPIC" | "GROQ";

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
  /** Organization ID for quota checking and token tracking (Sprint 16). */
  orgId?: string;
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
  // Groq
  "llama-3.3-70b-versatile": [0.59, 0.79],
  "llama-3.1-8b-instant": [0.05, 0.08],
  "whisper-large-v3": [0.111, 0], // per-hour rate, input only
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

// ── Groq request ─────────────────────────────────────────────────────────

/**
 * Make a chat completion request to the Groq API.
 * Uses the OpenAI-compatible endpoint format.
 */
async function callGroq(
  messages: AIMessage[],
  model: string,
  maxTokens: number,
  temperature: number
): Promise<AIResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { text: null, success: false, error: "GROQ_API_KEY not configured", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, costUsd: 0 };
  }

  let raw: Response;
  try {
    raw = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
    return { text: null, success: false, error: `Groq ${raw.status}: ${body.slice(0, 200)}`, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, costUsd: 0 };
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

// ── Groq Whisper transcription ───────────────────────────────────────────

/** Result from transcribing audio via Groq Whisper. */
export interface TranscriptionResult {
  text: string;
  language: string;
  success: boolean;
  error?: string;
}

/**
 * Transcribe audio using Groq Whisper Large v3.
 * Falls back to OpenAI Whisper if Groq key isn't configured.
 *
 * @param audioBlob - Raw audio data (WebM/Opus, mp3, wav, etc.)
 * @param languageHint - Optional ISO-639-1 language hint (e.g. "es", "pt")
 * @returns Transcript text and detected language
 */
export async function transcribeAudio(
  audioBlob: Blob,
  languageHint?: string
): Promise<TranscriptionResult> {
  // Try Groq first (164x realtime, cheapest)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "memo.webm");
      formData.append("model", "whisper-large-v3");
      formData.append("response_format", "verbose_json");
      if (languageHint) formData.append("language", languageHint);

      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        return {
          text: data.text ?? "",
          language: data.language ?? languageHint ?? "en",
          success: true,
        };
      }
      // If Groq fails, fall through to OpenAI
      console.warn("Groq Whisper failed, falling back to OpenAI:", res.status);
    } catch (err) {
      console.warn("Groq Whisper error, falling back to OpenAI:", err);
    }
  }

  // Fallback: OpenAI Whisper
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return { text: "", language: "en", success: false, error: "No transcription API key configured (GROQ_API_KEY or OPENAI_API_KEY)" };
  }

  try {
    const formData = new FormData();
    formData.append("file", audioBlob, "memo.webm");
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    if (languageHint) formData.append("language", languageHint);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.text();
      return { text: "", language: "en", success: false, error: `OpenAI Whisper ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = await res.json();
    return {
      text: data.text ?? "",
      language: data.language ?? languageHint ?? "en",
      success: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Transcription network error";
    return { text: "", language: "en", success: false, error: msg };
  }
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

  // Sprint 16: Check org AI quota (plan gating + token budget)
  if (options.orgId) {
    try {
      const { checkAIQuota } = await import("@/lib/ai-quota");
      await checkAIQuota(options.orgId);
    } catch (err: any) {
      return {
        text: null,
        success: false,
        error: err.message || "ai_quota_exceeded",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        costUsd: 0,
      };
    }
  }

  const provider: AIProvider = options.provider ?? (settings.provider as AIProvider);
  const model = options.model ?? settings.model;
  const maxTokens = options.maxTokens ?? settings.maxTokens;
  const temperature = options.temperature ?? 0.3;

  // Route to the appropriate provider
  let response: AIResponse;
  switch (provider) {
    case "ANTHROPIC":
      response = await callAnthropic(messages, model, maxTokens, temperature);
      break;
    case "GROQ":
      response = await callGroq(messages, model, maxTokens, temperature);
      break;
    default:
      response = await callOpenAI(messages, model, maxTokens, temperature);
  }

  // Sprint 16: Track token usage against org budget (fire-and-forget)
  if (options.orgId && response.success && response.usage.totalTokens > 0) {
    import("@/lib/ai-quota").then(({ trackAITokenUsage }) =>
      trackAITokenUsage(options.orgId!, response.usage.totalTokens)
    ).catch(() => {});
  }

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
