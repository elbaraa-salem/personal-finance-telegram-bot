import { Bot, Context } from "grammy";
import {
  StandardReportPeriod,
  ReportService,
} from "../../application/services/report.service";
import { formatReport } from "../formatters/report.formatter";
import { BotContext } from "../context";
import { UserService } from "../../application/services/user.service";
import { getMessages } from "../i18n/translations";
import { createReportExcelKeyboard } from "../keyboards/report-excel.keyboard";

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

export function registerReportCommand(
  bot: Bot<BotContext>,
  reportService: ReportService,
  userService: UserService
): void {
  bot.command("report", async (ctx) => {
    await replyWithReport(ctx, reportService, userService, "all");
  });

  bot.command("report_day", async (ctx) => {
    await replyWithReport(ctx, reportService, userService, "day");
  });

  bot.command("report_week", async (ctx) => {
    await replyWithReport(ctx, reportService, userService, "week");
  });

  bot.command("report_month", async (ctx) => {
    await replyWithReport(ctx, reportService, userService, "month");
  });

  bot.command("report_year", async (ctx) => {
    await replyWithReport(ctx, reportService, userService, "year");
  });
}
