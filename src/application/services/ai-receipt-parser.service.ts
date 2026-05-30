import { config } from "../../config/env";
import { TransactionScope } from "../../infrastructure/database/models/transaction.model";
import { AiChatProvider, callChatWithFallback, extractJson } from "./ai-client.service";
import { NormalizedReceipt } from "./receipt-normalizer.service";

export type AiReceiptTransaction = {
  type: "expense";
  scope: TransactionScope;
  amount: number;
  parentCategory?: string;
  category: string;
  note: string;
  itemNames: string[];
};

export type AiReceiptParseResult = {
  status: "receipt_transactions";
  transactions: AiReceiptTransaction[];
  provider: AiChatProvider;
  usedFallbackProvider: boolean;
};

type ParseOptions = {
  language: string;
  defaultCurrency: string;
  defaultScope?: TransactionScope;
  forcedScope?: TransactionScope;
};

const EXPENSE_PARENT_CATEGORIES = new Set([
  "Продукты",
  "Кафе и рестораны",
  "Транспорт",
  "Жильё",
  "Коммунальные услуги",
  "Связь и интернет",
  "Здоровье",
  "Аптека",
  "Одежда",
  "Бытовая химия",
  "Дом",
  "Подписки",
  "Образование",
  "Работа",
  "Подарки",
  "Долги",
  "Развлечения",
  "Другое",
]);

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function validateReceiptParseResult(
  value: unknown,
  receipt: NormalizedReceipt,
  options: ParseOptions
): Omit<AiReceiptParseResult, "provider" | "usedFallbackProvider"> {
  if (!value || typeof value !== "object") {
    throw new Error("AI receipt result is not an object.");
  }

  const result = value as Record<string, unknown>;

  if (!Array.isArray(result.transactions) || result.transactions.length === 0) {
    throw new Error("AI receipt result has no transactions.");
  }

  const sourceItemNames = new Set(receipt.items.map((item) => item.name));
  const sourceItemsTotal = roundMoney(
    receipt.items.reduce((sum, item) => sum + item.sum, 0)
  );
  const transactions = result.transactions.map((value, index) => {
    if (!value || typeof value !== "object") {
      throw new Error(`AI receipt transaction ${index + 1} is invalid.`);
    }

    const transaction = value as Record<string, unknown>;
    const amount = typeof transaction.amount === "number" ? transaction.amount : Number(transaction.amount);
    const rawParentCategory = optionalString(transaction.parentCategory);
    const parentCategory = rawParentCategory && EXPENSE_PARENT_CATEGORIES.has(rawParentCategory)
      ? rawParentCategory
      : "Другое";
    const category = optionalString(transaction.category);
    const note = optionalString(transaction.note) ?? category ?? "";
    const suppliedItemNames = Array.isArray(transaction.sourceItemNames)
      ? transaction.sourceItemNames.filter(
          (itemName): itemName is string => typeof itemName === "string" && itemName.trim().length > 0
        )
      : [];
    const itemNames = suppliedItemNames.length > 0
      ? suppliedItemNames
      : note
        .split(";")
        .map((itemName) => itemName.trim())
        .filter(Boolean);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`AI receipt transaction ${index + 1} amount is invalid.`);
    }

    if (!category) {
      throw new Error(`AI receipt transaction ${index + 1} category is missing.`);
    }

    if (suppliedItemNames.length === 0) {
      console.warn("Receipt AI sourceItemNames repaired");
    }

    for (const itemName of suppliedItemNames) {
      if (!sourceItemNames.has(itemName)) {
        console.warn(`AI receipt transaction ${index + 1} references unknown source item: ${itemName}`);
      }
    }

    return {
      type: "expense" as const,
      scope: options.forcedScope ?? options.defaultScope ?? "family",
      amount: roundMoney(amount),
      parentCategory,
      category,
      note,
      itemNames: itemNames.length > 0 ? itemNames : [category],
    };
  });
  const aiTotal = roundMoney(transactions.reduce((sum, transaction) => sum + transaction.amount, 0));

  if (Math.abs(aiTotal - sourceItemsTotal) > 0.01) {
    throw new Error(`AI receipt transaction total ${aiTotal} differs from source item total ${sourceItemsTotal}.`);
  }

  return {
    status: "receipt_transactions",
    transactions,
  };
}

