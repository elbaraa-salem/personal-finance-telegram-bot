import { UserRepository } from "../../infrastructure/repositories/user.repository";
import { 
    TransactionType,
    TransactionScope,
    TransactionSource,
    TransactionDocument 
} from "../../infrastructure/database/models/transaction.model";
import { TransactionRepository } from "../../infrastructure/repositories/transaction.repository";
import { config } from "../../config/env";
import { getTodayDateOnlyInTimezone } from "./timezone-date.service";

type AddTransactionData = {
  telegramId: number;
  type: TransactionType;
  scope?: TransactionScope;
  amount: number;
  parentCategory?: string;
  category: string;
  note?: string;
  source?: TransactionSource;
  transactionDate?: Date;
};

function getTodayDateOnly(timezone: string): Date {
    return getTodayDateOnlyInTimezone(timezone);
}
export class TransactionService {
    constructor(
        private readonly transactionRepository: TransactionRepository,
        private readonly userRepository: UserRepository,
    ){}

    async addTransaction(data: AddTransactionData): Promise<TransactionDocument> {
        if (data.amount <= 0) {
            throw new Error("Amount must be greater than zero");
        }

        const user = await this.userRepository.findByTelegramId(data.telegramId);

        if (!user) {
            throw new Error("user not found. Please send /start first.");
        }

        const timezone = user.timezone ?? config.appTimezone;

        return this.transactionRepository.create({
                userId: user._id,
                type: data.type,
                ...(data.type === "expense" ? { scope: data.scope ?? "family" } : {}),
                amount: data.amount,
                ...(data.parentCategory ? { parentCategory: data.parentCategory } : {}),
                category: data.category,
                transactionDate: data.transactionDate ?? getTodayDateOnly(timezone),
                ...(data.note ? { note: data.note } : {}),
                ...(data.source ? { source: data.source } : {}),
            });
    }

    async addTransactions(data: AddTransactionData[]): Promise<TransactionDocument[]> {
        if (data.length === 0) {
            throw new Error("No transactions to add");
        }

        const telegramId = data[0]?.telegramId;

        if (!telegramId || data.some((item) => item.telegramId !== telegramId)) {
            throw new Error("All transactions must belong to the same Telegram user");
        }

        for (const item of data) {
            if (item.amount <= 0) {
                throw new Error("Amount must be greater than zero");
            }
        }

        const user = await this.userRepository.findByTelegramId(telegramId);

        if (!user) {
            throw new Error("user not found. Please send /start first.");
        }

        const timezone = user.timezone ?? config.appTimezone;

        return this.transactionRepository.createMany(
            data.map((item) => ({
                userId: user._id,
                type: item.type,
                ...(item.type === "expense" ? { scope: item.scope ?? "family" } : {}),
                amount: item.amount,
                ...(item.parentCategory ? { parentCategory: item.parentCategory } : {}),
                category: item.category,
                transactionDate: item.transactionDate ?? getTodayDateOnly(timezone),
                ...(item.note ? { note: item.note } : {}),
                ...(item.source ? { source: item.source } : {}),
            }))
        );
    }

    async deleteLastTransaction(telegramId: number): Promise<TransactionDocument> {
        const user = await this.userRepository.findByTelegramId(telegramId);

        if (!user) {
            throw new Error("User not found. Please send /start first.");
        }

        const deletedTransaction =
            await this.transactionRepository.deleteLatestByUserId(user._id);

        if (!deletedTransaction) {
            throw new Error("No transactions found to delete.");
        }

        return deletedTransaction;
    }

    async getLatestTransaction(telegramId: number): Promise<TransactionDocument> {
        const user = await this.userRepository.findByTelegramId(telegramId);

        if (!user) {
            throw new Error("User not found. Please send /start first.");
        }

        const transaction = await this.transactionRepository.findLatestByUserId(user._id);

        if (!transaction) {
            throw new Error("No transactions found to delete.");
        }

        return transaction;
    }

    async deleteTransactionById(
        telegramId: number,
        transactionId: string
    ): Promise<TransactionDocument> {
        const user = await this.userRepository.findByTelegramId(telegramId);

        if (!user) {
            throw new Error("User not found. Please send /start first.");
        }

        const deletedTransaction = await this.transactionRepository.deleteByIdAndUserId(
            user._id,
            transactionId
        );

        if (!deletedTransaction) {
            throw new Error("No transactions found to delete.");
        }

        return deletedTransaction;
    }

    async deleteTransactionsByIds(
        telegramId: number,
        transactionIds: string[]
    ): Promise<number> {
        const user = await this.userRepository.findByTelegramId(telegramId);

        if (!user) {
            throw new Error("User not found. Please send /start first.");
        }

        return this.transactionRepository.deleteManyByIds(user._id, transactionIds);
    }

}
