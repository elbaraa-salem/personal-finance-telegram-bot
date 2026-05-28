import { InlineKeyboard } from "grammy";
import { SupportedLanguage } from "../i18n/language";
import { getMessages } from "../i18n/translations";
import { TransactionScope } from "../../infrastructure/database/models/transaction.model";

export const receiptImportCallbacks = {
  scopePersonal: "receipt_scope_personal",
  scopeFamily: "receipt_scope_family",
  confirm: "receipt_confirm",
  edit: "receipt_edit",
  cancel: "receipt_cancel",
} as const;

export function createReceiptScopeKeyboard(language: SupportedLanguage): InlineKeyboard {
  const messages = getMessages(language);
  const personalText = `👤 ${capitalizeScope(messages.transaction.scopePersonal, language)}`;
  const familyText = `🏠 ${capitalizeScope(messages.transaction.scopeFamily, language)}`;

  return new InlineKeyboard()
    .text(personalText, receiptImportCallbacks.scopePersonal)
    .text(familyText, receiptImportCallbacks.scopeFamily);
}

export function createReceiptConfirmationKeyboard(language: SupportedLanguage): InlineKeyboard {
  const messages = getMessages(language);
  const confirmText = messages.receipt.receiptSaveButton;
  const editText = language === "ru" ? "✏️ Изменить" : language === "en" ? "✏️ Edit" : "✏️ تعديل";
  const cancelText = messages.receipt.receiptCancelButton;

  return new InlineKeyboard()
    .text(confirmText, receiptImportCallbacks.confirm)
    .row()
    .text(editText, receiptImportCallbacks.edit)
    .text(cancelText, receiptImportCallbacks.cancel);
}

export function createReceiptQrConfirmationKeyboard(
  receiptImportId: string,
  language: SupportedLanguage,
  selectedScope: TransactionScope,
  allowScopeSelection = true
): InlineKeyboard {
  const messages = getMessages(language);
  const personalText = selectedScope === "personal"
    ? `✅ 👤 ${capitalizeScope(messages.transaction.scopePersonal, language)}`
    : `👤 ${capitalizeScope(messages.transaction.scopePersonal, language)}`;
  const familyText = selectedScope === "family"
    ? `✅ 🏠 ${capitalizeScope(messages.transaction.scopeFamily, language)}`
    : `🏠 ${capitalizeScope(messages.transaction.scopeFamily, language)}`;

  const keyboard = new InlineKeyboard();

  if (allowScopeSelection) {
    keyboard
      .text(personalText, `receipt_scope:${receiptImportId}:personal`)
      .text(familyText, `receipt_scope:${receiptImportId}:family`)
      .row();
  }

  return keyboard
    .text(messages.receipt.receiptSaveButton, `receipt_confirm:${receiptImportId}`)
    .text(messages.receipt.receiptCancelButton, `receipt_cancel:${receiptImportId}`);
}

function capitalizeScope(text: string, language: SupportedLanguage): string {
  return language === "ar" ? text : text.charAt(0).toUpperCase() + text.slice(1);
}
