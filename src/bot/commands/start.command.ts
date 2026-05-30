import { Bot } from "grammy";
import { UserService } from "../../application/services/user.service";
import { createMainMenuKeyboard } from "../keyboards/main-menu.keyboard";
import { BotContext } from "../context";
import { createLanguageKeyboard } from "../keyboards/language.keyboard";
import { createExpenseScopeModeKeyboard } from "../keyboards/expense-scope-mode.keyboard";
import { getMessages } from "../i18n/translations";
import { startFlow } from "../session/flow-session";

type RegisterTelegramUserData = {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
};

export function registerStartCommand(
  bot: Bot<BotContext>,
  userService: UserService
): void {
  bot.command("start", async (ctx) => {
    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply(getMessages().common.readUserError);
      return;
    }

    const userData: RegisterTelegramUserData = {
      telegramId: telegramUser.id,
      firstName: telegramUser.first_name,
    };

    if (telegramUser.username) {
      userData.username = telegramUser.username;
    }

    if (telegramUser.last_name) {
      userData.lastName = telegramUser.last_name;
    }

    const user = await userService.registerTelegramUser(userData);

    if (!user.language) {
      const flowId = startFlow(ctx, "onboarding_language");
      console.log("Onboarding flow started:", flowId, telegramUser.id);
      await ctx.reply(getMessages().start.chooseLanguage, {
        reply_markup: createLanguageKeyboard(flowId),
      });
      return;
    }

    const messages = getMessages(user.language);

    if (!user.expenseScopeMode) {
      const flowId = startFlow(ctx, "onboarding_expense_scope");
      console.log("Onboarding flow started:", flowId, telegramUser.id);
      await ctx.reply(messages.expenseScopeMode.question, {
        reply_markup: createExpenseScopeModeKeyboard(user.language, flowId),
      });
      return;
    }

    const expenseScopeMode = user.expenseScopeMode ?? "separate";

    await ctx.reply(messages.start.welcome, {
      reply_markup: createMainMenuKeyboard(user.language, expenseScopeMode),
    });
  });
}
