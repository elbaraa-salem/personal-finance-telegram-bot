import { model, Schema, Types } from "mongoose";
import { SupportedLanguage } from "../../../bot/i18n/language";

export type ExpenseScopeMode = "separate" | "personal_only" | "family_only";

export interface UserDocument {
  _id: Types.ObjectId;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  updatedAt: Date;
  language?: SupportedLanguage;
  currency?: string;
  timezone?: string;
  expenseScopeMode: ExpenseScopeMode;
}

const userSchema = new Schema<UserDocument>(
  {
    telegramId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    username: String,
    firstName: String,
    lastName: String,
    language: {
      type: String,
      enum: ["ar", "ru", "en"],
      required: false,
    },
    currency: {
      type: String,
      required: false,
      trim: true,
    },
    timezone: {
      type: String,
      required: false,
      trim: true,
    },
    expenseScopeMode: {
      type: String,
      enum: ["separate", "personal_only", "family_only"],
      default: "separate",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const UserModel = model<UserDocument>("User", userSchema);
