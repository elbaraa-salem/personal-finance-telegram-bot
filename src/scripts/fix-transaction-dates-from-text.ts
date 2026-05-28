import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "../infrastructure/database/mongoose";
import {
  TransactionDocument,
  TransactionModel,
} from "../infrastructure/database/models/transaction.model";

type Mode = "dry-run" | "apply";

type ParsedArgs = {
  mode: Mode;
  userId?: Types.ObjectId;
};

type DateMatch = {
  raw: string;
  date: Date;
  index: number;
};

type PlannedChange = {
  transaction: TransactionDocument;
  transactionDate: Date;
  category: string;
  note?: string;
};

type Summary = {
  scanned: number;
  matched: number;
  updated: number;
  skipped: number;
};

const DATE_PATTERN = /(?<!\d)(?:(\d{2})[-./](\d{2})[-./](\d{4})|(\d{4})[-./](\d{2})[-./](\d{2}))(?!\d)/;
const MAX_DRY_RUN_EXAMPLES = 10;

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const isDryRun = args.includes("--dry-run");
  const userIdArg = args.find((arg) => arg.startsWith("--userId="));

  if (isApply === isDryRun) {
    throw new Error("Pass exactly one mode: --dry-run or --apply.");
  }

  const userIdText = userIdArg?.slice("--userId=".length);

  if (userIdText && !Types.ObjectId.isValid(userIdText)) {
    throw new Error(`Invalid --userId value: ${userIdText}`);
  }

  return {
    mode: isApply ? "apply" : "dry-run",
    ...(userIdText ? { userId: new Types.ObjectId(userIdText) } : {}),
  };
}

function parseDateMatch(raw: string, index: number): DateMatch | null {
  const match = DATE_PATTERN.exec(raw);

  if (!match) {
    return null;
  }

  const isDayFirst = Boolean(match[1] && match[2] && match[3]);
  const isYearFirst = Boolean(match[4] && match[5] && match[6]);

  if (!isDayFirst && !isYearFirst) {
    return null;
  }

  const day = Number(isDayFirst ? match[1] : match[6]);
  const month = Number(isDayFirst ? match[2] : match[5]);
  const year = Number(isDayFirst ? match[3] : match[4]);
  const date = new Date(Date.UTC(year, month - 1, day));

  const isValidDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isValidDate) {
    return null;
  }

  return {
    raw: match[0],
    date,
    index,
  };
}

function findDate(text: string | undefined): DateMatch | null {
  if (!text) {
    return null;
  }

  const match = DATE_PATTERN.exec(text);

  if (!match) {
    return null;
  }

  return parseDateMatch(match[0], match.index);
}

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function removeFirstDate(text: string, dateText: string): string {
  return normalizeSpaces(
    text
      .replace(dateText, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/^[,.;:!?]\s*/, "")
      .replace(/\s*[,.;:!?]$/, "")
  );
}

function isWholeDate(text: string): DateMatch | null {
  const trimmedText = text.trim();
  const match = findDate(trimmedText);

  if (!match) {
    return null;
  }

  return match.raw === trimmedText ? match : null;
}

function getFallbackCategory(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) {
    return "أخرى";
  }

  if (/[А-Яа-яЁё]/.test(text)) {
    return "другое";
  }

  return "other";
}

function inferCategoryFromNote(note: string | undefined): {
  category: string;
  note?: string;
} {
  const normalizedNote = normalizeSpaces(note ?? "");

  if (!normalizedNote) {
    return {
      category: getFallbackCategory(""),
    };
  }

  const words = normalizedNote.split(" ");
  const categoryWordIndex = words.findIndex((word) => {
    const cleanedWord = word.replace(/^[,.;:!?]+|[,.;:!?]+$/g, "");

    return Boolean(cleanedWord) && !isWholeDate(cleanedWord);
  });
  const category = words[categoryWordIndex]?.replace(/^[,.;:!?]+|[,.;:!?]+$/g, "");

  if (!category) {
    return {
      category: getFallbackCategory(normalizedNote),
      note: normalizedNote,
    };
  }

  const restNote = normalizeSpaces(
    words
      .filter((word, index) => index !== categoryWordIndex && !isWholeDate(word))
      .join(" ")
  );

  return {
    category,
    ...(restNote ? { note: restNote } : {}),
  };
}

