import { InlineKeyboard } from "grammy";

export const supportedTimezones = [
  "Asia/Tomsk",
  "Europe/Moscow",
  "Africa/Cairo",
  "UTC",
] as const;

export type SupportedTimezone = (typeof supportedTimezones)[number];

export function isSupportedTimezone(value: string): value is SupportedTimezone {
  return supportedTimezones.includes(value as SupportedTimezone);
}

export function createTimezoneKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  supportedTimezones.forEach((timezone, index) => {
    keyboard.text(timezone, `timezone:${timezone}`);

    if (index % 2 === 1) {
      keyboard.row();
    }
  });

  return keyboard;
}
