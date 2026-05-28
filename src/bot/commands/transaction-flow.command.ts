import { Bot, GrammyError } from "grammy";
import { AiTransactionParserService } from "../../application/services/ai-transaction-parser.service";
import { ReceiptImportService } from "../../application/services/receipt-import.service";
import { TransactionService } from "../../application/services/transaction.service";
import { config } from "../../config/env";
import { TransactionScope, TransactionType } from "../../infrastructure/database/models/transaction.model";
import { ExpenseScopeMode } from "../../infrastructure/database/models/user.model";
import { BotContext } from "../context";
import { UserService } from "../../application/services/user.service";
import {
  createMainMenuKeyboard,
  createManualEntryKeyboard,
  getMainMenuButtonTexts,
  isMainMenuButtonText,
} from "../keyboards/main-menu.keyboard";
import { formatCreatedTransaction } from "../formatters/transaction.formatter";
import {
  createCancelFlowKeyboard,
  getCancelFlowButtonTexts,
  isCancelFlowButtonText,
} from "../keyboards/cancel-flow.keyboard";
import { getMessages } from "../i18n/translations";
import { defaultLanguage, SupportedLanguage } from "../i18n/language";
import {
  createScopeConfirmationKeyboard,
  scopeConfirmationCallbacks,
} from "../keyboards/scope-confirmation.keyboard";
import { createReceiptQrConfirmationKeyboard } from "../keyboards/receipt-import.keyboard";
import { formatReceiptImportPreview } from "../formatters/receipt-import.formatter";
import { decodeReceiptQrFromImageBuffer } from "../../infrastructure/receipt/receipt-qr-image-decoder";
import { downloadTelegramFileAsBuffer } from "../utils/download-telegram-file";

type EditMessageTextOptions = Parameters<BotContext["editMessageText"]>[1];

function parseDate(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (!match) {
    return null;
  }

  const yearText = match[1];
  const monthText = match[2];
  const dayText = match[3];

  if (!yearText || !monthText || !dayText) {
    return null;
  }

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const date = new Date(Date.UTC(year, month - 1, day));

  const isValidDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return isValidDate ? date : null;
}

function getTransactionLabel(
  type: TransactionType,
  language: SupportedLanguage
): string {
  const messages = getMessages(language);

  return type === "income"
    ? messages.transaction.income
    : messages.transaction.expense;
}

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

async function startTransactionFlow(
  ctx: BotContext,
  type: TransactionType,
  userService: UserService,
  scope?: TransactionScope
): Promise<void> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    await ctx.reply(getMessages().common.readUserError);
    return;
  }

  const language = await userService.getUserLanguage(telegramUser.id);
  const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);
  const messages = getMessages(language);
  const label = getTransactionLabel(type, language);
  const modeScope = getForcedScopeFromUserMode(expenseScopeMode);
  const effectiveScope = type === "expense" ? modeScope ?? scope : undefined;

  ctx.session.pendingTransaction = {
    type,
    ...(effectiveScope ? { scope: effectiveScope } : {}),
  };

  await ctx.reply(messages.transactionFlow.start(label), {
    reply_markup: createCancelFlowKeyboard(language),
  });
}

async function cancelTransactionFlow(
  ctx: BotContext,
  userService: UserService
): Promise<void> {
  const language = await getLanguageForContext(ctx, userService);
  const messages = getMessages(language);

  if (!ctx.session.pendingTransaction) {
    const expenseScopeMode = ctx.from
      ? await userService.getExpenseScopeMode(ctx.from.id)
      : "separate";

    await ctx.reply(messages.transactionFlow.noActiveFlow, {
      reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
    });
    return;
  }

  ctx.session.pendingTransaction = null;

  const expenseScopeMode = ctx.from
    ? await userService.getExpenseScopeMode(ctx.from.id)
    : "separate";

  await ctx.reply(messages.transactionFlow.cancelled, {
    reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
  });
}

function isCommandText(text: string): boolean {
  return text.startsWith("/");
}

function shouldBlockDuringTransactionFlow(text: string): boolean {
  if (isCancelFlowButtonText(text)) {
    return false;
  }

  return isCommandText(text) || isMainMenuButtonText(text);
}

function isShortcutTransactionText(text: string): boolean {
  const trimmedText = text.trim();

  return trimmedText.startsWith("+") || trimmedText.startsWith("-");
}

