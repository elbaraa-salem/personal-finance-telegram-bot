import { Bot } from "grammy";
import { UserService } from "../../application/services/user.service";
import { BotContext } from "../context";
import { getMessages } from "../i18n/translations";
import {
  createLanguageKeyboard,
  getLanguageFromCallback,
} from "../keyboards/language.keyboard";
import {
  createMainMenuKeyboard,
  getMainMenuButtonTexts,
} from "../keyboards/main-menu.keyboard";
import { createExpenseScopeModeKeyboard } from "../keyboards/expense-scope-mode.keyboard";
import {
  answerStaleCallback,
  clearActiveFlow,
  isActiveFlowOfType,
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
      const activeFlow = ctx.session.activeFlow;

      console.log("Language callback:", language, flowId, activeFlow);

      if (!isActiveFlowOfType(ctx, ["language_settings", "onboarding_language"], flowId)) {
        await answerStaleCallback(ctx, currentMessages.common.outdatedButton);
        return;
      }

      await ctx.answerCallbackQuery();

      await userService.setUserLanguage(ctx.from.id, language);

      const messages = getMessages(language);
      const isOnboarding = activeFlow?.type === "onboarding_language";
      console.log("Language selected from flow:", activeFlow?.type, language);

      await ctx.reply(messages.language.selected);

      if (!isOnboarding) {
        const expenseScopeMode = await userService.getExpenseScopeMode(ctx.from.id);
        clearActiveFlow(ctx);
        await ctx.reply(messages.language.ready, {
          reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
        });
        return;
      }

      const expenseFlowId = startFlow(ctx, "onboarding_expense_scope");

      await ctx.reply(messages.expenseScopeMode.question, {
        reply_markup: createExpenseScopeModeKeyboard(language, expenseFlowId),
      });
    }
  );

  bot.callbackQuery(/^lang:(ar|ru|en)$/, async (ctx) => {
    const language = getLanguageFromCallback(ctx.callbackQuery.data);
    const messages = getMessages(language ?? "en");

    await answerStaleCallback(ctx, messages.common.outdatedButton);
  });
}
