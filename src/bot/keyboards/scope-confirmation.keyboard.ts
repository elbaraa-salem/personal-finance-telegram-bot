import { InlineKeyboard } from "grammy";
import { SupportedLanguage } from "../i18n/language";

export const scopeConfirmationCallbacks = {
  personal: "confirm_scope:personal",
  family: "confirm_scope:family",
} as const;

export function createScopeConfirmationKeyboard(
  _language: SupportedLanguage
): InlineKeyboard {
  return new InlineKeyboard()
    .text("👤 شخصية", scopeConfirmationCallbacks.personal)
    .text("🏠 أسرية", scopeConfirmationCallbacks.family);
}
