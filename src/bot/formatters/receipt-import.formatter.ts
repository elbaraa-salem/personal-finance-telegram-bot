import { ReceiptImportPreview } from "../../application/services/receipt-import.service";
import { formatAmount } from "./amount.formatter";
import { formatDate } from "./date.formatter";
import { SupportedLanguage } from "../i18n/language";
import { getMessages } from "../i18n/translations";

function scopeIcon(scope: "personal" | "family"): string {
  return scope === "family" ? "🏠" : "👤";
}

function formatTransactionItems(itemNames: string[]): string {
  const visibleItemNames = itemNames.slice(0, 5);
  const suffix = itemNames.length > visibleItemNames.length ? "\n  ..." : "";

  return visibleItemNames.map((itemName) => `  ${itemName}`).join("\n") + suffix;
}

export function formatReceiptImportPreview(
  preview: ReceiptImportPreview,
  language: SupportedLanguage,
  currency: string
): string {
  const messages = getMessages(language);
  const seller =
    preview.normalizedReceipt.seller.retailPlace ??
    preview.normalizedReceipt.seller.name ??
    "";
  const transactions = preview.aiTransactions
    .map(
      (transaction) =>
        `${scopeIcon(transaction.scope)} ${transaction.category}: ${formatAmount(transaction.amount, currency)}\n` +
        formatTransactionItems(transaction.itemNames)
    )
    .join("\n\n");
  const warning = preview.groupedTotalDiffers
    ? `\n\n${messages.receipt.groupedTotalDiffers}`
    : "";

  return (
    `${messages.receipt.receiptFound}${seller ? `: ${seller}` : ""}\n` +
    `${messages.receipt.receiptDate}: ${formatDate(preview.normalizedReceipt.fiscal.dateTime)}\n` +
    `${messages.receipt.receiptTotal}: ${formatAmount(preview.normalizedReceipt.fiscal.totalSum, currency)}\n\n` +
    `${messages.receipt.receiptTransactionsToCreate}:\n` +
    `${transactions}` +
    warning +
    `\n\n${messages.receipt.receiptSaveQuestion}`
  );
}
