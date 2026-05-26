import { Types } from "mongoose";
import {
  AiReceiptParserService,
  AiReceiptTransaction,
} from "./ai-receipt-parser.service";
import {
  NormalizedReceipt,
  ReceiptNormalizerService,
} from "./receipt-normalizer.service";
import { TransactionService } from "./transaction.service";
import { ProverkachekaClient } from "../../infrastructure/receipt/proverkacheka.client";
import { ReceiptImportDocument } from "../../infrastructure/database/models/receipt-import.model";
import {
  TransactionDocument,
  TransactionScope,
} from "../../infrastructure/database/models/transaction.model";
import { ReceiptImportRepository } from "../../infrastructure/repositories/receipt-import.repository";
import { UserRepository } from "../../infrastructure/repositories/user.repository";

export type ReceiptImportPreview = {
  receiptImport: ReceiptImportDocument;
  normalizedReceipt: NormalizedReceipt;
  aiTransactions: AiReceiptTransaction[];
  groupedTotalDiffers: boolean;
};

export type ConfirmReceiptImportResult =
  | {
      status: "created";
      transactions: TransactionDocument[];
    }
  | {
      status: "already_confirmed";
      transactions: TransactionDocument[];
    };

type ImportReceiptOptions = {
  forcedScope?: TransactionScope;
};

export class ReceiptImportService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly receiptImportRepository: ReceiptImportRepository,
    private readonly transactionService: TransactionService,
    private readonly proverkachekaClient: ProverkachekaClient | null,
    private readonly receiptNormalizer: ReceiptNormalizerService,
    private readonly aiReceiptParser: AiReceiptParserService
  ) {}

  async importReceiptByQrRaw(
    telegramId: number,
    qrRaw: string,
    language: string,
    defaultCurrency: string,
    options: ImportReceiptOptions = {}
  ): Promise<ReceiptImportPreview> {
    const user = await this.userRepository.findByTelegramId(telegramId);

    if (!user) {
      throw new Error("User not found. Please send /start first.");
    }

    if (!this.proverkachekaClient) {
      throw new Error("Receipt provider is not configured.");
    }

    let receiptImport: ReceiptImportDocument | null = null;

    try {
      const rawResponse = await this.proverkachekaClient.getCheckByQrRaw(qrRaw);
      const normalizedReceipt = this.receiptNormalizer.normalizeProverkachekaResponse(rawResponse);

      receiptImport = await this.receiptImportRepository.create({
        userId: user._id,
        provider: "proverkacheka",
        status: "parsed",
        qrRaw,
        fiscal: normalizedReceipt.fiscal,
        seller: normalizedReceipt.seller,
        items: normalizedReceipt.items,
        rawResponse,
      });

      const aiResult = await this.aiReceiptParser.parse(normalizedReceipt, {
        language,
        defaultCurrency,
        ...(options.forcedScope ? { forcedScope: options.forcedScope } : {}),
      });

      if (aiResult.status === "cannot_group") {
        await this.receiptImportRepository.markFailed(receiptImport._id, aiResult.reason);
        throw new Error(aiResult.reason);
      }

      const finalTransactions = aiResult.transactions.map((transaction) => ({
        ...transaction,
        ...(options.forcedScope ? { scope: options.forcedScope } : {}),
      }));

      const updatedReceiptImport = await this.receiptImportRepository.setAiTransactions(
        receiptImport._id,
        finalTransactions
      );

      if (!updatedReceiptImport) {
        throw new Error("Receipt import disappeared while saving AI transactions.");
      }

      return {
        receiptImport: updatedReceiptImport,
        normalizedReceipt,
        aiTransactions: finalTransactions,
        groupedTotalDiffers: this.groupedTotalDiffers(
          normalizedReceipt.fiscal.totalSum,
          finalTransactions
        ),
      };
    } catch (error) {
      if (receiptImport) {
        await this.receiptImportRepository.markFailed(
          receiptImport._id,
          error instanceof Error ? error.message : String(error)
        );
      }

      throw error;
    }
  }

  async confirmReceiptImport(
    telegramId: number,
    receiptImportId: string
  ): Promise<ConfirmReceiptImportResult> {
    const receiptImport = await this.getOwnedReceiptImport(telegramId, receiptImportId);

    if (receiptImport.status === "confirmed") {
      return {
        status: "already_confirmed",
        transactions: [],
      };
    }

    if (receiptImport.status !== "ai_grouped") {
      throw new Error("Receipt import is not ready for confirmation.");
    }

    const aiTransactions = receiptImport.aiTransactions ?? [];

    if (aiTransactions.length === 0) {
      throw new Error("Receipt import has no transactions to save.");
    }

    const claimedReceiptImport =
      await this.receiptImportRepository.markConfirmedIfAiGrouped(receiptImport._id);

    if (!claimedReceiptImport) {
      return {
        status: "already_confirmed",
        transactions: [],
      };
    }

    const transactionDate = receiptImport.fiscal?.dateTime ?? new Date();
    let transactions: TransactionDocument[];

    try {
      transactions = await this.transactionService.addTransactions(
        aiTransactions.map((transaction) => ({
          telegramId,
          type: "expense",
          scope: transaction.scope,
          amount: transaction.amount,
          category: transaction.category,
          note: transaction.note,
          source: "receipt",
          transactionDate,
        }))
      );
    } catch (error) {
      await this.receiptImportRepository.markFailed(
        receiptImport._id,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }

    await this.receiptImportRepository.setCreatedTransactions(
      receiptImport._id,
      transactions.map((transaction) => transaction._id)
    );

    return {
      status: "created",
      transactions,
    };
  }

  async cancelReceiptImport(
    telegramId: number,
    receiptImportId: string
  ): Promise<ReceiptImportDocument> {
    const receiptImport = await this.getOwnedReceiptImport(telegramId, receiptImportId);

    if (receiptImport.status === "confirmed") {
      return receiptImport;
    }

    const updatedReceiptImport = await this.receiptImportRepository.markCancelled(receiptImport._id);

    if (!updatedReceiptImport) {
      throw new Error("Receipt import disappeared while cancelling.");
    }

    return updatedReceiptImport;
  }

  private async getOwnedReceiptImport(
    telegramId: number,
    receiptImportId: string
  ): Promise<ReceiptImportDocument> {
    const user = await this.userRepository.findByTelegramId(telegramId);

    if (!user) {
      throw new Error("User not found. Please send /start first.");
    }

    if (!Types.ObjectId.isValid(receiptImportId)) {
      throw new Error("Receipt import id is invalid.");
    }

    const receiptImport = await this.receiptImportRepository.findById(receiptImportId);

    if (!receiptImport || !receiptImport.userId.equals(user._id)) {
      throw new Error("Receipt import was not found.");
    }

    return receiptImport;
  }

  private groupedTotalDiffers(
    receiptTotal: number,
    transactions: AiReceiptTransaction[]
  ): boolean {
    const groupedTotal = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

    return Math.abs(groupedTotal - receiptTotal) > 0.01;
  }
}
