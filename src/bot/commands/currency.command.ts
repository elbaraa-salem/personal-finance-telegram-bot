import { Bot } from "grammy";
import { UserService } from "../../application/services/user.service";
import { BotContext } from "../context";
import { getMessages } from "../i18n/translations";
import { createMainMenuKeyboard, getMainMenuButtonTexts } from "../keyboards/main-menu.keyboard";
import {
  createCurrencyKeyboard,
  currencyCallbacks,
  getCurrencyFromCallback,
} from "../keyboards/currency.keyboard";

function normalizeCustomCurrency(text: string): string | null {
  const currency = text.trim();

  if (!currency || currency.length > 10 || currency.includes("\n")) {
    return null;
  }

  if (currency.startsWith("/")) {
    return null;
  }

  return currency;
}

export async function askForCurrency(
  ctx: BotContext,
  userService: UserService
): Promise<void> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    await ctx.reply(getMessages().common.readUserError);
    return;
  }

  const language = await userService.getUserLanguage(telegramUser.id);
  const messages = getMessages(language);

  await ctx.reply(messages.currency.choose, {
    reply_markup: createCurrencyKeyboard(language),
  });
}

export function registerCurrencyCommand(
  bot: Bot<BotContext>,
  userService: UserService
): void {
  bot.command("currency", async (ctx) => {
    await askForCurrency(ctx, userService);
  });

  bot.hears(getMainMenuButtonTexts("currency"), async (ctx) => {
    await askForCurrency(ctx, userService);
  });

  bot.callbackQuery(
    [
      currencyCallbacks.rub,
      currencyCallbacks.usd,
      currencyCallbacks.eur,
      currencyCallbacks.egp,
      currencyCallbacks.sar,
      currencyCallbacks.custom,
    ],
    async (ctx) => {
      await ctx.answerCallbackQuery();

      const telegramUser = ctx.from;

      if (!telegramUser) {
        await ctx.reply(getMessages().common.readUserError);
        return;
      }

      const language = await userService.getUserLanguage(telegramUser.id);
      const messages = getMessages(language);

      if (ctx.callbackQuery.data === currencyCallbacks.custom) {
        ctx.session.pendingCurrencyInput = true;

        await ctx.reply(messages.currency.customPrompt);
        return;
      }

      const currency = getCurrencyFromCallback(ctx.callbackQuery.data);

      if (!currency) {
        await ctx.reply(messages.currency.invalidCustom);
        return;
      }

      await userService.setUserCurrency(telegramUser.id, currency);
      const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);

      await ctx.reply(messages.currency.selected(currency), {
        reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
      });
    }
  );

  bot.on("message:text", async (ctx, next) => {
    if (!ctx.session.pendingCurrencyInput) {
      await next();
      return;
    }

    const telegramUser = ctx.from;

    if (!telegramUser) {
      ctx.session.pendingCurrencyInput = false;
      await ctx.reply(getMessages().common.readUserError);
      return;
    }

    const language = await userService.getUserLanguage(telegramUser.id);
    const messages = getMessages(language);

    const currency = normalizeCustomCurrency(ctx.message.text);

    if (!currency) {
      await ctx.reply(messages.currency.invalidCustom);
      return;
    }

    await userService.setUserCurrency(telegramUser.id, currency);
    const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);

    ctx.session.pendingCurrencyInput = false;

    await ctx.reply(messages.currency.selected(currency), {
      reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
    });
  });
}
