import {
  CategorySummaryItem,
  TransactionRepository,
  TransactionMonthItem,
  TransactionSummary,
} from "../../infrastructure/repositories/transaction.repository";
import { UserRepository } from "../../infrastructure/repositories/user.repository";
import { getMonthDateRange } from "./month-date-range";

export type ReportPeriod = "all" | "day" | "week" | "month" | "year";

export type ReportResult = TransactionSummary & {
  period: ReportPeriod;
  startDate?: Date;
  endDate?: Date;
  categorySummary: CategorySummaryItem[];
};

type DateRange = {
  startDate: Date;
  endDate: Date;
};

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
    period: ReportPeriod
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

    const dateRange = this.getDateRange(period);
    const summary =
      await this.transactionRepository.getSummaryByUserIdAndDateRange(
        user._id,
        dateRange.startDate,
        dateRange.endDate
      );
    const categorySummary =
      await this.transactionRepository.getCategorySummaryByUserIdAndDateRange(
        user._id,
        dateRange.startDate,
        dateRange.endDate
      );

    return {
      period,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      categorySummary,
      ...summary,
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
    const summary =
      await this.transactionRepository.getSummaryByUserIdAndDateRange(
        user._id,
        dateRange.startDate,
        dateRange.endDate
      );
    const categorySummary =
      await this.transactionRepository.getCategorySummaryByUserIdAndDateRange(
        user._id,
        dateRange.startDate,
        dateRange.endDate
      );

    return {
      period: "month",
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      categorySummary,
      ...summary,
    };
  }

  private getDateRange(period: Exclude<ReportPeriod, "all">): DateRange {
    const now = new Date();

    if (period === "day") {
      const startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

      const endDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      );

      return {
        startDate,
        endDate,
      };
    }

    if (period === "week") {
      const dayOfWeek = now.getDay(); // Sunday = 0
      const daysFromMonday = (dayOfWeek + 6) % 7;

      const startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - daysFromMonday
      );

      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 7);

      return {
        startDate,
        endDate,
      };
    }

    if (period === "month") {
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      return {
        startDate,
        endDate,
      };
    }

    const startDate = new Date(now.getFullYear(), 0, 1);
    const endDate = new Date(now.getFullYear() + 1, 0, 1);

    return {
      startDate,
      endDate,
    };
  }
}
