import { InlineKeyboard } from "grammy";
import { SupportedLanguage } from "../i18n/language";

export const receiptImportCallbacks = {
  scopePersonal: "receipt_scope_personal",
  scopeFamily: "receipt_scope_family",
  confirm: "receipt_confirm",
  edit: "receipt_edit",
  cancel: "receipt_cancel",
} as const;

export function createReceiptScopeKeyboard(language: SupportedLanguage): InlineKeyboard {
  const personalText = language === "ru" ? "👤 Личное" : language === "en" ? "👤 Personal" : "👤 شخصي";
  const familyText = language === "ru" ? "👨‍👩‍👧 Семейное" : language === "en" ? "👨‍👩‍👧 Family" : "👨‍👩‍👧 أسري";

  return new InlineKeyboard()
    .text(personalText, receiptImportCallbacks.scopePersonal)
    .text(familyText, receiptImportCallbacks.scopeFamily);
}

export function createReceiptConfirmationKeyboard(language: SupportedLanguage): InlineKeyboard {
  const confirmText = language === "ru" ? "✅ Сохранить" : language === "en" ? "✅ Save" : "✅ احفظ";
  const editText = language === "ru" ? "✏️ Изменить" : language === "en" ? "✏️ Edit" : "✏️ تعديل";
  const cancelText = language === "ru" ? "❌ Отменить" : language === "en" ? "❌ Cancel" : "❌ إلغاء";

  return new InlineKeyboard()
    .text(confirmText, receiptImportCallbacks.confirm)
    .row()
    .text(editText, receiptImportCallbacks.edit)
    .text(cancelText, receiptImportCallbacks.cancel);
}
