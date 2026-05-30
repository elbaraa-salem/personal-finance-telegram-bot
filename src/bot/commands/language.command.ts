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
import {
  answerStaleCallback,
  clearActiveFlow,
  isActiveFlow,
  startFlow,
} from "../session/flow-session";

export async function askForLanguage(ctx: BotContext, flowId?: string): Promise<void> {
  const effectiveFlowId = flowId ?? startFlow(ctx, "language_settings");

  await ctx.reply(getMessages().start.chooseLanguage, {
    reply_markup: createLanguageKeyboard(effectiveFlowId),
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
    /^lang:(ar|ru|en):(.+)$/,
    async (ctx) => {
      const language = getLanguageFromCallback(ctx.callbackQuery.data);
      const flowId = ctx.match[2];

      if (!language) {
        await ctx.answerCallbackQuery();
        await ctx.reply(getMessages().language.unsupported);
        return;
      }

      const currentMessages = getMessages(language);

      if (!isActiveFlow(ctx, "language_settings", flowId)) {
        await answerStaleCallback(ctx, currentMessages.common.outdatedButton);
        return;
      }

      await ctx.answerCallbackQuery();

      await userService.setUserLanguage(ctx.from.id, language);

      const messages = getMessages(language);
      const expenseFlowId = startFlow(ctx, "expense_scope_settings");

      await ctx.reply(messages.language.selected);
      await ctx.reply(messages.expenseScopeMode.question, {
        reply_markup: createExpenseScopeModeKeyboard(language, expenseFlowId),
      });
    }
  );
}