function looksLikeReceiptQrRaw(text: string): boolean {
  return ["fn=", "fp=", "i=", "t=", "s=", "n="].every((field) => text.includes(field));
}

function getForcedScopeFromUserMode(mode: ExpenseScopeMode): TransactionScope | undefined {
  if (mode === "personal_only") {
    return "personal";
  }

  if (mode === "family_only") {
    return "family";
  }

  return undefined;
}

function getCurrentDateInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function getReceiptImportErrorMessage(error: unknown, language: SupportedLanguage): string {
  const messages = getMessages(language);
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes("AI receipt parsing is not configured")) {
    return messages.receipt.receiptAiNotConfigured;
  }

  if (errorMessage.includes("no items") || errorMessage.includes("No receipt items")) {
    return messages.receipt.receiptNoItems;
  }

  return messages.receipt.receiptCouldNotImport;
}

async function handleReceiptQrRawText(
  ctx: BotContext,
  text: string,
  receiptImportService: ReceiptImportService,
  userService: UserService,
  options: {
    forcedScope?: TransactionScope;
    clearPendingTransactionOnSuccess?: boolean;
    allowScopeSelection?: boolean;
  } = {}
): Promise<void> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    await ctx.reply(getMessages().common.readUserError);
    return;
  }

  const language = await userService.getUserLanguage(telegramUser.id);
  const currency = await userService.getUserCurrency(telegramUser.id);
  const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);

  try {
    const preview = await receiptImportService.importReceiptByQrRaw(
      telegramUser.id,
      text,
      language,
      currency,
      options.forcedScope ? { forcedScope: options.forcedScope } : {}
    );

    await ctx.reply(formatReceiptImportPreview(preview, language, currency), {
      reply_markup: createReceiptQrConfirmationKeyboard(
        preview.receiptImport._id.toString(),
        language,
        preview.selectedScope,
        options.allowScopeSelection ?? true
      ),
    });

  } catch (error) {
    console.error("❌ Receipt QR import error:", error);
    const errorMessage = getReceiptImportErrorMessage(error, language);

    if (ctx.session.pendingTransaction) {
      await ctx.reply(errorMessage);
    } else {
      await ctx.reply(errorMessage, {
        reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
      });
    }
    return;
  }

  if (options.clearPendingTransactionOnSuccess) {
    ctx.session.pendingTransaction = null;
    ctx.session.awaitingScopeConfirmation = null;
  }
}

async function replyCallbackResultWithMainMenu(
  ctx: BotContext,
  text: string,
  language: SupportedLanguage,
  expenseScopeMode: ExpenseScopeMode
): Promise<void> {
  await ctx.editMessageReplyMarkup().catch(() => undefined);
  await ctx.reply(text, {
    reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
  });
}

function isMessageNotModifiedError(error: unknown): boolean {
  return (
    error instanceof GrammyError &&
    error.error_code === 400 &&
    error.description.includes("message is not modified")
  );
}

async function safeEditMessageText(
  ctx: BotContext,
  text: string,
  options?: EditMessageTextOptions
): Promise<boolean> {
  try {
    await ctx.editMessageText(text, options);
    return true;
  } catch (error) {
    if (isMessageNotModifiedError(error)) {
      return false;
    }

    throw error;
  }
}

async function handleReceiptQrImageFile(
  ctx: BotContext,
  fileId: string,
  receiptImportService: ReceiptImportService,
  userService: UserService,
  options: {
    forcedScope?: TransactionScope;
    clearPendingTransactionOnSuccess?: boolean;
    allowScopeSelection?: boolean;
  } = {}
): Promise<void> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    await ctx.reply(getMessages().common.readUserError);
    return;
  }

  const language = await userService.getUserLanguage(telegramUser.id);
  const messages = getMessages(language);
  const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);

  if (options.clearPendingTransactionOnSuccess) {
    await ctx.reply(messages.receipt.qrImageProcessing, {
      reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
    });
  } else {
    await ctx.reply(messages.receipt.qrImageProcessing);
  }

  let qrRaw: string;

  try {
    const imageBuffer = await downloadTelegramFileAsBuffer(ctx, fileId);
    qrRaw = await decodeReceiptQrFromImageBuffer(imageBuffer);
  } catch (error) {
    console.error("❌ Receipt QR image decode error:", error);
    if (ctx.session.pendingTransaction) {
      await ctx.reply(messages.receipt.qrImageDecodeFailed);
    } else {
      await ctx.reply(messages.receipt.qrImageDecodeFailed, {
        reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
      });
    }
    return;
  }

  await handleReceiptQrRawText(ctx, qrRaw, receiptImportService, userService, options);
}

