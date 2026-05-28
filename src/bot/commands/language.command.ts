import { Bot } from "grammy";
import { UserService } from "../../application/services/user.service";
import { BotContext } from "../context";
import { getMessages } from "../i18n/translations";
import {
  createLanguageKeyboard,
  getLanguageFromCallback,
  languageCallbacks,
} from "../keyboards/language.keyboard";
import { getMainMenuButtonTexts } from "../keyboards/main-menu.keyboard";
import { createExpenseScopeModeKeyboard } from "../keyboards/expense-scope-mode.keyboard";

export async function askForLanguage(ctx: BotContext): Promise<void> {
  await ctx.reply(getMessages().start.chooseLanguage, {
    reply_markup: createLanguageKeyboard(),
  });
}

export function registerLanguageCommand(
  bot: Bot<BotContext>,
  userService: UserService
): void {
  bot.command("language", async (ctx) => {
    await askForLanguage(ctx);
  });

  bot.hears(getMainMenuButtonTexts("language"), async (ctx) => {
    await askForLanguage(ctx);
  });

  bot.callbackQuery(
    [languageCallbacks.ar, languageCallbacks.ru, languageCallbacks.en],
    async (ctx) => {
      await ctx.answerCallbackQuery();

      const language = getLanguageFromCallback(ctx.callbackQuery.data);

      if (!language) {
        await ctx.reply(getMessages().language.unsupported);
        return;
      }

      await userService.setUserLanguage(ctx.from.id, language);

      const messages = getMessages(language);

      await ctx.reply(messages.language.selected);
      await ctx.reply(messages.expenseScopeMode.question, {
        reply_markup: createExpenseScopeModeKeyboard(language),
      });
    }
  );
}
