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
  selectedScope: TransactionScope;
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
    }
  | {
      status: "cancelled";
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

      const selectedScope = options.forcedScope ?? this.getInitialScope(aiResult.transactions);
      const finalTransactions = aiResult.transactions.map((transaction) =>
        this.toValidatedAiTransaction(transaction, selectedScope)
      );

      const updatedReceiptImport = await this.receiptImportRepository.setAiTransactions(
        receiptImport._id,
        finalTransactions,
        selectedScope
      );

      if (!updatedReceiptImport) {
        throw new Error("Receipt import disappeared while saving AI transactions.");
      }

      return {
        receiptImport: updatedReceiptImport,
        normalizedReceipt,
        aiTransactions: finalTransactions,
        selectedScope,
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
    receiptImportId: string,
    options: ImportReceiptOptions = {}
  ): Promise<ConfirmReceiptImportResult> {
    const receiptImport = await this.getOwnedReceiptImport(telegramId, receiptImportId);

    if (receiptImport.status === "confirmed") {
      return {
        status: "already_confirmed",
        transactions: [],
      };
    }

    if (receiptImport.status === "cancelled") {
      return {
        status: "cancelled",
        transactions: [],
      };
    }

    if (receiptImport.status !== "ai_grouped") {
      throw new Error("Receipt import is not ready for confirmation.");
    }

    const selectedScope =
      options.forcedScope ??
      receiptImport.selectedScope ??
      this.getInitialScope(receiptImport.aiTransactions ?? []);
    const aiTransactions = (receiptImport.aiTransactions ?? []).map((transaction) =>
      this.toValidatedAiTransaction(transaction, selectedScope)
    );

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

  async updateReceiptImportScope(
    telegramId: number,
    receiptImportId: string,
    scope: TransactionScope
  ): Promise<ReceiptImportPreview> {
    const receiptImport = await this.getOwnedReceiptImport(telegramId, receiptImportId);

    if (receiptImport.status === "confirmed") {
      throw new Error("Receipt import is already confirmed.");
    }

    if (receiptImport.status === "cancelled") {
      throw new Error("Receipt import is already cancelled.");
    }

    if (receiptImport.status !== "ai_grouped") {
      throw new Error("Receipt import is not ready for scope selection.");
    }

    const aiTransactions = (receiptImport.aiTransactions ?? []).map((transaction) =>
      this.toValidatedAiTransaction(transaction, scope)
    );

    const updatedReceiptImport = await this.receiptImportRepository.setSelectedScopeAndAiTransactions(
      receiptImport._id,
      scope,
      aiTransactions
    );

    if (!updatedReceiptImport) {
      throw new Error("Receipt import disappeared while updating scope.");
    }

    const updatedAiTransactions = (updatedReceiptImport.aiTransactions ?? []).map((transaction) =>
      this.toValidatedAiTransaction(transaction, scope)
    );

    return {
      receiptImport: updatedReceiptImport,
      normalizedReceipt: this.toNormalizedReceipt(updatedReceiptImport),
      aiTransactions: updatedAiTransactions,
      selectedScope: scope,
      groupedTotalDiffers: this.groupedTotalDiffers(
        updatedReceiptImport.fiscal?.totalSum ?? 0,
        updatedAiTransactions
      ),
    };
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

  private getInitialScope(transactions: AiReceiptTransaction[]): TransactionScope {
    const personalCount = transactions.filter((transaction) => transaction.scope === "personal").length;
    const familyCount = transactions.filter((transaction) => transaction.scope === "family").length;

    return personalCount > familyCount ? "personal" : "family";
  }

  private toValidatedAiTransaction(
    transaction: AiReceiptTransaction,
    scopeOverride?: TransactionScope
  ): AiReceiptTransaction {
    const scope = scopeOverride ?? transaction.scope;
    const amount = Number(transaction.amount);
    const category = typeof transaction.category === "string" ? transaction.category.trim() : "";
    const note = typeof transaction.note === "string" ? transaction.note.trim() : "";
    const itemNames = Array.isArray(transaction.itemNames)
      ? transaction.itemNames.filter((itemName): itemName is string => typeof itemName === "string" && itemName.trim().length > 0)
      : [];

    if (transaction.type !== "expense") {
      throw new Error("Receipt AI transaction type is invalid.");
    }

    if (scope !== "personal" && scope !== "family") {
      throw new Error("Receipt AI transaction scope is invalid.");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Receipt AI transaction amount is invalid.");
    }

    if (!category) {
      throw new Error("Receipt AI transaction category is missing.");
    }

    return {
      type: "expense",
      scope,
      amount,
      category,
      note,
      itemNames,
    };
  }

  private toNormalizedReceipt(receiptImport: ReceiptImportDocument): NormalizedReceipt {
    const dateTime = receiptImport.fiscal?.dateTime;
    const totalSum = receiptImport.fiscal?.totalSum;

    if (!dateTime || totalSum === undefined) {
      throw new Error("Receipt import fiscal data is incomplete.");
    }

    return {
      fiscal: {
        ...(receiptImport.fiscal?.fn ? { fn: receiptImport.fiscal.fn } : {}),
        ...(receiptImport.fiscal?.fd ? { fd: receiptImport.fiscal.fd } : {}),
        ...(receiptImport.fiscal?.fp ? { fp: receiptImport.fiscal.fp } : {}),
        dateTime,
        totalSum,
      },
      seller: {
        ...(receiptImport.seller?.name ? { name: receiptImport.seller.name } : {}),
        ...(receiptImport.seller?.inn ? { inn: receiptImport.seller.inn } : {}),
        ...(receiptImport.seller?.retailPlace ? { retailPlace: receiptImport.seller.retailPlace } : {}),
        ...(receiptImport.seller?.address ? { address: receiptImport.seller.address } : {}),
      },
      items: receiptImport.items.map((item) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        sum: item.sum,
      })),
    };
  }
}
