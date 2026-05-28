import { Bot } from "grammy";
import { UserService } from "../../application/services/user.service";
import { config } from "../../config/env";
import { BotContext } from "../context";
import { getMessages } from "../i18n/translations";
import { createMainMenuKeyboard } from "../keyboards/main-menu.keyboard";

export function registerHelpCommand(
  bot: Bot<BotContext>,
  userService: UserService
): void {
  bot.command("help", async (ctx) => {
    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply(getMessages().common.readUserError);
      return;
    }

    const language = await userService.getUserLanguage(telegramUser.id);
    const currency = await userService.getUserCurrency(telegramUser.id);
    const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);
    const messages = getMessages(language);

    await ctx.reply(messages.help.text(currency), {
      reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
    });
  });
}
