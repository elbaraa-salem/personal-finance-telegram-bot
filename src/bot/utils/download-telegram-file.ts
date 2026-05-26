import { config } from "../../config/env";
import { BotContext } from "../context";

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
