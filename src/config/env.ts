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

function getAiProvider(): "openrouter" | "groq" {
  const value = process.env.AI_PROVIDER;

  return value === "groq" ? "groq" : "openrouter";
}

export const config = {
  botToken: getRequiredEnv("BOT_TOKEN"),
  mongoUri: getRequiredEnv("MONGO_URI"),

  useProxy: process.env.USE_PROXY === "true",
  socksProxyUrl: process.env.SOCKS_PROXY_URL,
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? "RUB",
  appTimezone: process.env.APP_TIMEZONE ?? "Asia/Tomsk",
  aiProvider: getAiProvider(),
  aiApiKey: process.env.AI_API_KEY,
  aiModel: process.env.AI_MODEL,
  aiBaseUrl: process.env.AI_BASE_URL ?? "https://openrouter.ai/api/v1",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  receiptProvider: process.env.RECEIPT_PROVIDER,
  proverkachekaToken: process.env.PROVERKACHEKA_TOKEN,
  proverkachekaBaseUrl: process.env.PROVERKACHEKA_BASE_URL ?? "https://proverkacheka.com/api/v1",
  qrDebug: process.env.QR_DEBUG === "true",
  voiceInputEnabled: process.env.VOICE_INPUT_ENABLED === "true",
  voiceTranscribeProvider: getVoiceTranscribeProvider(),
  groqApiKey: process.env.GROQ_API_KEY,
  groqChatModel: process.env.GROQ_CHAT_MODEL ?? "llama-3.1-8b-instant",
  groqTranscribeModel: process.env.GROQ_TRANSCRIBE_MODEL ?? "whisper-large-v3-turbo",
  groqTranscribeLanguage: process.env.GROQ_TRANSCRIBE_LANGUAGE?.trim() || undefined,
};

if (config.useProxy && !config.socksProxyUrl) {
  throw new Error("❌ SOCKS_PROXY_URL is required when USE_PROXY=true");
}
