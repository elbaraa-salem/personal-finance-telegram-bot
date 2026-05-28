import { Bot } from "grammy";
import { TransactionService } from "../../application/services/transaction.service";
import { UserService } from "../../application/services/user.service";
import { config } from "../../config/env";
import {
  ExtractedReceipt,
  ExtractedReceiptItem,
  ReceiptExtractor,
} from "../../infrastructure/ai/receipt-extractor";
import { TransactionScope } from "../../infrastructure/database/models/transaction.model";
import { ExpenseScopeMode } from "../../infrastructure/database/models/user.model";
import { BotContext } from "../context";
import { defaultLanguage, SupportedLanguage } from "../i18n/language";
import {
  createReceiptConfirmationKeyboard,
  createReceiptScopeKeyboard,
  receiptImportCallbacks,
} from "../keyboards/receipt-import.keyboard";
import { createMainMenuKeyboard } from "../keyboards/main-menu.keyboard";

function getMessage(language: SupportedLanguage, key: string): string {
  const messages: Record<SupportedLanguage, Record<string, string>> = {
    ar: {
      received: "📸 تم استلام صورة الشيك. جاري استخراج البيانات...",
      chooseScope: "هل هذه المشتريات شخصية أم أسرية؟",
      noApiKey: "ميزة قراءة الشيكات غير مفعلة. أضف GEMINI_API_KEY في ملف .env.",
      failed: "لم أستطع قراءة الشيك بدقة. أرسل صورة أوضح أو أدخل البيانات يدويًا.",
      cancelled: "تم إلغاء استيراد الشيك.",
      saved: "✅ تم حفظ مشتريات الشيك بنجاح.",
      noSession: "لا توجد عملية استيراد شيك نشطة.",
      editPrompt: "انسخ البيانات التالية وعدلها، ثم أرسلها مرة أخرى بنفس الشكل:",
      invalidEdit: "لم أستطع فهم البيانات المعدلة. استخدم الشكل: - اسم المنتج | السعر | التصنيف",
    },
    ru: {
      received: "📸 Фото чека получено. Извлекаю данные...",
      chooseScope: "Эти покупки личные или семейные?",
      noApiKey: "Импорт чеков не включён. Добавьте GEMINI_API_KEY в файл .env.",
      failed: "Не получилось точно прочитать чек. Отправьте более чёткое фото или введите данные вручную.",
      cancelled: "Импорт чека отменён.",
      saved: "✅ Покупки из чека успешно сохранены.",
      noSession: "Нет активного импорта чека.",
      editPrompt: "Скопируйте данные ниже, исправьте их и отправьте обратно в таком же формате:",
      invalidEdit: "Не получилось понять исправленные данные. Используйте формат: - название | цена | категория",
    },
    en: {
      received: "📸 Receipt photo received. Extracting data...",
      chooseScope: "Are these purchases personal or family expenses?",
      noApiKey: "Receipt import is not enabled. Add GEMINI_API_KEY to the .env file.",
      failed: "I could not read the receipt accurately. Send a clearer photo or enter the data manually.",
      cancelled: "Receipt import was cancelled.",
      saved: "✅ Receipt purchases were saved successfully.",
      noSession: "There is no active receipt import.",
      editPrompt: "Copy the data below, edit it, then send it back in the same format:",
      invalidEdit: "I could not understand the edited data. Use this format: - item name | amount | category",
    },
  };

  return messages[language][key] ?? messages.en[key] ?? key;
}

async function getLanguage(
  ctx: BotContext,
  userService: UserService
): Promise<SupportedLanguage> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    return defaultLanguage;
  }

  return userService.getUserLanguage(telegramUser.id);
}

async function getExpenseScopeMode(
  ctx: BotContext,
  userService: UserService
): Promise<ExpenseScopeMode> {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    return "separate";
  }

  return userService.getExpenseScopeMode(telegramUser.id);
}