function createPrompt(receipt: NormalizedReceipt, options: ParseOptions): string {
  const sellerName = receipt.seller.retailPlace ?? receipt.seller.name ?? "";
  const items = receipt.items.map((item) => ({
    name: item.name,
    sumRub: item.sum,
    quantity: item.quantity,
    priceRub: item.price,
  }));

  return `
You normalize and optionally group receipt items from Proverkacheka for a Telegram finance bot.
Return JSON only. No markdown. No explanation.

User UI language: ${options.language}
Default currency: ${options.defaultCurrency}
Receipt seller: ${sellerName}
Receipt date: ${receipt.fiscal.dateTime.toISOString()}
Receipt items JSON, amounts are already in rubles:
${JSON.stringify(items)}

Output this exact JSON shape:
{"transactions":[{"parentCategory":"Продукты","category":"Апельсины","amount":399.10,"note":"Апельсины красные; Апельсины","sourceItemNames":["Апельсины красные","Апельсины"]}]}

Rules:
- Do not save anything.
- Use only the receipt items above. Do not invent, drop, or rename sourceItemNames.
- Always include parentCategory.
- parentCategory must be exactly one of: Продукты, Кафе и рестораны, Транспорт, Жильё, Коммунальные услуги, Связь и интернет, Здоровье, Аптека, Одежда, Бытовая химия, Дом, Подписки, Образование, Работа, Подарки, Долги, Развлечения, Другое.
- Always include sourceItemNames.
- sourceItemNames must be an array of exact original receipt item names from the input.
- Do not omit sourceItemNames.
- amount must equal the sumRub total of sourceItemNames.
- The total of all transactions must match the source item sum within 0.01.
- If unsure, keep an item as a separate transaction.
- Category should be short and useful for monthly reports.
- category must be a clean specific product or service category, not a broad parent category.
- Category language should match the receipt/item language or user's UI language.
- For Russian receipt items, use Russian categories.
- Remove brand names, package sizes, weights, volumes, percentages, and marketing words from category.
- Remove color/details unless it changes the product type.
- Keep the meaningful product type.
- Put original source item names in note, separated by "; ".
- Examples:
  "Апельсины красные" + "Апельсины" => parentCategory "Продукты", category "Апельсины"
  "Молоко СТМ 2,5% ПЭТ 850г" => parentCategory "Продукты", category "Молоко"
  "Сыр ДерМолочко Сулугуни 300г" => parentCategory "Продукты", category "Сыр"
  "Яйцо куриное С0 (10шт)" => parentCategory "Продукты", category "Яйца"
  "Томаты Черри Делтари 250г" => parentCategory "Продукты", category "Томаты"
  "CIF Актив Чистящий крем 230мл Лимон" => parentCategory "Бытовая химия", category "Чистящее средство"
`.trim();
}

export class AiReceiptParserService {
  isConfigured(): boolean {
    return config.receiptAiProvider !== "none" || config.receiptAiFallbackProvider !== "none";
  }

  async parse(
    receipt: NormalizedReceipt,
    options: ParseOptions
  ): Promise<AiReceiptParseResult> {
    if (!this.isConfigured()) {
      throw new Error("AI receipt parsing is not configured.");
    }

    const result = await callChatWithFallback<Omit<AiReceiptParseResult, "provider" | "usedFallbackProvider">>({
      prompt: createPrompt(receipt, options),
      primaryProvider: config.receiptAiProvider,
      fallbackProvider: config.receiptAiFallbackProvider,
      timeoutMs: config.receiptAiTimeoutMs,
      logPrefix: "Receipt AI",
      groqApiKey: config.groqApiKey,
      groqModel: config.groqChatModel,
      openrouterApiKey: config.openrouterApiKey,
      openrouterModel: config.openrouterReceiptModel,
      openrouterBaseUrl: config.openrouterBaseUrl,
      validateContent: (content) =>
        validateReceiptParseResult(JSON.parse(extractJson(content)), receipt, options),
    });

    if (!result.ok) {
      throw new Error(`Receipt AI failed: ${result.error}`);
    }

    return {
      ...result.value,
      provider: result.provider,
      usedFallbackProvider: result.usedFallback,
    };
  }
}
