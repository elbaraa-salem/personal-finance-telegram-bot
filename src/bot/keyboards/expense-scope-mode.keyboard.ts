import { InlineKeyboard } from "grammy";
import { ExpenseScopeMode } from "../../infrastructure/database/models/user.model";
import { SupportedLanguage } from "../i18n/language";
import { getMessages } from "../i18n/translations";

export const expenseScopeModeCallbacks = {
  separate: "exp:separate",
  personalOnly: "exp:personal_only",
  familyOnly: "exp:family_only",
} as const;

export function createExpenseScopeModeKeyboard(
  language: SupportedLanguage,
  flowId?: string
): InlineKeyboard {
  const messages = getMessages(language).expenseScopeMode;
  const data = (callback: string) => flowId ? `${callback}:${flowId}` : callback;

  return new InlineKeyboard()
    .text(messages.separate, data(expenseScopeModeCallbacks.separate))
    .row()
    .text(messages.personalOnly, data(expenseScopeModeCallbacks.personalOnly))
    .row()
    .text(messages.familyOnly, data(expenseScopeModeCallbacks.familyOnly));
}

export function getExpenseScopeModeFromCallback(
  callbackData: string
): ExpenseScopeMode | null {
  const baseCallback = callbackData.split(":").slice(0, 2).join(":");

  switch (baseCallback) {
    case expenseScopeModeCallbacks.separate:
      return "separate";
    case expenseScopeModeCallbacks.personalOnly:
      return "personal_only";
    case expenseScopeModeCallbacks.familyOnly:
      return "family_only";
    default:
      return null;
  }
}
