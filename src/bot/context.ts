import { Context, SessionFlavor } from "grammy";
import { TransactionScope, TransactionType } from "../infrastructure/database/models/transaction.model";
import { ExtractedReceipt } from "../infrastructure/ai/receipt-extractor";

export type PendingTransaction = {
  type: TransactionType;
  scope?: TransactionScope;
};

export type PendingReceiptImport = {
  receipt: ExtractedReceipt;
  scope?: TransactionScope;
};

export type PendingDelete =
  | {
      kind: "single_transaction";
      transactionId: string;
    }
  | {
      kind: "receipt_import";
      receiptImportId: string;
      transactionIds: string[];
    };

export type PendingCustomReport = {
  flowId: string;
  step: "from" | "to";
  fromDate?: string;
};

export type AwaitingScopeConfirmation = {
  type: "expense";
  amount: number;
  parentCategory?: string;
  category: string;
  note?: string;
  transactionDate: string;
  source?: "text" | "voice";
  originalText?: string;
  requireConfirmation?: boolean;
};

export type PendingTransactionConfirmation = {
  flowId: string;
  source: "text" | "voice";
  type: TransactionType;
  scope?: TransactionScope;
  amount: number;
  parentCategory?: string;
  category: string;
  note?: string;
  transactionDate: string;
  originalText: string;
};

export type ActiveFlowType =
  | "custom_report"
  | "settings"
  | "language_settings"
  | "onboarding_language"
  | "currency_settings"
  | "onboarding_currency"
  | "timezone_settings"
  | "expense_scope_settings"
  | "onboarding_expense_scope"
  | "report_month_selection"
  | "report_custom_range"
  | "history_month_selection"
  | "last_operations"
  | "excel_report"
  | "manual_transaction"
  | "transaction_confirmation"
  | "receipt_confirmation"
  | "delete_confirmation";

export type ActiveFlow = {
  id: string;
  type: ActiveFlowType;
  createdAt: number;
};

export type LastInteractiveMessage = {
  chatId: number;
  messageId: number;
};

export type SessionData = {
  pendingTransaction: PendingTransaction | null;
  pendingCurrencyInput: boolean;
  pendingReceiptImport: PendingReceiptImport | null;
  awaitingScopeConfirmation: AwaitingScopeConfirmation | null;
  pendingDelete: PendingDelete | null;
  pendingCustomReport: PendingCustomReport | null;
  pendingTransactionConfirmation: PendingTransactionConfirmation | null;
  activeFlow: ActiveFlow | null;
  lastInteractiveMessage: LastInteractiveMessage | null;
};

export type BotContext = Context & SessionFlavor<SessionData>;

export function createInitialSession(): SessionData {
  return {
    pendingTransaction: null,
    pendingCurrencyInput: false,
    pendingReceiptImport: null,
    awaitingScopeConfirmation: null,
    pendingDelete: null,
    pendingCustomReport: null,
    pendingTransactionConfirmation: null,
    activeFlow: null,
    lastInteractiveMessage: null,
  };
}
