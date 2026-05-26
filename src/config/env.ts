import dotenv from "dotenv";

dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`❌ ${name} is not defined in .env`);
  }

  return value;
}

export const config = {
  botToken: getRequiredEnv("BOT_TOKEN"),
  mongoUri: getRequiredEnv("MONGO_URI"),

  useProxy: process.env.USE_PROXY === "true",
  socksProxyUrl: process.env.SOCKS_PROXY_URL,
  defaultCurrency: process.env.DEFAULT_CURRENCY ?? "RUB",
  defaultTimezone: process.env.DEFAULT_TIMEZONE ?? "Europe/Moscow",
  aiProvider: process.env.AI_PROVIDER,
  aiApiKey: process.env.AI_API_KEY,
  aiModel: process.env.AI_MODEL,
  aiBaseUrl: process.env.AI_BASE_URL ?? "https://openrouter.ai/api/v1",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  receiptProvider: process.env.RECEIPT_PROVIDER,
  proverkachekaToken: process.env.PROVERKACHEKA_TOKEN,
  proverkachekaBaseUrl: process.env.PROVERKACHEKA_BASE_URL ?? "https://proverkacheka.com/api/v1",
};

if (config.useProxy && !config.socksProxyUrl) {
  throw new Error("❌ SOCKS_PROXY_URL is required when USE_PROXY=true");
}
