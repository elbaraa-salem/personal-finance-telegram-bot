import { Bot, Context } from "grammy";
import {
  HistoryPeriod,
  HistoryService,
} from "../../application/services/history.service";
import { TransactionDocument } from "../../infrastructure/database/models/transaction.model";
import { formatDate } from "../formatters/date.formatter";
import { formatTransactionLine } from "../formatters/transaction.formatter";
import { BotContext } from "../context";
import { UserService } from "../../application/services/user.service";
import { SupportedLanguage } from "../i18n/language";
import { getMessages } from "../i18n/translations";

type ParsedHistoryArgument =
  | { type: "default" }
  | { type: "limit"; limit: number }
  | { type: "date"; date: Date }
  | { type: "invalid" };

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

function parseHistoryArgument(text: string | undefined): ParsedHistoryArgument {
  if (!text) {
    return { type: "default" };
  }

  const parts = text.trim().split(/\s+/);
  const argument = parts[1];

  if (!argument) {
    return { type: "default" };
  }

  const limit = Number(argument);

  if (Number.isInteger(limit) && limit > 0) {
    return {
      type: "limit",
      limit,
    };
  }

  const date = parseDate(argument);

  if (date) {
    return {
      type: "date",
      date,
    };
  }

  return { type: "invalid" };
}

async function replyWithTransactions(
  ctx: Context,
  title: string,
  transactions: TransactionDocument[],
  language: SupportedLanguage,
  currency: string
): Promise<void> {
  const messages = getMessages(language);

  if (transactions.length === 0) {
    await ctx.reply(`${title}\n\n${messages.history.empty}`);
    return;
  }

  const historyText = transactions
    .map((transaction, index) =>
      formatTransactionLine(transaction, index, language, currency)
    )
    .join("\n\n");

  await ctx.reply(`${title}\n\n${historyText}`);
}

async function replyWithPeriodHistory(
  ctx: Context,
  historyService: HistoryService,
  userService: UserService,
  period: HistoryPeriod,
  titleKey: HistoryPeriod,
): Promise<void> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    await ctx.reply(getMessages().common.readUserError);
    return;
  }

  const language = await userService.getUserLanguage(telegramUser.id);
  const messages = getMessages(language);

  try {
    const language = await userService.getUserLanguage(telegramUser.id);
    const currency = await userService.getUserCurrency(telegramUser.id);
    const messages = getMessages(language);

    const transactions = await historyService.getTransactionsForPeriod(
      telegramUser.id,
      period
    );

    const title =
      titleKey === "month"
        ? messages.history.titles.month(formatDate(new Date()).slice(0, 7))
        : messages.history.titles[titleKey];

    await replyWithTransactions(ctx, title, transactions, language, currency);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : messages.common.unexpectedError;

    await ctx.reply(`❌ ${message}`);
  }
}

export function registerHistoryCommand(
  bot: Bot<BotContext>,
  historyService: HistoryService,
  userService: UserService,
): void {
  bot.command("history", async (ctx) => {
    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply(getMessages().common.readUserError);
      return;
    }

    const language = await userService.getUserLanguage(telegramUser.id);
    const currency = await userService.getUserCurrency(telegramUser.id);

    const messages = getMessages(language);

    const parsedArgument = parseHistoryArgument(ctx.message?.text);

    if (parsedArgument.type === "invalid") {
      await ctx.reply(messages.history.invalidUsage);
      return;
    }

    try {
      if (parsedArgument.type === "limit") {
        const transactions = await historyService.getRecentTransactions(
          telegramUser.id,
          parsedArgument.limit
        );

        await replyWithTransactions(
          ctx,
          messages.history.titles.recent(transactions.length),
          transactions,
          language,
          currency
        );
        return;
      }

      if (parsedArgument.type === "date") {
        const transactions = await historyService.getTransactionsForDate(
          telegramUser.id,
          parsedArgument.date
        );

        const dateText = formatDate(parsedArgument.date);

        await replyWithTransactions(
          ctx,
          messages.history.titles.date(dateText),
          transactions,
          language,
          currency
        );
        return;
      }

      const transactions = await historyService.getRecentTransactions(
        telegramUser.id
      );

      await replyWithTransactions(
        ctx,
        messages.history.titles.recent(transactions.length),
        transactions,
        language,
        currency
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : messages.common.unexpectedError;
      await ctx.reply(`❌ ${message}`);
    }
  });

  bot.command("history_day", async (ctx) => {
    await replyWithPeriodHistory(ctx, historyService, userService, "day", "day");
  });

  bot.command("history_week", async (ctx) => {
    await replyWithPeriodHistory(ctx, historyService, userService, "week", "week");
  });

  bot.command("history_month", async (ctx) => {
    await replyWithPeriodHistory(
      ctx,
      historyService,
      userService,
      "month",
      "month"
    );
  });

  bot.command("history_year", async (ctx) => {
    await replyWithPeriodHistory(ctx, historyService, userService, "year", "year");
  });
}
