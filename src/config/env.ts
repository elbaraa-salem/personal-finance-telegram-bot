import dotenv from "dotenv";

dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`❌ ${name} is not defined in .env`);
  }

  return value;
}

function getVoiceTranscribeProvider(): "groq" {
  const value = process.env.VOICE_TRANSCRIBE_PROVIDER;

  if (value && value !== "groq") {
    console.warn("VOICE_TRANSCRIBE_PROVIDER only supports groq. Falling back to groq.");
  }

  return "groq";
}

function getOptionalAiProvider(
  value: string | undefined,
  defaultValue: "none" | "openrouter" | "groq"
): "none" | "openrouter" | "groq" {
  if (value === "groq" || value === "openrouter") {
    return value;
  }

  return defaultValue;
}

function getOptionalNumberEnv(name: string, defaultValue: number): number {
  const value = process.env[name];

  if (!value) {
    return defaultValue;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : defaultValue;
}

export const config = {
  botToken: getRequiredEnv("BOT_TOKEN"),
  mongoUri: getRequiredEnv("MONGO_URI"),

  useProxy: process.env.USE_PROXY === "true",
  socksProxyUrl: process.env.SOCKS_PROXY_URL,
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? "RUB",
  appTimezone: process.env.APP_TIMEZONE ?? "Asia/Tomsk",
  aiProvider: getOptionalAiProvider(process.env.AI_PROVIDER, "openrouter"),
  aiFallbackProvider: getOptionalAiProvider(process.env.AI_FALLBACK_PROVIDER, "none"),
  aiApiKey: process.env.AI_API_KEY,
  aiModel: process.env.AI_MODEL,
  aiBaseUrl: process.env.AI_BASE_URL ?? "https://openrouter.ai/api/v1",
  aiRequestTimeoutMs: getOptionalNumberEnv("AI_REQUEST_TIMEOUT_MS", 30_000),
  requireTextAiConfirmation: process.env.REQUIRE_TEXT_AI_CONFIRMATION === "true",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  receiptProvider: process.env.RECEIPT_PROVIDER,
  receiptAiProvider: getOptionalAiProvider(process.env.RECEIPT_AI_PROVIDER, "none"),
  receiptAiFallbackProvider: getOptionalAiProvider(process.env.RECEIPT_AI_FALLBACK_PROVIDER, "none"),
  receiptAiTimeoutMs: getOptionalNumberEnv("RECEIPT_AI_TIMEOUT_MS", 30_000),
  proverkachekaToken: process.env.PROVERKACHEKA_TOKEN,
  proverkachekaBaseUrl: process.env.PROVERKACHEKA_BASE_URL ?? "https://proverkacheka.com/api/v1",
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
  openrouterChatModel: process.env.OPENROUTER_CHAT_MODEL ?? process.env.AI_MODEL,
  openrouterReceiptModel:
    process.env.OPENROUTER_RECEIPT_MODEL ??
    process.env.OPENROUTER_CHAT_MODEL ??
    process.env.AI_MODEL,
  openrouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  qrDebug: process.env.QR_DEBUG === "true",
  voiceInputEnabled: process.env.VOICE_INPUT_ENABLED === "true",
  voiceShowRecognizedText: process.env.VOICE_SHOW_RECOGNIZED_TEXT === "true",
  voiceMaxDurationSeconds: getOptionalNumberEnv("VOICE_MAX_DURATION_SECONDS", 15),
  voiceTranscribeProvider: getVoiceTranscribeProvider(),
  groqApiKey: process.env.GROQ_API_KEY,
  groqChatModel: process.env.GROQ_CHAT_MODEL ?? "llama-3.1-8b-instant",
  groqTranscribeModel: process.env.GROQ_TRANSCRIBE_MODEL ?? "whisper-large-v3-turbo",
  groqTranscribeLanguage: process.env.GROQ_TRANSCRIBE_LANGUAGE?.trim() || undefined,
};

if (config.useProxy && !config.socksProxyUrl) {
  throw new Error("❌ SOCKS_PROXY_URL is required when USE_PROXY=true");
}
