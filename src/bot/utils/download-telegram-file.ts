import { config } from "../../config/env";
import { BotContext } from "../context";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function downloadTelegramFileAsBuffer(
  ctx: BotContext,
  fileId: string
): Promise<Buffer> {
  const file = await ctx.api.getFile(fileId);

  if (!file.file_path) {
    throw new Error("Telegram did not return a file path.");
  }

  const response = await fetch(
    `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`
  );

  if (!response.ok) {
    throw new Error(`Failed to download Telegram file: HTTP ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function downloadTelegramFileToTempFile(
  ctx: BotContext,
  fileId: string,
  fileExtension = ".ogg"
): Promise<string> {
  const buffer = await downloadTelegramFileAsBuffer(ctx, fileId);
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "telegram-voice-"));
  const filePath = path.join(tempDirectory, `voice${fileExtension}`);

  await writeFile(filePath, buffer);

  return filePath;
}