function parseIsoDateToUtcDate(text: string): Date | null {
  const date = parseDate(text);

  return date;
}

async function saveParsedTransaction(
  ctx: BotContext,
  transactionService: TransactionService,
  userService: UserService,
  data: {
    type: TransactionType;
    scope?: TransactionScope;
    amount: number;
    category: string;
    note?: string;
    transactionDate: string;
  }
): Promise<void> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    await ctx.reply(getMessages().common.readUserError);
    return;
  }

  const language = await userService.getUserLanguage(telegramUser.id);
  const currency = await userService.getUserCurrency(telegramUser.id);
  const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);
  const messages = getMessages(language);
  const transactionDate = parseIsoDateToUtcDate(data.transactionDate);

  if (!transactionDate) {
    await ctx.reply(messages.transactionFlow.invalidDate);
    return;
  }

  const transaction = await transactionService.addTransaction({
    telegramId: telegramUser.id,
    type: data.type,
    ...(data.scope ? { scope: data.scope } : {}),
    amount: data.amount,
    category: data.category,
    ...(data.note ? { note: data.note } : {}),
    transactionDate,
  });

  await ctx.reply(formatCreatedTransaction(transaction, language, currency), {
    reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
  });
}

async function parseAndHandleNaturalTransaction(
  ctx: BotContext,
  text: string,
  aiTransactionParser: AiTransactionParserService,
  transactionService: TransactionService,
  userService: UserService,
  forcedType?: TransactionType,
  forcedScope?: TransactionScope
): Promise<void> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    ctx.session.pendingTransaction = null;
    await ctx.reply(getMessages().common.readUserError);
    return;
  }

  const language = await userService.getUserLanguage(telegramUser.id);
  const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);
  const modeForcedScope = getForcedScopeFromUserMode(expenseScopeMode);
  const effectiveForcedScope = modeForcedScope ?? forcedScope;
  const messages = getMessages(language);
  const replyWithFlowMarkup = async (message: string): Promise<void> => {
    if (forcedType) {
      await ctx.reply(message, {
        reply_markup: createCancelFlowKeyboard(language),
      });
      return;
    }

    await ctx.reply(message);
  };

  if (!aiTransactionParser.isConfigured()) {
    await replyWithFlowMarkup(messages.naturalTransaction.aiNotConfigured);
    return;
  }

  try {
    const timezone = config.defaultTimezone;
    const result = await aiTransactionParser.parse(text, {
      language,
      timezone,
      currentDate: getCurrentDateInTimezone(timezone),
      ...(forcedType ? { forcedType } : {}),
      ...(effectiveForcedScope ? { forcedScope: effectiveForcedScope } : {}),
    });

    if (result.status === "not_transaction") {
      await replyWithFlowMarkup(messages.naturalTransaction.notDetected);
      return;
    }

    if (result.status === "missing_details") {
      await replyWithFlowMarkup(result.question);
      return;
    }

    const scope = result.type === "expense" ? effectiveForcedScope ?? result.scope ?? null : null;

    if (result.type === "expense" && !scope) {
      ctx.session.awaitingScopeConfirmation = {
        type: "expense",
        amount: result.amount,
        category: result.category,
        ...(result.note ? { note: result.note } : {}),
        transactionDate: result.transactionDate,
      };
      ctx.session.pendingTransaction = null;

      await ctx.reply(messages.naturalTransaction.askScope, {
        reply_markup: createScopeConfirmationKeyboard(language),
      });
      return;
    }

    await saveParsedTransaction(ctx, transactionService, userService, {
      type: result.type,
      ...(scope ? { scope } : {}),
      amount: result.amount,
      category: result.category,
      note: result.note,
      transactionDate: result.transactionDate,
    });

    ctx.session.pendingTransaction = null;
  } catch (error) {
    console.error("❌ AI transaction parsing error:", error);
    await replyWithFlowMarkup(messages.naturalTransaction.parseFailed);
  }
}

