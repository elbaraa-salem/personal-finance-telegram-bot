import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../../config/env";

const groqTranscriptionEndpoint = "https://api.groq.com/openai/v1/audio/transcriptions";
const transcriptionTimeoutMs = 60_000;

export type VoiceTranscriptionResult = {
  text: string;
  language?: string;
  duration?: number;
  provider: "groq";
};

type GroqTranscriptionJson = {
  text?: unknown;
  language?: unknown;
  duration?: unknown;
  error?: unknown;
};

function truncateForLog(value: string, maxLength = 4000): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

export class VoiceTranscriptionService {
  async transcribe(audioFilePath: string): Promise<VoiceTranscriptionResult> {
    console.info("🎙️ Voice transcription provider: groq");
    console.info(`🎙️ Voice transcription endpoint: ${groqTranscriptionEndpoint}`);
    console.info(`🎙️ Groq transcription model: ${config.groqTranscribeModel}`);

    if (!config.groqApiKey) {
      console.error("🎙️ Groq transcription is configured but GROQ_API_KEY is missing.");
      return { text: "", provider: "groq" };
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), transcriptionTimeoutMs);

    try {
      const audioBuffer = await readFile(audioFilePath);
      const formData = new FormData();

      formData.append(
        "file",
        new Blob([new Uint8Array(audioBuffer)], { type: "audio/ogg" }),
        path.basename(audioFilePath)
      );
      formData.append("model", config.groqTranscribeModel);
      formData.append("response_format", "json");
      formData.append("temperature", "0");

      if (config.groqTranscribeLanguage) {
        formData.append("language", config.groqTranscribeLanguage);
      }

      const response = await fetch(groqTranscriptionEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.groqApiKey}`,
        },
        body: formData,
        signal: abortController.signal,
      });
      const responseBody = await response.text();

      if (!response.ok) {
        console.error(`🎙️ Groq transcription failed: HTTP ${response.status}`);
        console.error(`🎙️ Groq transcription response body:\n${truncateForLog(responseBody)}`);
        return { text: "", provider: "groq" };
      }

      let parsed: GroqTranscriptionJson;

      try {
        parsed = JSON.parse(responseBody) as GroqTranscriptionJson;
      } catch (error) {
        console.error("🎙️ Groq transcription JSON parse error:", error);
        console.error(`🎙️ Groq transcription raw response:\n${truncateForLog(responseBody)}`);
        return { text: "", provider: "groq" };
      }

      if (typeof parsed.error === "string" && parsed.error.trim()) {
        console.error(`🎙️ Groq transcription API error: ${parsed.error}`);
        return { text: "", provider: "groq" };
      }

      const transcription = {
        text: typeof parsed.text === "string" ? parsed.text.trim() : "",
        provider: "groq" as const,
        ...(typeof parsed.language === "string" && parsed.language
          ? { language: parsed.language }
          : {}),
        ...(typeof parsed.duration === "number" && Number.isFinite(parsed.duration)
          ? { duration: parsed.duration }
          : {}),
      };

      if (!transcription.text) {
        console.error("🎙️ Groq transcription returned empty text.", {
          language: transcription.language,
          duration: transcription.duration,
        });
      }

      return transcription;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error(`🎙️ Groq transcription timed out after ${transcriptionTimeoutMs}ms.`);
      } else {
        console.error("🎙️ Groq transcription request failed:", error);
      }

      return { text: "", provider: "groq" };
    } finally {
      clearTimeout(timeout);
    }
  }
}
