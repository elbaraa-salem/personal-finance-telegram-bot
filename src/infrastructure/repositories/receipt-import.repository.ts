import { Types } from "mongoose";
import {
  ReceiptImportAiTransaction,
  ReceiptImportDocument,
  ReceiptImportModel,
  ReceiptImportStatus,
} from "../database/models/receipt-import.model";

type CreateReceiptImportData = {
  userId: Types.ObjectId;
  provider: "proverkacheka";
  status: ReceiptImportStatus;
  qrRaw: string;
  fiscal?: ReceiptImportDocument["fiscal"];
  seller?: ReceiptImportDocument["seller"];
  items: ReceiptImportDocument["items"];
  rawResponse: unknown;
};

export class ReceiptImportRepository {
  async create(data: CreateReceiptImportData): Promise<ReceiptImportDocument> {
    return ReceiptImportModel.create({
      userId: data.userId,
      provider: data.provider,
      status: data.status,
      qrRaw: data.qrRaw,
      ...(data.fiscal ? { fiscal: data.fiscal } : {}),
      ...(data.seller ? { seller: data.seller } : {}),
      items: data.items,
      rawResponse: data.rawResponse,
    });
  }

  async findById(id: string | Types.ObjectId): Promise<ReceiptImportDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return ReceiptImportModel.findById(id).exec();
  }

  async updateStatus(
    id: string | Types.ObjectId,
    status: ReceiptImportStatus
  ): Promise<ReceiptImportDocument | null> {
    return ReceiptImportModel.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    ).exec();
  }

  async setAiTransactions(
    id: string | Types.ObjectId,
    aiTransactions: ReceiptImportAiTransaction[]
  ): Promise<ReceiptImportDocument | null> {
    return ReceiptImportModel.findByIdAndUpdate(
      id,
      { $set: { status: "ai_grouped", aiTransactions } },
      { new: true }
    ).exec();
  }

  async setCreatedTransactions(
    id: string | Types.ObjectId,
    transactionIds: Types.ObjectId[]
  ): Promise<ReceiptImportDocument | null> {
    return ReceiptImportModel.findByIdAndUpdate(
      id,
      { $set: { createdTransactionIds: transactionIds } },
      { new: true }
    ).exec();
  }

  async markFailed(
    id: string | Types.ObjectId,
    errorMessage: string
  ): Promise<ReceiptImportDocument | null> {
    return ReceiptImportModel.findByIdAndUpdate(
      id,
      { $set: { status: "failed", errorMessage } },
      { new: true }
    ).exec();
  }

  async markCancelled(id: string | Types.ObjectId): Promise<ReceiptImportDocument | null> {
    return this.updateStatus(id, "cancelled");
  }

  async markConfirmed(id: string | Types.ObjectId): Promise<ReceiptImportDocument | null> {
    return this.updateStatus(id, "confirmed");
  }

  async markConfirmedIfAiGrouped(
    id: string | Types.ObjectId
  ): Promise<ReceiptImportDocument | null> {
    return ReceiptImportModel.findOneAndUpdate(
      { _id: id, status: "ai_grouped" },
      { $set: { status: "confirmed" } },
      { new: true }
    ).exec();
  }
}
