import { Bot, Context, InputFile } from "grammy";
import {
  StandardReportPeriod,
  ReportService,
} from "../../application/services/report.service";
import { ReportExcelExportService } from "../../application/services/report-excel-export.service";
import { HistoryService } from "../../application/services/history.service";
import { isValidYearMonth } from "../../application/services/month-date-range";
import {
  createMainMenuKeyboard,
  createManualEntryKeyboard,
  getMainMenuButtonTexts,
} from "../keyboards/main-menu.keyboard";
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
  createExpenseScopeModeKeyboard,
  expenseScopeModeCallbacks,
  getExpenseScopeModeFromCallback,
} from "../keyboards/expense-scope-mode.keyboard";
import {
  createHistoryPaginationKeyboard,
  createMonthSelectionKeyboard,
  reportCustomRangeCallback,
} from "../keyboards/month-selection.keyboard";
import { createReportExcelKeyboard } from "../keyboards/report-excel.keyboard";
import {
  createTimezoneKeyboard,
  isSupportedTimezone,
} from "../keyboards/timezone.keyboard";

async function replyWithReport(
  ctx: Context,
  reportService: ReportService,
  userService: UserService,
  period: StandardReportPeriod
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

    await ctx.reply(formatReport(report, language, currency), {
      ...(report.startDate && report.endDate
        ? {
            reply_markup: createReportExcelKeyboard(
              language,
              report.startDate,
              report.endDate
            ),
          }
        : {}),
    });
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

    await ctx.reply(messages.history.chooseReportMonth, {
      reply_markup: createMonthSelectionKeyboard(
        months,
        "report_month",
        language,
        { includeCustomRange: true }
      ),
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

    if (!report.startDate || !report.endDate) {
      await ctx.reply(formatReport(report, language, currency));
      return;
    }

    await ctx.reply(formatReport(report, language, currency), {
      reply_markup: createReportExcelKeyboard(
        language,
        report.startDate,
        report.endDate
      ),
    });
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

function parseCompactDate(text: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(text);

  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  const isValidDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return isValidDate ? date : null;
}

function formatCompactDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

function createReportExcelFileName(startDate: Date, endDateExclusive: Date): string {
  const endInclusive = new Date(endDateExclusive);
  endInclusive.setUTCDate(endInclusive.getUTCDate() - 1);

  return `finance-report-${formatCompactDate(startDate)}-${formatCompactDate(endInclusive)}.xlsx`;
}

export function registerMenuCommandHandlers(
  bot: Bot<BotContext>,
  reportService: ReportService,
  historyService: HistoryService,
  userService: UserService,
  reportExcelExportService: ReportExcelExportService
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

  bot.hears(getMainMenuButtonTexts("manualEntry"), async (ctx) => {
    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply(getMessages().common.readUserError);
      return;
    }

    const language = await userService.getUserLanguage(telegramUser.id);
    const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);
    const messages = getMessages(language);

    await ctx.reply(messages.menu.chooseOperationType, {
      reply_markup: createManualEntryKeyboard(language, expenseScopeMode),
    });
  });

  bot.hears(getMainMenuButtonTexts("backToMainMenu"), async (ctx) => {
    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply(getMessages().common.readUserError);
      return;
    }

    const language = await userService.getUserLanguage(telegramUser.id);
    const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);

    await ctx.reply(getMessages(language).language.ready, {
      reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
    });
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

    bot.callbackQuery(reportCustomRangeCallback, async (ctx) => {
      await ctx.answerCallbackQuery();

      const telegramUser = ctx.from;

      if (!telegramUser) {
        await ctx.reply(getMessages().common.readUserError);
        return;
      }

      const language = await userService.getUserLanguage(telegramUser.id);

      ctx.session.pendingCustomReport = {
        step: "from",
      };

      await ctx.reply(getMessages(language).report.customRangeFromQuestion);
    });

    bot.callbackQuery(/^report_excel:(\d{8}):(\d{8})$/, async (ctx) => {
      const telegramUser = ctx.from;

      if (!telegramUser) {
        await ctx.answerCallbackQuery();
        await ctx.reply(getMessages().common.readUserError);
        return;
      }

      const language = await userService.getUserLanguage(telegramUser.id);
      const messages = getMessages(language);
      const startDate = parseCompactDate(ctx.match[1] ?? "");
      const endDateExclusive = parseCompactDate(ctx.match[2] ?? "");

      await ctx.answerCallbackQuery({
        text: messages.report.excelPreparing,
      });

      if (
        !startDate ||
        !endDateExclusive ||
        endDateExclusive.getTime() <= startDate.getTime()
      ) {
        await ctx.reply(messages.common.unexpectedError);
        return;
      }

      try {
        const buffer = await reportExcelExportService.generateReportBuffer(
          telegramUser.id,
          startDate,
          endDateExclusive
        );
        const fileName = createReportExcelFileName(startDate, endDateExclusive);

        await ctx.replyWithDocument(new InputFile(buffer, fileName));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : messages.common.unexpectedError;

        await ctx.reply(`❌ ${message}`);
      }
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

    bot.callbackQuery(settingsOptionCallbacks.expenseScopeMode, async (ctx) => {
        await ctx.answerCallbackQuery();

        const telegramUser = ctx.from;

        if (!telegramUser) {
            await ctx.reply(getMessages().common.readUserError);
            return;
        }

        const language = await userService.getUserLanguage(telegramUser.id);

        await ctx.reply(getMessages(language).expenseScopeMode.question, {
            reply_markup: createExpenseScopeModeKeyboard(language),
        });
    });

    bot.callbackQuery(settingsOptionCallbacks.timezone, async (ctx) => {
        await ctx.answerCallbackQuery();

        const telegramUser = ctx.from;

        if (!telegramUser) {
            await ctx.reply(getMessages().common.readUserError);
            return;
        }

        const language = await userService.getUserLanguage(telegramUser.id);

        await ctx.reply(getMessages(language).timezone.choose, {
            reply_markup: createTimezoneKeyboard(),
        });
    });

    bot.callbackQuery(/^timezone:(.+)$/, async (ctx) => {
        await ctx.answerCallbackQuery();

        const telegramUser = ctx.from;

        if (!telegramUser) {
            await ctx.reply(getMessages().common.readUserError);
            return;
        }

        const timezone = ctx.match[1] ?? "";
        const language = await userService.getUserLanguage(telegramUser.id);
        const messages = getMessages(language);

        if (!isSupportedTimezone(timezone)) {
            await ctx.reply(messages.common.unexpectedError);
            return;
        }

        await userService.setUserTimezone(telegramUser.id, timezone);

        await ctx.reply(messages.timezone.updated(timezone), {
            reply_markup: createSettingsOptionsKeyboard(language),
        });
    });

    bot.callbackQuery(
      [
        expenseScopeModeCallbacks.separate,
        expenseScopeModeCallbacks.personalOnly,
        expenseScopeModeCallbacks.familyOnly,
      ],
      async (ctx) => {
        await ctx.answerCallbackQuery();

        const telegramUser = ctx.from;

        if (!telegramUser) {
          await ctx.reply(getMessages().common.readUserError);
          return;
        }

        const mode = getExpenseScopeModeFromCallback(ctx.callbackQuery.data);
        const language = await userService.getUserLanguage(telegramUser.id);
        const messages = getMessages(language);

        if (!mode) {
          await ctx.reply(messages.common.unexpectedError);
          return;
        }

        await userService.setExpenseScopeMode(telegramUser.id, mode);

        await ctx.reply(messages.expenseScopeMode.updated, {
          reply_markup: createMainMenuKeyboard(language, mode),
        });
      }
    );

    bot.hears(getMainMenuButtonTexts("help"), async (ctx) => {
    const telegramUser = ctx.from;

    if (!telegramUser) {
        await ctx.reply(getMessages().common.readUserError);
        return;
    }

    const language = await userService.getUserLanguage(telegramUser.id);
    const currency = await userService.getUserCurrency(telegramUser.id);
    const messages = getMessages(language);

    const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);

    await ctx.reply(messages.help.text(currency), {
        reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
    });
    });
}
