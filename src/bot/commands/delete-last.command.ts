import { Bot } from "grammy";
import { TransactionService } from "../../application/services/transaction.service";
import { UserService } from "../../application/services/user.service";
import { ReceiptImportRepository } from "../../infrastructure/repositories/receipt-import.repository";
import { BotContext } from "../context";
import { defaultLanguage, SupportedLanguage } from "../i18n/language";
import { getMessages } from "../i18n/translations";
import { formatDeletedTransaction } from "../formatters/transaction.formatter";
import { getMainMenuButtonTexts } from "../keyboards/main-menu.keyboard";
import {
  createDeleteConfirmationKeyboard,
  deleteConfirmationCallbacks,
} from "../keyboards/delete-confirmation.keyboard";

async function getLanguageForContext(
  ctx: BotContext,
  userService: UserService
): Promise<SupportedLanguage> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    return defaultLanguage;
  }

  return userService.getUserLanguage(telegramUser.id);
}

async function askDeleteConfirmation(
  ctx: BotContext,
  userService: UserService,
  transactionService: TransactionService,
  receiptImportRepository: ReceiptImportRepository
): Promise<void> {
  const telegramUser = ctx.from;
  const language = await getLanguageForContext(ctx, userService);
  const messages = getMessages(language);

  if (!telegramUser) {
    await ctx.reply(messages.delete.readUserError);
    return;
  }

  try {
    const latestTransaction = await transactionService.getLatestTransaction(telegramUser.id);
    const receiptImport = await receiptImportRepository.findByCreatedTransactionId(
      latestTransaction.userId,
      latestTransaction._id
    );

    if (receiptImport) {
      const transactionIds = receiptImport.createdTransactionIds.map((transactionId) =>
        transactionId.toString()
      );

      ctx.session.pendingDelete = {
        kind: "receipt_import",
        receiptImportId: receiptImport._id.toString(),
        transactionIds,
      };

      await ctx.reply(messages.delete.deleteReceiptConfirm(transactionIds.length), {
        reply_markup: createDeleteConfirmationKeyboard(language),
      });
      return;
    }

    ctx.session.pendingDelete = {
      kind: "single_transaction",
      transactionId: latestTransaction._id.toString(),
    };

    await ctx.reply(messages.delete.confirmation, {
      reply_markup: createDeleteConfirmationKeyboard(language),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : messages.common.unexpectedError;

    await ctx.reply(`❌ ${message}`);
  }
}

export function registerDeleteLastCommand(
  bot: Bot<BotContext>,
  transactionService: TransactionService,
  userService: UserService,
  receiptImportRepository: ReceiptImportRepository
): void {
  bot.command("delete_last", async (ctx) => {
    await askDeleteConfirmation(ctx, userService, transactionService, receiptImportRepository);
  });

  bot.hears(getMainMenuButtonTexts("deleteLast"), async (ctx) => {
    await askDeleteConfirmation(ctx, userService, transactionService, receiptImportRepository);
  });

  bot.callbackQuery(
    deleteConfirmationCallbacks.cancelDeleteLast,
    async (ctx) => {
      await ctx.answerCallbackQuery();

      const language = await getLanguageForContext(ctx, userService);
      const messages = getMessages(language);

      ctx.session.pendingDelete = null;
      await ctx.editMessageText(messages.delete.cancelled);
    }
  );

  bot.callbackQuery(
    deleteConfirmationCallbacks.confirmDeleteLast,
    async (ctx) => {
      await ctx.answerCallbackQuery();

      const telegramUser = ctx.from;
      const language = await getLanguageForContext(ctx, userService);
      const messages = getMessages(language);

      if (!telegramUser) {
        await ctx.editMessageText(messages.delete.readUserError);
        return;
      }

      try {
        const pendingDelete = ctx.session.pendingDelete;

        if (!pendingDelete) {
          await ctx.editMessageText(messages.delete.deleteReceiptAlreadyDeleted);
          return;
        }

        ctx.session.pendingDelete = null;

        if (pendingDelete.kind === "receipt_import") {
          const deletedCount = await transactionService.deleteTransactionsByIds(
            telegramUser.id,
            pendingDelete.transactionIds
          );

          await receiptImportRepository.markDeleted(pendingDelete.receiptImportId);

          await ctx.editMessageText(
            deletedCount > 0
              ? messages.delete.deleteReceiptSuccess(deletedCount)
              : messages.delete.deleteReceiptAlreadyDeleted
          );
          return;
        }

        const currency = await userService.getUserCurrency(telegramUser.id);
        const deletedTransaction = await transactionService.deleteTransactionById(
          telegramUser.id,
          pendingDelete.transactionId
        );

        await ctx.editMessageText(
          formatDeletedTransaction(deletedTransaction, language, currency)
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : messages.common.unexpectedError;

        await ctx.editMessageText(`❌ ${message}`);
      }
    }
  );
}
