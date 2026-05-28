import { InlineKeyboard } from "grammy";
import { SupportedLanguage } from "../i18n/language";
import { getMessages } from "../i18n/translations";

export const settingsOptionCallbacks = {
  language: "settings:language",
  currency: "settings:currency",
  expenseScopeMode: "settings:expense_scope_mode",
} as const;

export function createSettingsOptionsKeyboard(
  language: SupportedLanguage
): InlineKeyboard {
  const menu = getMessages(language).menu;

  return new InlineKeyboard()
    .text(menu.language, settingsOptionCallbacks.language)
    .text(menu.currency, settingsOptionCallbacks.currency)
    .row()
    .text(menu.expenseModeSettingsButton, settingsOptionCallbacks.expenseScopeMode);
}
