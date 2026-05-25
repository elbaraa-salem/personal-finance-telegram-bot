import { ReportPeriod, ReportResult } from "../../application/services/report.service";
import { CategorySummaryItem } from "../../infrastructure/repositories/transaction.repository";
import { SupportedLanguage } from "../i18n/language";
import { getMessages } from "../i18n/translations";
import { formatAmount } from "./amount.formatter";

function formatMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function formatPeriodTitle(report: ReportResult, language: SupportedLanguage): string {
  const messages = getMessages(language);

  if (report.period === "month" && report.startDate) {
    if (language === "ar") {
      return `📊 إحصائيات شهر ${formatMonth(report.startDate)}:`;
    }

    if (language === "ru") {
      return `📊 Статистика за месяц ${formatMonth(report.startDate)}:`;
    }

    return `📊 Statistics for ${formatMonth(report.startDate)}:`;
  }

  return messages.report.titles[report.period];
}

function getTotal(items: CategorySummaryItem[]): number {
  return items.reduce((sum, item) => sum + item.total, 0);
}

function formatCategorySection(
  items: CategorySummaryItem[],
  currency: string,
  emptyText: string
): string {
  if (items.length === 0) {
    return `  ${emptyText}`;
  }

  return items
    .map((item) => `  - ${item.category}: ${formatAmount(item.total, currency)}`)
    .join("\n");
}

function filterItems(
  report: ReportResult,
  type: "income" | "expense",
  scope?: "personal" | "family"
): CategorySummaryItem[] {
  return report.categorySummary.filter((item) => {
    if (item.type !== type) {
      return false;
    }

    if (!scope) {
      return true;
    }

    return item.scope === scope;
  });
}

function formatSection(
  title: string,
  items: CategorySummaryItem[],
  currency: string,
  totalLabel: string,
  emptyText: string
): string {
  return (
    `${title}\n` +
    `${formatCategorySection(items, currency, emptyText)}\n` +
    `  ${totalLabel}: ${formatAmount(getTotal(items), currency)}`
  );
}

export function formatReport(
  report: ReportResult,
  language: SupportedLanguage,
  currency: string
): string {
  const messages = getMessages(language);
  const incomeItems = filterItems(report, "income");
  const personalExpenseItems = filterItems(report, "expense", "personal");
  const familyExpenseItems = filterItems(report, "expense", "family");

  return (
    `${formatPeriodTitle(report, language)}\n\n` +
    `${formatSection(
      messages.report.incomeSection,
      incomeItems,
      currency,
      messages.report.total,
      messages.report.noItems
    )}\n\n` +
    `${formatSection(
      messages.report.personalExpenseSection,
      personalExpenseItems,
      currency,
      messages.report.total,
      messages.report.noItems
    )}\n\n` +
    `${formatSection(
      messages.report.familyExpenseSection,
      familyExpenseItems,
      currency,
      messages.report.total,
      messages.report.noItems
    )}\n\n` +
    `${messages.report.balance}: ${formatAmount(report.balance, currency)}\n` +
    `${messages.report.transactionCount}: ${report.transactionCount}`
  );
}
