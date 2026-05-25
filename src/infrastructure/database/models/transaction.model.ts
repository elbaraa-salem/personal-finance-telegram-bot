import { model, Schema, Types } from "mongoose";

export type TransactionType = "income" | "expense";
export type TransactionScope = "personal" | "family";
export type TransactionSource = "manual" | "receipt";

export interface TransactionDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: TransactionType;
  scope?: TransactionScope;
  amount: number;
  category: string;
  note?: string;
  source?: TransactionSource;
  transactionDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<TransactionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
    },
    scope: {
      type: String,
      enum: ["personal", "family"],
      required: false,
      default: "family",
      index: true,
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
      trim: true,
    },
    source: {
      type: String,
      enum: ["manual", "receipt"],
      required: false,
      default: "manual",
      index: true,
    },
    transactionDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const TransactionModel = model<TransactionDocument>(
  "Transaction",
  transactionSchema
);
