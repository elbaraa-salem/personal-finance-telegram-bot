import { TransactionDocument } from "../../infrastructure/database/models/transaction.model";
import { formatAmount } from "./amount.formatter";
import { formatDate } from "./date.formatter";
import { SupportedLanguage } from "../i18n/language";
import { getMessages } from "../i18n/translations";

export function formatTransactionLine(
  transaction: TransactionDocument,
  index: number,
  language: SupportedLanguage,
  currency: string
): string {
  const messages = getMessages(language);
  const icon = transaction.type === "income" ? "💰" : "💸";
  const label =
    transaction.type === "income"
      ? messages.transaction.income
      : messages.transaction.expense;
  const scopeText =
    transaction.type === "expense" && transaction.scope
      ? ` | ${
          transaction.scope === "personal"
            ? messages.transaction.personalScope
            : messages.transaction.familyScope
        }`
      : "";

  const noteText = transaction.note
    ? `\n   ${messages.transaction.note}: ${transaction.note}`
    : "";

  return (
    `${index + 1}. ${icon} ${label}${scopeText} | ` +
    `${formatAmount(transaction.amount, currency)} | ` +
    `${transaction.category} | ` +
    `${formatDate(transaction.transactionDate)}` +
    noteText
  );
}

export function formatDeletedTransaction(
  transaction: TransactionDocument,
  language: SupportedLanguage,
  currency: string
): string {
  const messages = getMessages(language);

  const label =
    transaction.type === "income"
      ? messages.transaction.income
      : messages.transaction.expense;

  const icon = transaction.type === "income" ? "💰" : "💸";
  const noteText = transaction.note
    ? `\n${messages.transaction.note}: ${transaction.note}`
    : "";

  return (
    `${icon} ${messages.delete.deletedSuccessfully(label)}\n\n` +
    `${messages.delete.amount}: ${formatAmount(transaction.amount, currency)}\n` +
    `${messages.delete.category}: ${transaction.category}\n` +
    `${messages.delete.date}: ${formatDate(transaction.transactionDate)}` +
    noteText
  );
}

export function formatCreatedTransaction(
  transaction: TransactionDocument,
  language: SupportedLanguage,
  currency: string
): string {
  const messages = getMessages(language);

  const typeLabel =
    transaction.type === "income"
      ? messages.transaction.income
      : messages.transaction.expense;
  const scopeText =
    transaction.type === "expense" && transaction.scope
      ? `\n${messages.transaction.scope}: ${
          transaction.scope === "personal"
            ? messages.transaction.personalScope
            : messages.transaction.familyScope
        }`
      : "";

  const noteText = transaction.note
    ? `\n${messages.transaction.note}: ${transaction.note}`
    : "";

  return (
    `${messages.naturalTransaction.saved}\n` +
    `${messages.transaction.type}: ${typeLabel}` +
    scopeText +
    "\n" +
    `${messages.transaction.amount}: ${formatAmount(transaction.amount, currency)}\n` +
    `${messages.transaction.category}: ${transaction.category}\n` +
    `${messages.transaction.date}: ${formatDate(transaction.transactionDate)}` +
    noteText
  );
}
