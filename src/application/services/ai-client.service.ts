export type AiChatProvider = "groq" | "openrouter";
export type OptionalAiChatProvider = AiChatProvider | "none";

type ProviderSettings = {
  groqApiKey: string | undefined;
  groqModel: string | undefined;
  openrouterApiKey: string | undefined;
  openrouterModel: string | undefined;
  openrouterBaseUrl: string;
};

type ChatWithFallbackOptions<T> = ProviderSettings & {
  prompt: string;
  primaryProvider: OptionalAiChatProvider;
  fallbackProvider: OptionalAiChatProvider;
  timeoutMs: number;
  logPrefix: string;
  validateContent: (content: string, provider: AiChatProvider) => T;
};

export type ChatWithFallbackResult<T> =
  | {
      ok: true;
      value: T;
      provider: AiChatProvider;
      usedFallback: boolean;
    }
  | {
      ok: false;
      error: string;
    };

type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: unknown;
};

function truncateForLog(value: string, maxLength = 4000): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: abortController.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function callChatProvider(
  provider: AiChatProvider,
  prompt: string,
  settings: ProviderSettings,
  timeoutMs: number
): Promise<string> {
  const isGroq = provider === "groq";
  const apiKey = isGroq ? settings.groqApiKey : settings.openrouterApiKey;
  const model = isGroq ? settings.groqModel : settings.openrouterModel;
  const url = isGroq
    ? "https://api.groq.com/openai/v1/chat/completions"
    : `${settings.openrouterBaseUrl.replace(/\/$/, "")}/chat/completions`;

  if (!apiKey) {
    throw new Error(`${provider} API key is missing.`);
  }

  if (!model) {
    throw new Error(`${provider} model is missing.`);
  }

  let response: Response;

  try {
    response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0,
          response_format: {
            type: "json_object",
          },
        }),
      },
      timeoutMs
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${provider} request timed out after ${timeoutMs}ms.`);
    }

    throw error;
  }

  const responseText = await response.text();

  if (!response.ok) {
    console.warn(`${provider} AI request failed: HTTP ${response.status}`);
    console.warn(`${provider} AI response body:\n${truncateForLog(responseText)}`);
    throw new Error(`${provider} AI request failed with HTTP ${response.status}.`);
  }

  let data: ChatResponse;

  try {
    data = JSON.parse(responseText) as ChatResponse;
  } catch (error) {
    console.warn(`${provider} AI response JSON parse failed:`, error);
    console.warn(`${provider} AI raw response:\n${truncateForLog(responseText)}`);
    throw new Error(`${provider} AI response was invalid JSON.`);
  }

  if (data.error) {
    console.warn(`${provider} AI response contained an error:`, data.error);
    throw new Error(`${provider} AI response contained an error.`);
  }

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`${provider} AI returned an empty response.`);
  }

  return content;
}

export function extractJson(text: string): string {
  const trimmedText = text.trim();

  if (trimmedText.startsWith("```")) {
    return trimmedText
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
  }

  const firstBraceIndex = trimmedText.indexOf("{");
  const lastBraceIndex = trimmedText.lastIndexOf("}");

  if (
    firstBraceIndex === -1 ||
    lastBraceIndex === -1 ||
    lastBraceIndex <= firstBraceIndex
  ) {
    throw new Error("AI did not return JSON.");
  }

  return trimmedText.slice(firstBraceIndex, lastBraceIndex + 1);
}

export async function callChatWithFallback<T>(
  options: ChatWithFallbackOptions<T>
): Promise<ChatWithFallbackResult<T>> {
  const providers = [options.primaryProvider, options.fallbackProvider].filter(
    (provider, index, values): provider is AiChatProvider =>
      provider !== "none" && values.indexOf(provider) === index
  );

  if (providers.length === 0) {
    return {
      ok: false,
      error: "No AI provider configured.",
    };
  }

  console.info(`${options.logPrefix} provider: ${options.primaryProvider}`);
  console.info(`${options.logPrefix} fallback provider: ${options.fallbackProvider}`);

  let lastError = "";

  for (const provider of providers) {
    const usedFallback = provider !== options.primaryProvider;

    try {
      const content = await callChatProvider(provider, options.prompt, options, options.timeoutMs);
      const value = options.validateContent(content, provider);

      console.info(
        `${options.logPrefix} ${usedFallback ? "fallback" : "primary"} succeeded: ${provider}`
      );

      return {
        ok: true,
        value,
        provider,
        usedFallback,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.warn(
        `${options.logPrefix} ${usedFallback ? "fallback" : "primary"} failed: ${lastError}`
      );
    }
  }

  return {
    ok: false,
    error: lastError || "All AI providers failed.",
  };
}
