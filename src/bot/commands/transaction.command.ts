import { Bot } from "grammy";
import { TransactionService } from "../../application/services/transaction.service";
import { UserService } from "../../application/services/user.service";
import {
  TransactionScope,
  TransactionType,
} from "../../infrastructure/database/models/transaction.model";
import { ExpenseScopeMode } from "../../infrastructure/database/models/user.model";
import { BotContext } from "../context";
import { formatCreatedTransaction } from "../formatters/transaction.formatter";
import { getMessages } from "../i18n/translations";

type ParsedTransactionInput = {
  type: TransactionType;
  scope?: TransactionScope;
  amount: number;
  category: string;
  note?: string;
  transactionDate?: Date;
};

function parseAmount(text: string): number | null {
  const amount = Number(text.replace(",", "."));

  if (Number.isNaN(amount) || amount <= 0) {
    return null;
  }

  return amount;
}

function parseDate(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (!match) {
    return null;
  }

  const yearText = match[1];
  const monthText = match[2];
  const dayText = match[3];

  if (!yearText || !monthText || !dayText) {
    return null;
  }

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const date = new Date(Date.UTC(year, month - 1, day));

  const isValidDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return isValidDate ? date : null;
}

function isDateText(text: string | undefined): text is string {
  return typeof text === "string" && /^\d{4}-\d{2}-\d{2}$/.test(text);
}

function parseTransactionParts(
  type: TransactionType,
  parts: string[],
  amountIndex: number,
  categoryIndex: number
): ParsedTransactionInput | null {
  const amountText = parts[amountIndex];
  const category = parts[categoryIndex];

  if (!amountText || !category) {
    return null;
  }

  const amount = parseAmount(amountText);

  if (!amount) {
    return null;
  }

  const possibleDate = parts[categoryIndex + 1];

  if (isDateText(possibleDate)) {
    const transactionDate = parseDate(possibleDate);

    if (!transactionDate) {
      return null;
    }

    const noteParts = parts.slice(categoryIndex + 2);

    return {
      type,
      amount,
      category,
      transactionDate,
      ...(noteParts.length > 0 ? { note: noteParts.join(" ") } : {}),
    };
  }

  const noteParts = parts.slice(categoryIndex + 1);

  return {
    type,
    amount,
    category,
    ...(noteParts.length > 0 ? { note: noteParts.join(" ") } : {}),
  };
}

function parseCommandTransaction(
  text: string,
  type: TransactionType
): ParsedTransactionInput | null {
  const parts = text.trim().split(/\s+/);

  return parseTransactionParts(type, parts, 1, 2);
}

function parseShortcutTransaction(text: string): ParsedTransactionInput | null {
  const parts = text.trim().split(/\s+/);
  const sign = parts[0];

  if (sign !== "+" && sign !== "-") {
    return null;
  }

  const type: TransactionType = sign === "+" ? "income" : "expense";
  const parsedTransaction = parseTransactionParts(type, parts, 1, 2);

  if (!parsedTransaction) {
    return null;
  }

  return {
    ...parsedTransaction,
    ...(type === "expense" ? { scope: "family" as TransactionScope } : {}),
  };
}

function isShortcutTransactionText(text: string): boolean {
  const trimmedText = text.trim();

  return trimmedText.startsWith("+") || trimmedText.startsWith("-");
}

function getForcedScopeFromUserMode(mode: ExpenseScopeMode): TransactionScope | undefined {
  if (mode === "personal_only") {
    return "personal";
  }

  if (mode === "family_only") {
    return "family";
  }

  return undefined;
}

async function handleParsedTransaction(
  ctx: BotContext,
  parsedTransaction: ParsedTransactionInput,
  transactionService: TransactionService,
  userService: UserService
): Promise<void> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    await ctx.reply(getMessages().manualTransaction.readUserError);
    return;
  }

  const language = await userService.getUserLanguage(telegramUser.id);
  const currency = await userService.getUserCurrency(telegramUser.id);
  const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);
  const forcedScope = parsedTransaction.type === "expense"
    ? getForcedScopeFromUserMode(expenseScopeMode)
    : undefined;
  const messages = getMessages(language);

  try {
    const transaction = await transactionService.addTransaction({
      telegramId: telegramUser.id,
      type: parsedTransaction.type,
      ...(forcedScope ?? parsedTransaction.scope ? { scope: forcedScope ?? parsedTransaction.scope } : {}),
      amount: parsedTransaction.amount,
      category: parsedTransaction.category,
      ...(parsedTransaction.note ? { note: parsedTransaction.note } : {}),
      ...(parsedTransaction.transactionDate
        ? { transactionDate: parsedTransaction.transactionDate }
        : {}),
    });

    await ctx.reply(formatCreatedTransaction(transaction, language, currency));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : messages.manualTransaction.unexpectedError;

    await ctx.reply(`❌ ${message}`);
  }
}

function registerTransactionCommand(
  bot: Bot<BotContext>,
  command: "income" | "expense",
  type: TransactionType,
  transactionService: TransactionService,
  userService: UserService
): void {
  bot.command(command, async (ctx) => {
    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply(getMessages().manualTransaction.readUserError);
      return;
    }

    const language = await userService.getUserLanguage(telegramUser.id);
    const messages = getMessages(language);

    const text = ctx.message?.text;

    if (!text) {
      await ctx.reply(
        command === "income"
          ? messages.manualTransaction.incomeUsage
          : messages.manualTransaction.expenseUsage
      );
      return;
    }

    const parsedTransaction = parseCommandTransaction(text, type);

    if (!parsedTransaction) {
      await ctx.reply(
        command === "income"
          ? messages.manualTransaction.incomeUsage
          : messages.manualTransaction.expenseUsage
      );
      return;
    }

    await handleParsedTransaction(
      ctx,
      parsedTransaction,
      transactionService,
      userService
    );
  });
}

export function registerTransactionCommands(
  bot: Bot<BotContext>,
  transactionService: TransactionService,
  userService: UserService
): void {
  registerTransactionCommand(
    bot,
    "income",
    "income",
    transactionService,
    userService
  );

  registerTransactionCommand(
    bot,
    "expense",
    "expense",
    transactionService,
    userService
  );

  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text;

    if (!isShortcutTransactionText(text)) {
      await next();
      return;
    }

    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply(getMessages().manualTransaction.readUserError);
      return;
    }

    const language = await userService.getUserLanguage(telegramUser.id);
    const messages = getMessages(language);

    const parsedTransaction = parseShortcutTransaction(text);

    if (!parsedTransaction) {
      await ctx.reply(messages.manualTransaction.shortcutUsage);
      return;
    }

    await handleParsedTransaction(
      ctx,
      parsedTransaction,
      transactionService,
      userService
    );
  });
}
