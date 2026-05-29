import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { config } from "../../config/env";

const execFileAsync = promisify(execFile);
const defaultTimeoutMs = 60_000;

export type VoiceTranscriptionResult = {
  text: string;
  language?: string;
  duration?: number;
};

type VoiceTranscriptionJson = {
  text?: unknown;
  language?: unknown;
  duration?: unknown;
  error?: unknown;
};

export class VoiceTranscriptionService {
  constructor(
    private readonly options: {
      pythonPath?: string;
      scriptPath?: string;
      timeoutMs?: number;
    } = {}
  ) {}

  async transcribe(audioFilePath: string): Promise<VoiceTranscriptionResult> {
    const pythonPath = this.options.pythonPath ?? config.voiceTranscribePython;
    const scriptPath =
      this.options.scriptPath ?? path.resolve(process.cwd(), "scripts/transcribe_voice.py");

    try {
      const { stdout } = await execFileAsync(
        pythonPath,
        [scriptPath, audioFilePath],
        {
          timeout: this.options.timeoutMs ?? defaultTimeoutMs,
          maxBuffer: 1024 * 1024,
          env: {
            ...process.env,
            VOICE_TRANSCRIBE_MODEL: config.voiceTranscribeModel,
            VOICE_TRANSCRIBE_DEVICE: config.voiceTranscribeDevice,
            VOICE_TRANSCRIBE_COMPUTE_TYPE: config.voiceTranscribeComputeType,
          },
        }
      );

      const parsed = JSON.parse(stdout.trim()) as VoiceTranscriptionJson;

      if (typeof parsed.error === "string" && parsed.error.trim()) {
        return { text: "" };
      }

      return {
        text: typeof parsed.text === "string" ? parsed.text.trim() : "",
        ...(typeof parsed.language === "string" && parsed.language
          ? { language: parsed.language }
          : {}),
        ...(typeof parsed.duration === "number" && Number.isFinite(parsed.duration)
          ? { duration: parsed.duration }
          : {}),
      };
    } catch {
      return { text: "" };
    }
  }
}
