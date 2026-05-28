import { InlineKeyboard } from "grammy";
import { ExpenseScopeMode } from "../../infrastructure/database/models/user.model";
import { SupportedLanguage } from "../i18n/language";
import { getMessages } from "../i18n/translations";

export const expenseScopeModeCallbacks = {
  separate: "expense_scope_mode:separate",
  personalOnly: "expense_scope_mode:personal_only",
  familyOnly: "expense_scope_mode:family_only",
} as const;

export function createExpenseScopeModeKeyboard(
  language: SupportedLanguage
): InlineKeyboard {
  const messages = getMessages(language).expenseScopeMode;

  return new InlineKeyboard()
    .text(messages.separate, expenseScopeModeCallbacks.separate)
    .row()
    .text(messages.personalOnly, expenseScopeModeCallbacks.personalOnly)
    .row()
    .text(messages.familyOnly, expenseScopeModeCallbacks.familyOnly);
}

export function getExpenseScopeModeFromCallback(
  callbackData: string
): ExpenseScopeMode | null {
  switch (callbackData) {
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
