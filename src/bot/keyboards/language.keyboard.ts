
import { InlineKeyboard } from "grammy";
import { SupportedLanguage } from "../i18n/language";

export const languageCallbacks = {
  ar: "lang:ar",
  ru: "lang:ru",
  en: "lang:en",
} as const;

export function createLanguageKeyboard(flowId?: string): InlineKeyboard {
  const data = (callback: string) => flowId ? `${callback}:${flowId}` : callback;

  return new InlineKeyboard()
    .text("العربية", data(languageCallbacks.ar))
    .text("Русский", data(languageCallbacks.ru))
    .text("English", data(languageCallbacks.en));
}

export function getLanguageFromCallback(
  callbackData: string
): SupportedLanguage | null {
  const baseCallback = callbackData.split(":").slice(0, 2).join(":");

  if (baseCallback === languageCallbacks.ar) {
    return "ar";
  }

  if (baseCallback === languageCallbacks.ru) {
    return "ru";
  }

  if (baseCallback === languageCallbacks.en) {
    return "en";
  }

  return null;
}
