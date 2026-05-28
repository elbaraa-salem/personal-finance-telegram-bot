import { InlineKeyboard } from "grammy";
import { SupportedLanguage } from "../i18n/language";
import { getMessages } from "../i18n/translations";

export const reportExcelCallbackPrefix = "report_excel";

export function formatCompactDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

export function createReportExcelKeyboard(
  language: SupportedLanguage,
  startDate: Date,
  endDateExclusive: Date
): InlineKeyboard {
  const callbackData = [
    reportExcelCallbackPrefix,
    formatCompactDate(startDate),
    formatCompactDate(endDateExclusive),
  ].join(":");

  return new InlineKeyboard().text(
    getMessages(language).report.excelButton,
    callbackData
  );
}
