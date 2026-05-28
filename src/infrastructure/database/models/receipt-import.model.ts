import { model, Schema, Types } from "mongoose";
import { TransactionScope } from "./transaction.model";

export type ReceiptImportStatus =
  | "received"
  | "parsed"
  | "ai_grouped"
  | "confirmed"
  | "deleted"
  | "cancelled"
  | "failed";

export type NormalizedReceiptItemDocument = {
  name: string;
  price: number;
  quantity: number;
  sum: number;
};

export type ReceiptImportAiTransaction = {
  type: "expense";
  scope: TransactionScope;
  amount: number;
  category: string;
  note: string;
  itemNames: string[];
};

export interface ReceiptImportDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  provider: "proverkacheka";
  status: ReceiptImportStatus;
  qrRaw: string;
  fiscal?: {
    fn?: string;
    fd?: string;
    fp?: string;
    dateTime?: Date;
    totalSum?: number;
  };
  seller?: {
    name?: string;
    inn?: string;
    retailPlace?: string;
    address?: string;
  };
  items: NormalizedReceiptItemDocument[];
  selectedScope?: TransactionScope;
  aiTransactions?: ReceiptImportAiTransaction[];
  createdTransactionIds: Types.ObjectId[];
  rawResponse: unknown;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const receiptImportAiTransactionSchema = new Schema<ReceiptImportAiTransaction>(
  {
    type: {
      type: String,
      enum: ["expense"],
      required: true,
      default: "expense",
    },
    scope: {
      type: String,
      enum: ["personal", "family"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    note: {
      type: String,
      required: true,
      trim: true,
    },
    itemNames: {
      type: [String],
      required: true,
      default: [],
    },
  },
  { _id: false }
);

const normalizedReceiptItemSchema = new Schema<NormalizedReceiptItemDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    sum: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const receiptImportSchema = new Schema<ReceiptImportDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["proverkacheka"],
      required: true,
      default: "proverkacheka",
    },
    status: {
      type: String,
      enum: ["received", "parsed", "ai_grouped", "confirmed", "deleted", "cancelled", "failed"],
      required: true,
      index: true,
    },
    qrRaw: {
      type: String,
      required: true,
      trim: true,
    },
    fiscal: {
      fn: String,
      fd: String,
      fp: String,
      dateTime: Date,
      totalSum: Number,
    },
    seller: {
      name: String,
      inn: String,
      retailPlace: String,
      address: String,
    },
    items: {
      type: [normalizedReceiptItemSchema],
      required: true,
      default: [],
    },
    selectedScope: {
      type: String,
      enum: ["personal", "family"],
      required: false,
    },
    aiTransactions: {
      type: [receiptImportAiTransactionSchema],
      required: false,
    },
    createdTransactionIds: {
      type: [Schema.Types.ObjectId],
      ref: "Transaction",
      required: true,
      default: [],
    },
    rawResponse: {
      type: Schema.Types.Mixed,
      required: true,
    },
    errorMessage: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

export const ReceiptImportModel = model<ReceiptImportDocument>(
  "ReceiptImport",
  receiptImportSchema
);
