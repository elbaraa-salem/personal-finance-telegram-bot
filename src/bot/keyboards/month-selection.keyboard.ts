import { InlineKeyboard } from "grammy";
import { TransactionMonthItem } from "../../infrastructure/repositories/transaction.repository";
import { SupportedLanguage } from "../i18n/language";
import { getMessages } from "../i18n/translations";

export type MonthSelectionCallbackPrefix = "report_month" | "history_month";
type CreateMonthSelectionKeyboardOptions = {
  includeCustomRange?: boolean;
  flowId?: string;
};

export const reportCustomRangeCallback = "r:custom";

function formatMonthButtonLabel(month: TransactionMonthItem): string {
  return `${month.year}-${String(month.month).padStart(2, "0")}`;
}

export function createMonthSelectionKeyboard(
  months: TransactionMonthItem[],
  callbackPrefix: MonthSelectionCallbackPrefix,
  language: SupportedLanguage,
  options: CreateMonthSelectionKeyboardOptions = {}
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  months.forEach((month, index) => {
    const monthText = String(month.month).padStart(2, "0");
    const callbackData =
      callbackPrefix === "history_month"
        ? `${callbackPrefix}:${month.year}-${monthText}:1`
        : `${callbackPrefix}:${month.year}-${monthText}`;

    keyboard.text(formatMonthButtonLabel(month), callbackData);

    if (index % 2 === 1) {
      keyboard.row();
    }
  });

  if (options.includeCustomRange) {
    if (months.length > 0 && months.length % 2 !== 0) {
      keyboard.row();
    }

    keyboard.text(
      getMessages(language).report.customRangeButton,
      options.flowId ? `${reportCustomRangeCallback}:${options.flowId}` : reportCustomRangeCallback
    );
  }

  return keyboard;
}

export function createHistoryPaginationKeyboard(
  year: number,
  month: number,
  page: number,
  totalPages: number,
  language: SupportedLanguage
): InlineKeyboard | undefined {
  if (totalPages <= 1) {
    return undefined;
  }

  const messages = getMessages(language);
  const keyboard = new InlineKeyboard();
  const monthText = String(month).padStart(2, "0");

  if (page > 1) {
    keyboard.text(
      messages.history.previousPage,
      `history_month:${year}-${monthText}:${page - 1}`
    );
  }

  if (page < totalPages) {
    keyboard.text(
      messages.history.nextPage,
      `history_month:${year}-${monthText}:${page + 1}`
    );
  }

  return keyboard;
}
