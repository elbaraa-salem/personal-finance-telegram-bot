import { TransactionDocument } from "../../infrastructure/database/models/transaction.model";
import {
  TransactionMonthItem,
  TransactionRepository,
} from "../../infrastructure/repositories/transaction.repository";
import { UserRepository } from "../../infrastructure/repositories/user.repository";
import { getMonthDateRange } from "./month-date-range";
import { config } from "../../config/env";
import { getCurrentDateRangeInTimezone } from "./timezone-date.service";

export type HistoryPeriod = "day" | "week" | "month" | "year";

type DateRange = {
  startDate: Date;
  endDate: Date;
};

const DEFAULT_HISTORY_LIMIT = 5;
const MAX_HISTORY_LIMIT = 20;
const MONTH_HISTORY_PAGE_SIZE = 10;

function normalizeLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), MAX_HISTORY_LIMIT);
}

export class HistoryService {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly userRepository: UserRepository
  ) {}

  async getRecentTransactions(
    telegramId: number,
    limit = DEFAULT_HISTORY_LIMIT
  ): Promise<TransactionDocument[]> {
    const user = await this.userRepository.findByTelegramId(telegramId);

    if (!user) {
      throw new Error("User not found. Please send /start first.");
    }

    return this.transactionRepository.findRecentByUserId(
      user._id,
      normalizeLimit(limit)
    );
  }

  async getTransactionsForDate(
    telegramId: number,
    date: Date,
    limit = MAX_HISTORY_LIMIT
  ): Promise<TransactionDocument[]> {
    const user = await this.userRepository.findByTelegramId(telegramId);

    if (!user) {
      throw new Error("User not found. Please send /start first.");
    }

    const startDate = date;
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 1);

    return this.transactionRepository.findByUserIdAndDateRange(
      user._id,
      startDate,
      endDate,
      normalizeLimit(limit)
    );
  }

  async getTransactionsForPeriod(
    telegramId: number,
    period: HistoryPeriod,
    limit = MAX_HISTORY_LIMIT
  ): Promise<TransactionDocument[]> {
    const user = await this.userRepository.findByTelegramId(telegramId);

    if (!user) {
      throw new Error("User not found. Please send /start first.");
    }

    const dateRange = this.getDateRange(period, user.timezone ?? config.appTimezone);

    return this.transactionRepository.findByUserIdAndDateRange(
      user._id,
      dateRange.startDate,
      dateRange.endDate,
      normalizeLimit(limit)
    );
  }

  async getAvailableHistoryMonths(
    telegramId: number
  ): Promise<TransactionMonthItem[]> {
    const user = await this.userRepository.findByTelegramId(telegramId);

    if (!user) {
      throw new Error("User not found. Please send /start first.");
    }

    return this.transactionRepository.getAvailableMonthsByUserId(user._id);
  }

  async getTransactionsForMonth(
    telegramId: number,
    year: number,
    month: number,
    page = 1
  ): Promise<{
    transactions: TransactionDocument[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  }> {
    const user = await this.userRepository.findByTelegramId(telegramId);

    if (!user) {
      throw new Error("User not found. Please send /start first.");
    }

    const dateRange = getMonthDateRange(year, month);
    const totalCount = await this.transactionRepository.countByUserIdAndDateRange(
      user._id,
      dateRange.startDate,
      dateRange.endDate
    );
    const totalPages = Math.max(Math.ceil(totalCount / MONTH_HISTORY_PAGE_SIZE), 1);
    const normalizedPage = Math.min(Math.max(page, 1), totalPages);
    const skip = (normalizedPage - 1) * MONTH_HISTORY_PAGE_SIZE;
    const transactions = await this.transactionRepository.findByUserIdAndDateRange(
      user._id,
      dateRange.startDate,
      dateRange.endDate,
      MONTH_HISTORY_PAGE_SIZE,
      skip
    );

    return {
      transactions,
      page: normalizedPage,
      pageSize: MONTH_HISTORY_PAGE_SIZE,
      totalCount,
      totalPages,
    };
  }

  private getDateRange(period: HistoryPeriod, timezone: string): DateRange {
    return getCurrentDateRangeInTimezone(period, timezone);
  }
}
