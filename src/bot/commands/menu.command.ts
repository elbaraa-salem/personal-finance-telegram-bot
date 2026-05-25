import { Bot, Context } from "grammy";
import {
  ReportPeriod,
  ReportService,
} from "../../application/services/report.service";
import { HistoryService } from "../../application/services/history.service";
import { isValidYearMonth } from "../../application/services/month-date-range";
import { createMainMenuKeyboard, getMainMenuButtonTexts } from "../keyboards/main-menu.keyboard";
import { formatReport } from "../formatters/report.formatter";
import { formatTransactionLine } from "../formatters/transaction.formatter";
import { BotContext } from "../context";
import { UserService } from "../../application/services/user.service";
import { getMessages } from "../i18n/translations";
import { askForLanguage } from "./language.command";
import { askForCurrency } from "./currency.command";
import {
  createSettingsOptionsKeyboard,
  settingsOptionCallbacks,
} from "../keyboards/settings-options.keyboard";
import {
  createHistoryPaginationKeyboard,
  createMonthSelectionKeyboard,
} from "../keyboards/month-selection.keyboard";

async function replyWithReport(
  ctx: Context,
  reportService: ReportService,
  userService: UserService,
  period: ReportPeriod
): Promise<void> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    await ctx.reply(getMessages().common.readUserError);
    return;
  }

  const language = await userService.getUserLanguage(telegramUser.id);
  const currency = await userService.getUserCurrency(telegramUser.id);
  const messages = getMessages(language);

  try {
    const language = await userService.getUserLanguage(telegramUser.id);

    const report = await reportService.getUserSummaryForPeriod(
      telegramUser.id,
      period
    );

    await ctx.reply(formatReport(report, language, currency));
  } catch (error) {
    const message =
        error instanceof Error ? error.message : messages.common.unexpectedError;

    await ctx.reply(`❌ ${message}`);
  }
}

function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseYearMonth(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!isValidYearMonth(year, month)) {
    return null;
  }

  return { year, month };
}

function parseHistoryMonthCallback(
  data: string
): { year: number; month: number; page: number } | null {
  const match = /^history_month:(\d{4}-\d{2}):(\d+)$/.exec(data);

  if (!match) {
    return null;
  }

  const yearMonthText = match[1];
  const page = Number(match[2]);

  if (!yearMonthText || !Number.isInteger(page) || page < 1) {
    return null;
  }

  const yearMonth = parseYearMonth(yearMonthText);

  if (!yearMonth) {
    return null;
  }

  return {
    ...yearMonth,
    page,
  };
}

async function replyWithAvailableReportMonths(
  ctx: Context,
  reportService: ReportService,
  userService: UserService
): Promise<void> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    await ctx.reply(getMessages().common.readUserError);
    return;
  }

  const language = await userService.getUserLanguage(telegramUser.id);
  const messages = getMessages(language);

  try {
    const months = await reportService.getAvailableReportMonths(telegramUser.id);

    if (months.length === 0) {
      await ctx.reply(messages.history.noTransactionsYet);
      return;
    }

    await ctx.reply(messages.history.chooseReportMonth, {
      reply_markup: createMonthSelectionKeyboard(months, "report_month", language),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : messages.common.unexpectedError;

    await ctx.reply(`❌ ${message}`);
  }
}

async function replyWithAvailableHistoryMonths(
  ctx: Context,
  historyService: HistoryService,
  userService: UserService
): Promise<void> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    await ctx.reply(getMessages().common.readUserError);
    return;
  }
  const language = await userService.getUserLanguage(telegramUser.id);
  const messages = getMessages(language);

  try {
    const months = await historyService.getAvailableHistoryMonths(telegramUser.id);

    if (months.length === 0) {
      await ctx.reply(messages.history.noTransactionsYet);
      return;
    }

    await ctx.reply(messages.history.chooseHistoryMonth, {
      reply_markup: createMonthSelectionKeyboard(months, "history_month", language),
    });
  } catch (error) {
    const message =
        error instanceof Error ? error.message : messages.common.unexpectedError;

    await ctx.reply(`❌ ${message}`);
  }
}

async function replyWithMonthReport(
  ctx: Context,
  reportService: ReportService,
  userService: UserService,
  year: number,
  month: number
): Promise<void> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    await ctx.reply(getMessages().common.readUserError);
    return;
  }

  const language = await userService.getUserLanguage(telegramUser.id);
  const currency = await userService.getUserCurrency(telegramUser.id);
  const messages = getMessages(language);

  try {
    const report = await reportService.getMonthReport(telegramUser.id, year, month);

    if (report.transactionCount === 0) {
      await ctx.reply(messages.history.noTransactionsInMonth);
      return;
    }

    await ctx.reply(formatReport(report, language, currency));
  } catch (error) {
    const message =
        error instanceof Error ? error.message : messages.common.unexpectedError;

    await ctx.reply(`❌ ${message}`);
  }
}

