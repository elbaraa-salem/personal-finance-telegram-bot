import { Workbook } from "exceljs";
import { TransactionDocument } from "../../infrastructure/database/models/transaction.model";
import { TransactionRepository } from "../../infrastructure/repositories/transaction.repository";
import { UserRepository } from "../../infrastructure/repositories/user.repository";

type ReportSummary = {
  totalIncome: number;
  personalExpenses: number;
  familyExpenses: number;
  totalExpenses: number;
  balance: number;
  transactionCount: number;
};

function formatDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();

  return `${day}-${month}-${year}`;
}

function calculateSummary(transactions: TransactionDocument[]): ReportSummary {
  const summary: ReportSummary = {
    totalIncome: 0,
    personalExpenses: 0,
    familyExpenses: 0,
    totalExpenses: 0,
    balance: 0,
    transactionCount: transactions.length,
  };

  for (const transaction of transactions) {
    if (transaction.type === "income") {
      summary.totalIncome += transaction.amount;
      continue;
    }

    summary.totalExpenses += transaction.amount;

    if (transaction.scope === "personal") {
      summary.personalExpenses += transaction.amount;
    } else if (transaction.scope === "family") {
      summary.familyExpenses += transaction.amount;
    }
  }

  summary.balance = summary.totalIncome - summary.totalExpenses;

  return summary;
}

export class ReportExcelExportService {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly userRepository: UserRepository
  ) {}

  async generateReportBuffer(
    telegramId: number,
    startDate: Date,
    endDateExclusive: Date
  ): Promise<Buffer> {
    const user = await this.userRepository.findByTelegramId(telegramId);

    if (!user) {
      throw new Error("User not found. Please send /start first.");
    }

    const transactions =
      await this.transactionRepository.findAllByUserIdAndDateRange(
        user._id,
        startDate,
        endDateExclusive
      );
    const summary = calculateSummary(transactions);
    const workbook = new Workbook();
    const transactionsSheet = workbook.addWorksheet("Transactions");

    transactionsSheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Type", key: "type", width: 12 },
      { header: "Scope", key: "scope", width: 12 },
      { header: "Amount", key: "amount", width: 14 },
      { header: "Category", key: "category", width: 24 },
      { header: "Note", key: "note", width: 40 },
      { header: "Created At", key: "createdAt", width: 22 },
    ];
    transactionsSheet.views = [{ state: "frozen", ySplit: 1 }];
    transactionsSheet.autoFilter = "A1:G1";
    transactionsSheet.getRow(1).font = { bold: true };

    for (const transaction of transactions) {
      transactionsSheet.addRow({
        date: formatDate(transaction.transactionDate),
        type: transaction.type,
        scope: transaction.scope ?? "",
        amount: transaction.amount,
        category: transaction.category,
        note: transaction.note ?? "",
        createdAt: formatDate(transaction.createdAt),
      });
    }

    transactionsSheet.getColumn("amount").numFmt = "0.00";

    const summarySheet = workbook.addWorksheet("Summary");
    const endInclusive = new Date(endDateExclusive);
    endInclusive.setUTCDate(endInclusive.getUTCDate() - 1);

    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 28 },
      { header: "Value", key: "value", width: 18 },
    ];
    summarySheet.views = [{ state: "frozen", ySplit: 1 }];
    summarySheet.autoFilter = "A1:B1";
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.addRows([
      { metric: "Total income", value: summary.totalIncome },
      { metric: "Personal expenses", value: summary.personalExpenses },
      { metric: "Family expenses", value: summary.familyExpenses },
      { metric: "Total expenses", value: summary.totalExpenses },
      { metric: "Balance", value: summary.balance },
      { metric: "Transactions count", value: summary.transactionCount },
      { metric: "Period start", value: formatDate(startDate) },
      { metric: "Period end inclusive", value: formatDate(endInclusive) },
    ]);
    summarySheet.getColumn("value").numFmt = "0.00";

    const buffer = await workbook.xlsx.writeBuffer();

    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  }
}