function planChange(transaction: TransactionDocument): PlannedChange | null {
  const originalCategory = transaction.category;
  const originalNote = transaction.note;
  const categoryDateOnly = isWholeDate(originalCategory);

  if (categoryDateOnly) {
    const inferred = inferCategoryFromNote(originalNote);

    return {
      transaction,
      transactionDate: categoryDateOnly.date,
      category: inferred.category,
      ...(inferred.note ? { note: inferred.note } : {}),
    };
  }

  const noteDate = findDate(originalNote);

  if (noteDate) {
    const cleanedNote = removeFirstDate(originalNote ?? "", noteDate.raw);

    return {
      transaction,
      transactionDate: noteDate.date,
      category: originalCategory,
      ...(cleanedNote ? { note: cleanedNote } : {}),
    };
  }

  const categoryDate = findDate(originalCategory);

  if (categoryDate) {
    const cleanedCategory = removeFirstDate(originalCategory, categoryDate.raw);

    if (!cleanedCategory) {
      return null;
    }

    return {
      transaction,
      transactionDate: categoryDate.date,
      category: cleanedCategory,
      ...(originalNote ? { note: originalNote } : {}),
    };
  }

  return null;
}

function printDryRunExample(change: PlannedChange): void {
  const transaction = change.transaction;

  console.log("\n---");
  console.log(`Transaction: ${transaction._id.toString()}`);
  console.log("Before:");
  console.log({
    transactionDate: transaction.transactionDate.toISOString(),
    category: transaction.category,
    note: transaction.note,
  });
  console.log("After:");
  console.log({
    transactionDate: change.transactionDate.toISOString(),
    category: change.category,
    note: change.note,
  });
}

async function applyChange(change: PlannedChange): Promise<boolean> {
  const set: Record<string, unknown> = {
    transactionDate: change.transactionDate,
    category: change.category,
    migrationBackup: {
      transactionDateBeforeDateTextFix: change.transaction.transactionDate,
      categoryBeforeDateTextFix: change.transaction.category,
      noteBeforeDateTextFix: change.transaction.note ?? "",
      fixedAt: new Date(),
    },
  };

  if (change.note) {
    set.note = change.note;
  }

  const unset = change.note ? undefined : { note: "" };

  const result = await TransactionModel.updateOne(
    {
      _id: change.transaction._id,
      "migrationBackup.transactionDateBeforeDateTextFix": { $exists: false },
    },
    {
      $set: set,
      ...(unset ? { $unset: unset } : {}),
    }
  ).exec();

  return result.modifiedCount > 0;
}

async function run(): Promise<void> {
  const args = parseArgs();
  const summary: Summary = {
    scanned: 0,
    matched: 0,
    updated: 0,
    skipped: 0,
  };
  let printedExamples = 0;

  await connectToDatabase();

  const query = {
    "migrationBackup.transactionDateBeforeDateTextFix": { $exists: false },
    ...(args.userId ? { userId: args.userId } : {}),
  };

  console.log(`Mode: ${args.mode}`);
  if (args.userId) {
    console.log(`User filter: ${args.userId.toString()}`);
  }

  for await (const transaction of TransactionModel.find(query).cursor()) {
    summary.scanned += 1;

    const change = planChange(transaction);

    if (!change) {
      summary.skipped += 1;
      continue;
    }

    summary.matched += 1;

    if (args.mode === "dry-run") {
      if (printedExamples < MAX_DRY_RUN_EXAMPLES) {
        printDryRunExample(change);
        printedExamples += 1;
      }
      continue;
    }

    const wasUpdated = await applyChange(change);

    if (wasUpdated) {
      summary.updated += 1;
    } else {
      summary.skipped += 1;
    }
  }

  console.log("\nSummary:");
  console.log(`Scanned: ${summary.scanned}`);
  console.log(`Matched: ${summary.matched}`);
  console.log(`Updated: ${summary.updated}`);
  console.log(`Skipped: ${summary.skipped}`);

  if (args.mode === "dry-run") {
    console.log("\nDry run only. No transactions were changed.");
    console.log("Run apply mode to save changes.");
  }
}

run()
  .catch((error) => {
    console.error("❌ Date text migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