function parseReceiptDate(dateText: string | undefined): Date | undefined {
  if (!dateText) {
    return undefined;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);

  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatReceiptPreview(
  receipt: ExtractedReceipt,
  scope: TransactionScope,
  currency: string,
  language: SupportedLanguage
): string {
  const scopeText =
    scope === "personal"
      ? language === "ru"
        ? "личное"
        : language === "en"
          ? "personal"
          : "شخصي"
      : language === "ru"
        ? "семейное"
        : language === "en"
          ? "family"
          : "أسري";
  const title = language === "ru" ? "🧾 Данные чека" : language === "en" ? "🧾 Receipt data" : "🧾 بيانات الشيك";
  const merchant = receipt.merchant ? `\n🏪 ${receipt.merchant}` : "";
  const date = receipt.date ? `\n📅 ${receipt.date}` : "";
  const total = receipt.total ? `\n💰 ${receipt.total.toFixed(2)} ${receipt.currency || currency}` : "";
  const items = receipt.items
    .map((item, index) => `${index + 1}. ${item.name} — ${item.amount.toFixed(2)} ${receipt.currency || currency}`)
    .join("\n");

  return `${title}${merchant}${date}${total}\n📌 scope: ${scopeText}\n\n${items}`;
}

function toEditTemplate(receipt: ExtractedReceipt): string {
  const header = [
    receipt.date ? `date: ${receipt.date}` : null,
    receipt.merchant ? `merchant: ${receipt.merchant}` : null,
    receipt.currency ? `currency: ${receipt.currency}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const items = receipt.items
    .map((item) => `- ${item.name} | ${item.amount} | ${item.category ?? "receipt"}`)
    .join("\n");

  return `${header ? `${header}\n\n` : ""}${items}`;
}

function parseEditedReceipt(text: string): ExtractedReceipt | null {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const receipt: ExtractedReceipt = { items: [] };

  for (const line of lines) {
    if (line.startsWith("date:")) {
      receipt.date = line.slice("date:".length).trim();
      continue;
    }

    if (line.startsWith("merchant:")) {
      receipt.merchant = line.slice("merchant:".length).trim();
      continue;
    }

    if (line.startsWith("currency:")) {
      receipt.currency = line.slice("currency:".length).trim();
      continue;
    }

    if (!line.startsWith("-")) {
      continue;
    }

    const parts = line.slice(1).split("|").map((part) => part.trim());
    const name = parts[0];
    const amount = Number(parts[1]?.replace(",", "."));
    const category = parts[2] || "receipt";

    if (!name || Number.isNaN(amount) || amount <= 0) {
      return null;
    }

    receipt.items.push({ name, amount, category });
  }

  return receipt.items.length > 0 ? receipt : null;
}

async function downloadTelegramFile(ctx: BotContext, fileId: string): Promise<Buffer> {
  const file = await ctx.api.getFile(fileId);

  if (!file.file_path) {
    throw new Error("Telegram did not return a file path.");
  }

  const url = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to download Telegram file.");
  }

  return Buffer.from(await response.arrayBuffer());
}

function getLargestPhotoFileId(ctx: BotContext): string | null {
  const photos = ctx.message?.photo;

  if (!photos || photos.length === 0) {
    return null;
  }

  return photos[photos.length - 1]?.file_id ?? null;
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

async function saveReceiptTransactions(
  ctx: BotContext,
  transactionService: TransactionService,
  userService: UserService
): Promise<void> {
  const telegramUser = ctx.from;
  const pendingReceiptImport = ctx.session.pendingReceiptImport;

  if (!telegramUser || !pendingReceiptImport?.scope) {
    const language = await getLanguage(ctx, userService);
    const expenseScopeMode = await getExpenseScopeMode(ctx, userService);
    await ctx.reply(getMessage(language, "noSession"), {
      reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
    });
    return;
  }

  const receipt = pendingReceiptImport.receipt;
  const currency = await userService.getUserCurrency(telegramUser.id);
  const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);
  const scope = getForcedScopeFromUserMode(expenseScopeMode) ?? pendingReceiptImport.scope;
  const transactionDate = parseReceiptDate(receipt.date);

  await transactionService.addTransactions(
    receipt.items.map((item: ExtractedReceiptItem) => ({
      telegramId: telegramUser.id,
      type: "expense",
      scope: scope!,
      amount: item.amount,
      category: item.category || "receipt",
      note: receipt.merchant ? `${receipt.merchant} | ${item.name}` : item.name,
      source: "receipt",
      ...(transactionDate ? { transactionDate } : {}),
    }))
  );

  ctx.session.pendingReceiptImport = null;
  ctx.session.pendingTransaction = null;
  ctx.session.awaitingScopeConfirmation = null;

  const language = await userService.getUserLanguage(telegramUser.id);
  await ctx.reply(`${getMessage(language, "saved")}\n${receipt.items.length} × ${currency}`, {
    reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
  });
}

export function registerReceiptImportCommand(
  bot: Bot<BotContext>,
  receiptExtractor: ReceiptExtractor | null,
  transactionService: TransactionService,
  userService: UserService
): void {
  bot.on("message:photo", async (ctx) => {
    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply(getMessage(defaultLanguage, "failed"));
      return;
    }

    const language = await userService.getUserLanguage(telegramUser.id);

    if (!receiptExtractor) {
      await ctx.reply(getMessage(language, "noApiKey"));
      return;
    }

    const fileId = getLargestPhotoFileId(ctx);

    if (!fileId) {
      await ctx.reply(getMessage(language, "failed"));
      return;
    }

    await ctx.reply(getMessage(language, "received"));

    try {
      const image = await downloadTelegramFile(ctx, fileId);
      const receipt = await receiptExtractor.extract(image, "image/jpeg");

      ctx.session.pendingReceiptImport = { receipt };

      await ctx.reply(getMessage(language, "chooseScope"), {
        reply_markup: createReceiptScopeKeyboard(language),
      });
    } catch (error) {
      console.error("❌ Receipt import error:", error);
      ctx.session.pendingReceiptImport = null;
      const expenseScopeMode = await userService.getExpenseScopeMode(telegramUser.id);
      await ctx.reply(getMessage(language, "failed"), {
        reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
      });
    }
  });

  bot.callbackQuery(
    [receiptImportCallbacks.scopePersonal, receiptImportCallbacks.scopeFamily],
    async (ctx) => {
      await ctx.answerCallbackQuery();

      const language = await getLanguage(ctx, userService);
      const pendingReceiptImport = ctx.session.pendingReceiptImport;
      const expenseScopeMode = await getExpenseScopeMode(ctx, userService);

      if (!pendingReceiptImport) {
        await ctx.reply(getMessage(language, "noSession"), {
          reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
        });
        return;
      }

      const scope: TransactionScope =
        ctx.callbackQuery.data === receiptImportCallbacks.scopePersonal
          ? "personal"
          : "family";

      ctx.session.pendingReceiptImport = {
        ...pendingReceiptImport,
        scope,
      };

      const currency = ctx.from
        ? await userService.getUserCurrency(ctx.from.id)
        : config.defaultCurrency;

      await ctx.reply(formatReceiptPreview(pendingReceiptImport.receipt, scope, currency, language), {
        reply_markup: createReceiptConfirmationKeyboard(language),
      });
    }
  );

  bot.callbackQuery(receiptImportCallbacks.confirm, async (ctx) => {
    await ctx.answerCallbackQuery();
    await saveReceiptTransactions(ctx, transactionService, userService);
  });

  bot.callbackQuery(receiptImportCallbacks.edit, async (ctx) => {
    await ctx.answerCallbackQuery();

    const language = await getLanguage(ctx, userService);
    const pendingReceiptImport = ctx.session.pendingReceiptImport;
    const expenseScopeMode = await getExpenseScopeMode(ctx, userService);

    if (!pendingReceiptImport) {
      await ctx.reply(getMessage(language, "noSession"), {
        reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
      });
      return;
    }

    await ctx.reply(`${getMessage(language, "editPrompt")}\n\n${toEditTemplate(pendingReceiptImport.receipt)}`);
  });

  bot.callbackQuery(receiptImportCallbacks.cancel, async (ctx) => {
    await ctx.answerCallbackQuery();

    const language = await getLanguage(ctx, userService);
    const expenseScopeMode = await getExpenseScopeMode(ctx, userService);
    ctx.session.pendingReceiptImport = null;
    ctx.session.pendingTransaction = null;
    ctx.session.awaitingScopeConfirmation = null;
    await ctx.reply(getMessage(language, "cancelled"), {
      reply_markup: createMainMenuKeyboard(language, expenseScopeMode),
    });
  });

  bot.on("message:text", async (ctx, next) => {
    const pendingReceiptImport = ctx.session.pendingReceiptImport;

    if (!pendingReceiptImport?.scope) {
      await next();
      return;
    }

    const language = await getLanguage(ctx, userService);
    const receipt = parseEditedReceipt(ctx.message.text);

    if (!receipt) {
      await ctx.reply(getMessage(language, "invalidEdit"));
      return;
    }

    ctx.session.pendingReceiptImport = {
      ...pendingReceiptImport,
      receipt,
    };

    const currency = ctx.from
      ? await userService.getUserCurrency(ctx.from.id)
      : config.defaultCurrency;

    await ctx.reply(formatReceiptPreview(receipt, pendingReceiptImport.scope, currency, language), {
      reply_markup: createReceiptConfirmationKeyboard(language),
    });
  });
}