async function replyWithMonthHistory(
  ctx: Context,
  historyService: HistoryService,
  userService: UserService,
  year: number,
  month: number,
  page: number
): Promise<void> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    await ctx.reply(getMessages().common.readUserError);
    return;
  }

  const language = await userService.getUserLanguage(telegramUser.id);
  const currency = await userService.getUserCurrency(telegramUser.id);
  const messages = getMessages(language);

  try {
    const result = await historyService.getTransactionsForMonth(
      telegramUser.id,
      year,
      month,
      page
    );

    if (result.transactions.length === 0) {
      await ctx.reply(messages.history.noTransactionsInMonth);
      return;
    }

    const historyText = result.transactions
      .map((transaction, index) =>
        formatTransactionLine(
          transaction,
          (result.page - 1) * result.pageSize + index,
          language,
          currency
        )
      )
      .join("\n\n");
    const title = messages.history.titles.month(formatYearMonth(year, month));
    const pageText = messages.history.page(result.page, result.totalPages);
    const replyMarkup = createHistoryPaginationKeyboard(
      year,
      month,
      result.page,
      result.totalPages,
      language
    );

    if (replyMarkup) {
      await ctx.reply(`${title}\n${pageText}\n\n${historyText}`, {
        reply_markup: replyMarkup,
      });
      return;
    }

    await ctx.reply(`${title}\n\n${historyText}`);
  } catch (error) {
    const message =
        error instanceof Error ? error.message : messages.common.unexpectedError;

    await ctx.reply(`❌ ${message}`);
  }
}

export function registerMenuCommandHandlers(
  bot: Bot<BotContext>,
  reportService: ReportService,
  historyService: HistoryService,
  userService: UserService
): void {

  bot.hears(getMainMenuButtonTexts("history"), async (ctx) => {
    await replyWithAvailableHistoryMonths(ctx, historyService, userService);
  });

  bot.hears(getMainMenuButtonTexts("reportDay"), async (ctx) => {
    await replyWithReport(ctx, reportService, userService, "day");
  });

  bot.hears(getMainMenuButtonTexts("moreReports"), async (ctx) => {
    await replyWithAvailableReportMonths(ctx, reportService, userService);
  });

    bot.callbackQuery(/^report_month:(\d{4}-\d{2})$/, async (ctx) => {
      await ctx.answerCallbackQuery();

      const yearMonth = parseYearMonth(ctx.match[1] ?? "");

      if (!yearMonth) {
        return;
      }

      await replyWithMonthReport(
        ctx,
        reportService,
        userService,
        yearMonth.year,
        yearMonth.month
      );
    });

    bot.callbackQuery(/^history_month:(\d{4}-\d{2}):(\d+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();

      const parsedCallback = parseHistoryMonthCallback(ctx.callbackQuery.data);

      if (!parsedCallback) {
        return;
      }

      await replyWithMonthHistory(
        ctx,
        historyService,
        userService,
        parsedCallback.year,
        parsedCallback.month,
        parsedCallback.page
      );
    });

    bot.hears(getMainMenuButtonTexts("settings"), async (ctx) => {
        const telegramUser = ctx.from;

        if (!telegramUser) {
            await ctx.reply(getMessages().common.readUserError);
            return;
        }

        const language = await userService.getUserLanguage(telegramUser.id);

        await ctx.reply(getMessages(language).menu.settings, {
            reply_markup: createSettingsOptionsKeyboard(language),
        });
    });

    bot.callbackQuery(settingsOptionCallbacks.language, async (ctx) => {
        await ctx.answerCallbackQuery();
        await askForLanguage(ctx);
    });

        bot.callbackQuery(settingsOptionCallbacks.currency, async (ctx) => {
        await ctx.answerCallbackQuery();
        await askForCurrency(ctx, userService);
    });

    bot.hears(getMainMenuButtonTexts("help"), async (ctx) => {
    const telegramUser = ctx.from;

    if (!telegramUser) {
        await ctx.reply(getMessages().common.readUserError);
        return;
    }

    const language = await userService.getUserLanguage(telegramUser.id);
    const currency = await userService.getUserCurrency(telegramUser.id);
    const messages = getMessages(language);

    await ctx.reply(messages.help.text(currency), {
        reply_markup: createMainMenuKeyboard(language),
    });
    });
}
