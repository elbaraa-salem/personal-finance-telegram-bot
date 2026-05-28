import { InlineKeyboard } from "grammy";
import { SupportedLanguage } from "../i18n/language";
import { getMessages } from "../i18n/translations";

export const scopeConfirmationCallbacks = {
  personal: "confirm_scope:personal",
  family: "confirm_scope:family",
} as const;

export function createScopeConfirmationKeyboard(
  language: SupportedLanguage
): InlineKeyboard {
  const messages = getMessages(language);

  return new InlineKeyboard()
    .text(`👤 ${capitalizeScope(messages.transaction.scopePersonal, language)}`, scopeConfirmationCallbacks.personal)
    .text(`🏠 ${capitalizeScope(messages.transaction.scopeFamily, language)}`, scopeConfirmationCallbacks.family);
}

function capitalizeScope(text: string, language: SupportedLanguage): string {
  return language === "ar" ? text : text.charAt(0).toUpperCase() + text.slice(1);
}
