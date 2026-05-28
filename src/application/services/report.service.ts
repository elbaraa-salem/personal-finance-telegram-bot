import {
  CategorySummaryItem,
  TransactionRepository,
  TransactionMonthItem,
  TransactionSummary,
} from "../../infrastructure/repositories/transaction.repository";
import {
  TransactionDocument,
  TransactionScope,
  TransactionType,
} from "../../infrastructure/database/models/transaction.model";
import { UserRepository } from "../../infrastructure/repositories/user.repository";
import { getMonthDateRange } from "./month-date-range";
import { config } from "../../config/env";
import { getCurrentDateRangeInTimezone } from "./timezone-date.service";

export type ReportPeriod = "all" | "day" | "week" | "month" | "year" | "custom";
export type StandardReportPeriod = Exclude<ReportPeriod, "custom">;

export type ReportResult = TransactionSummary & {
  period: ReportPeriod;
  startDate?: Date;
  endDate?: Date;
  customPeriodLabel?: string;
  categorySummary: CategorySummaryItem[];
};

type DateRange = {
  startDate: Date;
  endDate: Date;
};

function calculateTransactionSummary(
  transactions: TransactionDocument[]
): TransactionSummary {
  const summary = transactions.reduce(
    (result, transaction) => {
      if (transaction.type === "income") {
        result.totalIncome += transaction.amount;
      } else if (transaction.type === "expense") {
        result.totalExpense += transaction.amount;
      }

      return result;
    },
    {
      totalIncome: 0,
      totalExpense: 0,
    }
  );

  return {
    totalIncome: summary.totalIncome,
    totalExpense: summary.totalExpense,
    balance: summary.totalIncome - summary.totalExpense,
    transactionCount: transactions.length,
  };
}

function calculateCategorySummary(
  transactions: TransactionDocument[]
): CategorySummaryItem[] {
  const totals = new Map<string, CategorySummaryItem>();

  for (const transaction of transactions) {
    const scope = transaction.type === "expense" ? transaction.scope : undefined;
    const key = [
      transaction.type,
      scope ?? "",
      transaction.category,
    ].join("|");
    const existing = totals.get(key);

    if (existing) {
      existing.total += transaction.amount;
      continue;
    }

    totals.set(key, {
      type: transaction.type as TransactionType,
      ...(scope ? { scope: scope as TransactionScope } : {}),
      category: transaction.category,
      total: transaction.amount,
    });
  }

  return [...totals.values()].sort((left, right) => {
    const typeCompare = left.type.localeCompare(right.type);

    if (typeCompare !== 0) {
      return typeCompare;
    }

    const scopeCompare = (left.scope ?? "").localeCompare(right.scope ?? "");

    if (scopeCompare !== 0) {
      return scopeCompare;
    }

    return left.category.localeCompare(right.category);
  });
}

export class ReportService {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly userRepository: UserRepository
  ) {}

  async getUserSummary(telegramId: number): Promise<TransactionSummary> {
    const user = await this.userRepository.findByTelegramId(telegramId);

    if (!user) {
      throw new Error("User not found. Please send /start first.");
    }

    return this.transactionRepository.getSummaryByUserId(user._id);
  }

  async getUserSummaryForPeriod(
    telegramId: number,
    period: StandardReportPeriod
  ): Promise<ReportResult> {
    const user = await this.userRepository.findByTelegramId(telegramId);

    if (!user) {
      throw new Error("User not found. Please send /start first.");
    }

    if (period === "all") {
      const summary = await this.transactionRepository.getSummaryByUserId(
        user._id
      );
      const categorySummary =
        await this.transactionRepository.getCategorySummaryByUserId(user._id);

      return {
        period,
        categorySummary,
        ...summary,
      };
    }

    const dateRange = this.getDateRange(period, user.timezone ?? config.appTimezone);
    const transactions =
      await this.transactionRepository.findAllByUserIdAndDateRange(
        user._id,
        dateRange.startDate,
        dateRange.endDate
      );

    return {
      period,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      categorySummary: calculateCategorySummary(transactions),
      ...calculateTransactionSummary(transactions),
    };
  }

  async getAvailableReportMonths(
    telegramId: number
  ): Promise<TransactionMonthItem[]> {
    const user = await this.userRepository.findByTelegramId(telegramId);

    if (!user) {
      throw new Error("User not found. Please send /start first.");
    }

    return this.transactionRepository.getAvailableMonthsByUserId(user._id);
  }

  async getMonthReport(
    telegramId: number,
    year: number,
    month: number
  ): Promise<ReportResult> {
    const user = await this.userRepository.findByTelegramId(telegramId);

    if (!user) {
      throw new Error("User not found. Please send /start first.");
    }

    const dateRange = getMonthDateRange(year, month);
    const transactions =
      await this.transactionRepository.findAllByUserIdAndDateRange(
        user._id,
        dateRange.startDate,
        dateRange.endDate
      );

    return {
      period: "month",
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      categorySummary: calculateCategorySummary(transactions),
      ...calculateTransactionSummary(transactions),
    };
  }

  async getReportByDateRange(
    telegramId: number,
    startDate: Date,
    endDate: Date,
    customPeriodLabel?: string
  ): Promise<ReportResult> {
    const user = await this.userRepository.findByTelegramId(telegramId);

    if (!user) {
      throw new Error("User not found. Please send /start first.");
    }

    const transactions =
      await this.transactionRepository.findAllByUserIdAndDateRange(
        user._id,
        startDate,
        endDate
      );

    return {
      period: "custom",
      startDate,
      endDate,
      ...(customPeriodLabel ? { customPeriodLabel } : {}),
      categorySummary: calculateCategorySummary(transactions),
      ...calculateTransactionSummary(transactions),
    };
  }

  private getDateRange(
    period: Exclude<ReportPeriod, "all" | "custom">,
    timezone: string
  ): DateRange {
    return getCurrentDateRangeInTimezone(period, timezone);
  }
}