async function replyWithActiveFlowWarning(
  ctx: BotContext,
  language: SupportedLanguage
): Promise<void> {
  const messages = getMessages(language);

  await ctx.reply(messages.transactionFlow.activeFlowWarning, {
    reply_markup: createCancelFlowKeyboard(language),
  });
}

export function registerTransactionFlowCommand(
  bot: Bot<BotContext>,
  transactionService: TransactionService,
  userService: UserService,
  aiTransactionParser: AiTransactionParserService,
  receiptImportService: ReceiptImportService
): void {
  bot.hears(getMainMenuButtonTexts("addIncome"), async (ctx) => {
    await startTransactionFlow(ctx, "income", userService);
  });

  bot.hears(getMainMenuButtonTexts("addExpense"), async (ctx) => {
    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply(getMessages().common.readUserError);
      return;
    }

    const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);
    const scope = getForcedScopeFromUserMode(expenseScopeMode);

    if (!scope) {
      const language = await userService.getUserLanguage(telegramUser.id);
      await ctx.reply(getMessages(language).menu.chooseOperationType, {
        reply_markup: createManualEntryKeyboard(language, expenseScopeMode),
      });
      return;
    }

    await startTransactionFlow(ctx, "expense", userService, scope);
  });

  bot.hears(getMainMenuButtonTexts("addFamilyExpense"), async (ctx) => {
    await startTransactionFlow(ctx, "expense", userService, "family");
  });

  bot.hears(getMainMenuButtonTexts("addPersonalExpense"), async (ctx) => {
    await startTransactionFlow(ctx, "expense", userService, "personal");
  });

  bot.command("cancel", async (ctx) => {
    await cancelTransactionFlow(ctx, userService);
  });

  bot.hears(getCancelFlowButtonTexts(), async (ctx) => {
    await cancelTransactionFlow(ctx, userService);
  });

  bot.callbackQuery(
    [scopeConfirmationCallbacks.personal, scopeConfirmationCallbacks.family],
    async (ctx) => {
      await ctx.answerCallbackQuery();

      const telegramUser = ctx.from;

      if (!telegramUser) {
        await ctx.reply(getMessages().common.readUserError);
        return;
      }

      const language = await userService.getUserLanguage(telegramUser.id);
      const messages = getMessages(language);
      const awaitingScopeConfirmation = ctx.session.awaitingScopeConfirmation;

      if (!awaitingScopeConfirmation) {
        await ctx.reply(messages.naturalTransaction.noScopeSession);
        return;
      }

      const scope: TransactionScope =
        ctx.callbackQuery.data === scopeConfirmationCallbacks.personal
          ? "personal"
          : "family";

      try {
        await saveParsedTransaction(ctx, transactionService, userService, {
          ...awaitingScopeConfirmation,
          scope,
        });
        ctx.session.awaitingScopeConfirmation = null;
      } catch (error) {
        console.error("❌ Scope confirmation save error:", error);
        const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);
        await ctx.reply(messages.common.unexpectedError, {
          reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
        });
      }
    }
  );

  bot.callbackQuery(/^receipt_scope:([a-f\d]{24}):(personal|family)$/i, async (ctx) => {
    await ctx.answerCallbackQuery();

    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply(getMessages().common.readUserError);
      return;
    }

    const language = await userService.getUserLanguage(telegramUser.id);
    const currency = await userService.getUserCurrency(telegramUser.id);
    const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);
    const messages = getMessages(language);
    const [, receiptImportId, scope] = ctx.callbackQuery.data.split(":");

    if (!receiptImportId || (scope !== "personal" && scope !== "family")) {
      await ctx.reply(messages.receipt.receiptCouldNotImport);
      return;
    }

    if (expenseScopeMode !== "separate") {
      await ctx.answerCallbackQuery({
        text: messages.expenseScopeMode.fixedBySettings,
      });
      return;
    }

    try {
      const preview = await receiptImportService.updateReceiptImportScope(
        telegramUser.id,
        receiptImportId,
        scope
      );

      await safeEditMessageText(ctx, formatReceiptImportPreview(preview, language, currency), {
        reply_markup: createReceiptQrConfirmationKeyboard(
          preview.receiptImport._id.toString(),
          language,
          preview.selectedScope,
          true
        ),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already confirmed")) {
        await ctx.reply(messages.receipt.receiptAlreadySaved, {
          reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
        });
        return;
      }

      if (error instanceof Error && error.message.includes("already cancelled")) {
        await ctx.reply(messages.receipt.receiptCancelled, {
          reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
        });
        return;
      }

      console.error("❌ Receipt scope update error:", error);
      await ctx.reply(messages.common.unexpectedError, {
        reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
      });
    }
  });

  bot.callbackQuery(/^receipt_confirm:([a-f\d]{24})$/i, async (ctx) => {
    await ctx.answerCallbackQuery();

    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply(getMessages().common.readUserError);
      return;
    }

    const language = await userService.getUserLanguage(telegramUser.id);
    const messages = getMessages(language);
    const receiptImportId = ctx.callbackQuery.data.split(":")[1];
    const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);

    if (!receiptImportId) {
      await ctx.reply(messages.receipt.receiptCouldNotImport);
      return;
    }

    try {
      const modeScope = getForcedScopeFromUserMode(expenseScopeMode);
      const result = await receiptImportService.confirmReceiptImport(
        telegramUser.id,
        receiptImportId,
        modeScope ? { forcedScope: modeScope } : {}
      );
      const text =
        result.status === "already_confirmed"
          ? messages.receipt.receiptAlreadySaved
          : result.status === "cancelled"
            ? messages.receipt.receiptCancelled
          : `${messages.receipt.receiptSaved}\n${result.transactions.length}`;

      ctx.session.pendingTransaction = null;
      ctx.session.pendingReceiptImport = null;
      ctx.session.awaitingScopeConfirmation = null;

      await replyCallbackResultWithMainMenu(ctx, text, language, expenseScopeMode);
    } catch (error) {
      console.error("❌ Receipt confirmation error:", error);
      ctx.session.pendingTransaction = null;
      ctx.session.pendingReceiptImport = null;
      ctx.session.awaitingScopeConfirmation = null;
      await ctx.reply(messages.common.unexpectedError, {
        reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
      });
    }
  });

  bot.callbackQuery(/^receipt_cancel:([a-f\d]{24})$/i, async (ctx) => {
    await ctx.answerCallbackQuery();

    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply(getMessages().common.readUserError);
      return;
    }

    const language = await userService.getUserLanguage(telegramUser.id);
    const messages = getMessages(language);
    const receiptImportId = ctx.callbackQuery.data.split(":")[1];
    const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);

    if (!receiptImportId) {
      await ctx.reply(messages.receipt.receiptCouldNotImport);
      return;
    }

    try {
      const receiptImport = await receiptImportService.cancelReceiptImport(telegramUser.id, receiptImportId);
      const text =
        receiptImport.status === "confirmed"
          ? messages.receipt.receiptAlreadySaved
          : messages.receipt.receiptCancelled;

      ctx.session.pendingTransaction = null;
      ctx.session.pendingReceiptImport = null;
      ctx.session.awaitingScopeConfirmation = null;
      await replyCallbackResultWithMainMenu(
        ctx,
        text,
        language,
        expenseScopeMode
      );
    } catch (error) {
      console.error("❌ Receipt cancellation error:", error);
      ctx.session.pendingTransaction = null;
      ctx.session.pendingReceiptImport = null;
      ctx.session.awaitingScopeConfirmation = null;
      await ctx.reply(messages.common.unexpectedError, {
        reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
      });
    }
  });

  bot.on("message:photo", async (ctx) => {
    const pendingTransaction = ctx.session.pendingTransaction;
    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply(getMessages().common.readUserError);
      return;
    }

    const language = await userService.getUserLanguage(telegramUser.id);
    const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);
    const modeScope = getForcedScopeFromUserMode(expenseScopeMode);

    if (pendingTransaction?.type === "income") {
      await ctx.reply(getMessages(language).receipt.receiptExpenseOnly, {
        reply_markup: createCancelFlowKeyboard(language),
      });
      return;
    }

    const photo = ctx.message.photo.at(-1);

    if (!photo) {
      await ctx.reply(getMessages(language).receipt.qrImageDecodeFailed);
      return;
    }

    const forcedReceiptScope = modeScope ?? pendingTransaction?.scope;

    await handleReceiptQrImageFile(
      ctx,
      photo.file_id,
      receiptImportService,
      userService,
      {
        ...(forcedReceiptScope ? { forcedScope: forcedReceiptScope } : {}),
        clearPendingTransactionOnSuccess: pendingTransaction?.type === "expense",
        allowScopeSelection: expenseScopeMode === "separate",
      }
    );
  });

  bot.on("message:document", async (ctx, next) => {
    const document = ctx.message.document;
    const mimeType = document.mime_type ?? "";

    if (!mimeType.startsWith("image/")) {
      await next();
      return;
    }

    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply(getMessages().common.readUserError);
      return;
    }

    const language = await userService.getUserLanguage(telegramUser.id);
    const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);
    const modeScope = getForcedScopeFromUserMode(expenseScopeMode);

    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      await ctx.reply(getMessages(language).receipt.qrImageUnsupportedFile);
      return;
    }

    const pendingTransaction = ctx.session.pendingTransaction;

    if (pendingTransaction?.type === "income") {
      await ctx.reply(getMessages(language).receipt.receiptExpenseOnly, {
        reply_markup: createCancelFlowKeyboard(language),
      });
      return;
    }

    const forcedReceiptScope = modeScope ?? pendingTransaction?.scope;

    await handleReceiptQrImageFile(
      ctx,
      document.file_id,
      receiptImportService,
      userService,
      {
        ...(forcedReceiptScope ? { forcedScope: forcedReceiptScope } : {}),
        clearPendingTransactionOnSuccess: pendingTransaction?.type === "expense",
        allowScopeSelection: expenseScopeMode === "separate",
      }
    );
  });

  bot.on("message:text", async (ctx, next) => {
    const pendingTransaction = ctx.session.pendingTransaction;
    const text = ctx.message.text.trim();

    if (!pendingTransaction) {
      if (
        isCommandText(text) ||
        isMainMenuButtonText(text) ||
        isCancelFlowButtonText(text) ||
        isShortcutTransactionText(text)
      ) {
        await next();
        return;
      }

      if (looksLikeReceiptQrRaw(text)) {
        const telegramUser = ctx.from;

        if (!telegramUser) {
          await ctx.reply(getMessages().common.readUserError);
          return;
        }

        const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);
        const modeScope = getForcedScopeFromUserMode(expenseScopeMode);

        await handleReceiptQrRawText(ctx, text, receiptImportService, userService, {
          ...(modeScope ? { forcedScope: modeScope } : {}),
          allowScopeSelection: expenseScopeMode === "separate",
        });
        return;
      }

      await parseAndHandleNaturalTransaction(
        ctx,
        text,
        aiTransactionParser,
        transactionService,
        userService
      );
      return;
    }

    const telegramUser = ctx.from;

    if (!telegramUser) {
      ctx.session.pendingTransaction = null;
      await ctx.reply(getMessages().common.readUserError);
      return;
    }

    const language = await userService.getUserLanguage(telegramUser.id);
    const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);
    const modeScope = getForcedScopeFromUserMode(expenseScopeMode);

    if (looksLikeReceiptQrRaw(text)) {
      if (pendingTransaction.type === "income") {
        await ctx.reply(getMessages(language).receipt.receiptExpenseOnly, {
          reply_markup: createCancelFlowKeyboard(language),
        });
        return;
      }

      const forcedReceiptScope = modeScope ?? pendingTransaction.scope;

      await handleReceiptQrRawText(ctx, text, receiptImportService, userService, {
        ...(forcedReceiptScope ? { forcedScope: forcedReceiptScope } : {}),
        clearPendingTransactionOnSuccess: true,
        allowScopeSelection: expenseScopeMode === "separate",
      });
      return;
    }

    if (text === "/cancel" || isCancelFlowButtonText(text)) {
      await cancelTransactionFlow(ctx, userService);
      return;
    }

    if (shouldBlockDuringTransactionFlow(text)) {
      await replyWithActiveFlowWarning(ctx, language);
      return;
    }

    await parseAndHandleNaturalTransaction(
      ctx,
      text,
      aiTransactionParser,
      transactionService,
      userService,
      pendingTransaction.type,
      pendingTransaction.scope
    );
  });
}
