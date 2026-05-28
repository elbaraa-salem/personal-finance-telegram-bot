import { Types } from "mongoose";
import {
  TransactionDocument,
  TransactionModel,
  TransactionType,
  TransactionScope,
  TransactionSource,
} from "../database/models/transaction.model";

type CreateTransactionData = {
  userId: Types.ObjectId;
  type: TransactionType;
  scope?: TransactionScope;
  amount: number;
  category: string;
  transactionDate: Date;
  note?: string;
  source?: TransactionSource;
};

export type TransactionSummary = {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
};

type AggregatedTransactionSummary = {
  totalIncome: number;
  totalExpense: number;
  transactionCount: number;
};

export type CategorySummaryItem = {
  type: TransactionType;
  scope?: TransactionScope;
  category: string;
  total: number;
};

export type TransactionMonthItem = {
  year: number;
  month: number;
  transactionCount: number;
};

type AggregatedCategorySummary = {
  _id: {
    type: TransactionType;
    scope?: TransactionScope;
    category: string;
  };
  total: number;
};

type AggregatedTransactionMonth = {
  _id: {
    year: number;
    month: number;
  };
  transactionCount: number;
};

export class TransactionRepository {
  async create(data: CreateTransactionData): Promise<TransactionDocument> {
    return TransactionModel.create(data);
  }

  async createMany(data: CreateTransactionData[]): Promise<TransactionDocument[]> {
    return TransactionModel.insertMany(data);
  }

  async findRecentByUserId(
        userId: Types.ObjectId,
        limit: number
    ): Promise<TransactionDocument[]> {
        return TransactionModel.find({ userId })
            .sort({ transactionDate: -1, createdAt: -1 })
            .limit(limit)
            .exec();
    }

  async deleteLatestByUserId(
    userId: Types.ObjectId
  ): Promise<TransactionDocument | null> {
    return TransactionModel.findOneAndDelete(
      { userId },
      { sort: { createdAt: -1 } }
    ).exec();
  }

  async findLatestByUserId(
    userId: Types.ObjectId
  ): Promise<TransactionDocument | null> {
    return TransactionModel.findOne({ userId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async deleteByIdAndUserId(
    userId: Types.ObjectId,
    transactionId: string | Types.ObjectId
  ): Promise<TransactionDocument | null> {
    if (!Types.ObjectId.isValid(transactionId)) {
      return null;
    }

    return TransactionModel.findOneAndDelete({
      _id: new Types.ObjectId(transactionId),
      userId,
    }).exec();
  }

  async deleteManyByIds(
    userId: Types.ObjectId,
    transactionIds: Array<string | Types.ObjectId>
  ): Promise<number> {
    const objectIds = transactionIds
      .filter((transactionId) => Types.ObjectId.isValid(transactionId))
      .map((transactionId) => new Types.ObjectId(transactionId));

    if (objectIds.length === 0) {
      return 0;
    }

    const result = await TransactionModel.deleteMany({
      userId,
      _id: { $in: objectIds },
    }).exec();

    return result.deletedCount ?? 0;
  }

  async getSummaryByUserId(userId: Types.ObjectId): Promise<TransactionSummary> {
    const result = await TransactionModel.aggregate<AggregatedTransactionSummary>(
      [
        {
          $match: {
            userId,
          },
        },
        this.createSummaryGroupStage(),
      ]
    );

    return this.toTransactionSummary(result[0]);
  }

  async getSummaryByUserIdAndDateRange(
  userId: Types.ObjectId,
  startDate: Date,
  endDate: Date
  ): Promise<TransactionSummary> {
      const result = await TransactionModel.aggregate<AggregatedTransactionSummary>(
          [
          {
              $match: {
              userId,
              transactionDate: {
                  $gte: startDate,
                  $lt: endDate,
              },
              },
          },
          this.createSummaryGroupStage(),
          ]
      );

      return this.toTransactionSummary(result[0]);
  }


  async getCategorySummaryByUserId(
    userId: Types.ObjectId
  ): Promise<CategorySummaryItem[]> {
    return this.getCategorySummary({ userId });
  }

  async getCategorySummaryByUserIdAndDateRange(
    userId: Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<CategorySummaryItem[]> {
    return this.getCategorySummary({
      userId,
      transactionDate: {
        $gte: startDate,
        $lt: endDate,
      },
    });
  }

  async findByUserIdAndDateRange(
  userId: Types.ObjectId,
  startDate: Date,
  endDate: Date,
  limit: number,
  skip = 0
  ): Promise<TransactionDocument[]> {
  return TransactionModel.find({
    userId,
    transactionDate: {
      $gte: startDate,
      $lt: endDate,
    },
  })
    .sort({ transactionDate: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .exec();
  }

  async findAllByUserIdAndDateRange(
    userId: Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<TransactionDocument[]> {
    return TransactionModel.find({
      userId,
      transactionDate: {
        $gte: startDate,
        $lt: endDate,
      },
    })
      .sort({ transactionDate: 1, createdAt: 1 })
      .exec();
  }

  async countByUserIdAndDateRange(
    userId: Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    return TransactionModel.countDocuments({
      userId,
      transactionDate: {
        $gte: startDate,
        $lt: endDate,
      },
    }).exec();
  }

  async getAvailableMonthsByUserId(
    userId: Types.ObjectId
  ): Promise<TransactionMonthItem[]> {
    const result = await TransactionModel.aggregate<AggregatedTransactionMonth>([
      {
        $match: {
          userId,
        },
      },
      {
        $group: {
          _id: {
            year: {
              $year: {
                date: "$transactionDate",
                timezone: "UTC",
              },
            },
            month: {
              $month: {
                date: "$transactionDate",
                timezone: "UTC",
              },
            },
          },
          transactionCount: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          "_id.year": -1,
          "_id.month": -1,
        },
      },
    ]);

    return result.map((item) => ({
      year: item._id.year,
      month: item._id.month,
      transactionCount: item.transactionCount,
    }));
  }


  private async getCategorySummary(match: Record<string, unknown>): Promise<CategorySummaryItem[]> {
    const result = await TransactionModel.aggregate<AggregatedCategorySummary>([
      {
        $match: match,
      },
      {
        $group: {
          _id: {
            type: "$type",
            scope: { $ifNull: ["$scope", "family"] },
            category: "$category",
          },
          total: {
            $sum: "$amount",
          },
        },
      },
      {
        $sort: {
          "_id.type": 1,
          "_id.scope": 1,
          "_id.category": 1,
        },
      },
    ]);

    return result.map((item) => ({
      type: item._id.type,
      ...(item._id.scope ? { scope: item._id.scope } : {}),
      category: item._id.category,
      total: item.total,
    }));
  }

  private createSummaryGroupStage() {
    return {
      $group: {
        _id: null,
        totalIncome: {
          $sum: {
            $cond: [{ $eq: ["$type", "income"] }, "$amount", 0],
          },
        },
        totalExpense: {
          $sum: {
            $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0],
          },
        },
        transactionCount: {
          $sum: 1,
        },
      },
    };
  }

  private toTransactionSummary(
    summary: AggregatedTransactionSummary | undefined
  ): TransactionSummary {
    if (!summary) {
      return {
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        transactionCount: 0,
      };
    }

    return {
      totalIncome: summary.totalIncome,
      totalExpense: summary.totalExpense,
      balance: summary.totalIncome - summary.totalExpense,
      transactionCount: summary.transactionCount,
    };
  }
}
