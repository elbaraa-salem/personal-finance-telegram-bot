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

export type AwaitingScopeConfirmation = {
  type: "expense";
  amount: number;
  category: string;
  note?: string;
  transactionDate: string;
};

export type SessionData = {
  pendingTransaction: PendingTransaction | null;
  pendingCurrencyInput: boolean;
  pendingReceiptImport: PendingReceiptImport | null;
  awaitingScopeConfirmation: AwaitingScopeConfirmation | null;
  pendingDelete: PendingDelete | null;
};

export type BotContext = Context & SessionFlavor<SessionData>;

export function createInitialSession(): SessionData {
  return {
    pendingTransaction: null,
    pendingCurrencyInput: false,
    pendingReceiptImport: null,
    awaitingScopeConfirmation: null,
    pendingDelete: null,
  };
}
