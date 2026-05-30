import { InlineKeyboard } from "grammy";
import { SupportedLanguage } from "../i18n/language";
import { getMessages } from "../i18n/translations";

export const settingsOptionCallbacks = {
  language: "s:lang",
  currency: "s:cur",
  expenseScopeMode: "s:exp",
  timezone: "s:tz",
} as const;

export function createSettingsOptionsKeyboard(
  language: SupportedLanguage,
  flowId?: string
): InlineKeyboard {
  const menu = getMessages(language).menu;
  const data = (callback: string) => flowId ? `${callback}:${flowId}` : callback;

  return new InlineKeyboard()
    .text(menu.language, data(settingsOptionCallbacks.language))
    .text(menu.currency, data(settingsOptionCallbacks.currency))
    .row()
    .text(menu.expenseModeSettingsButton, data(settingsOptionCallbacks.expenseScopeMode))
    .row()
    .text(menu.timezoneSettings, data(settingsOptionCallbacks.timezone));
}
