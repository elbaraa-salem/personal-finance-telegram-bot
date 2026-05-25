import { UserRepository } from "../../infrastructure/repositories/user.repository";
import { 
    TransactionType,
    TransactionScope,
    TransactionSource,
    TransactionDocument 
} from "../../infrastructure/database/models/transaction.model";
import { TransactionRepository } from "../../infrastructure/repositories/transaction.repository";

type AddTransactionData = {
  telegramId: number;
  type: TransactionType;
  scope?: TransactionScope;
  amount: number;
  category: string;
  note?: string;
  source?: TransactionSource;
  transactionDate?: Date;
};

function getTodayDateOnly(): Date {
    const now = new Date();

    return new Date(
        Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
);
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

        return this.transactionRepository.create({
                userId: user._id,
                type: data.type,
                ...(data.type === "expense" ? { scope: data.scope ?? "family" } : {}),
                amount: data.amount,
                category: data.category,
                transactionDate: data.transactionDate ?? getTodayDateOnly(),
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

        return this.transactionRepository.createMany(
            data.map((item) => ({
                userId: user._id,
                type: item.type,
                ...(item.type === "expense" ? { scope: item.scope ?? "family" } : {}),
                amount: item.amount,
                category: item.category,
                transactionDate: item.transactionDate ?? getTodayDateOnly(),
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

}