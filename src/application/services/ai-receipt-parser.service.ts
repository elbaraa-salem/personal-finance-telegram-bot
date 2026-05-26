import { config } from "../../config/env";
import { TransactionScope } from "../../infrastructure/database/models/transaction.model";
import {
  extractJson,
  OpenRouterTextProvider,
  AiTextProvider,
} from "./ai-transaction-parser.service";
import { NormalizedReceipt } from "./receipt-normalizer.service";

export type AiReceiptTransaction = {
  type: "expense";
  scope: TransactionScope;
  amount: number;
  category: string;
  note: string;
  itemNames: string[];
};

export type AiReceiptParseResult =
  | {
      status: "receipt_transactions";
      transactions: AiReceiptTransaction[];
    }
  | {
      status: "cannot_group";
      reason: string;
    };

type ParseOptions = {
  language: string;
  defaultCurrency: string;
  defaultScope?: TransactionScope;
  forcedScope?: TransactionScope;
};

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isScope(value: unknown): value is TransactionScope {
  return value === "personal" || value === "family";
}

function validateReceiptParseResult(value: unknown): AiReceiptParseResult {
  if (!value || typeof value !== "object") {
    throw new Error("AI receipt result is not an object.");
  }

  const result = value as Record<string, unknown>;

  if (result.status === "cannot_group") {
    return {
      status: "cannot_group",
      reason: optionalString(result.reason) ?? "Could not group receipt items.",
    };
  }

  if (result.status !== "receipt_transactions") {
    throw new Error("AI receipt result has an invalid status.");
  }

  if (!Array.isArray(result.transactions) || result.transactions.length === 0) {
    throw new Error("AI receipt result has no transactions.");
  }

  const transactions = result.transactions.map((value, index) => {
    if (!value || typeof value !== "object") {
      throw new Error(`AI receipt transaction ${index + 1} is invalid.`);
    }

    const transaction = value as Record<string, unknown>;
    const amount = typeof transaction.amount === "number" ? transaction.amount : Number(transaction.amount);
    const scope = transaction.scope;
    const category = optionalString(transaction.category);
    const note = optionalString(transaction.note) ?? category ?? "";
    const itemNames = Array.isArray(transaction.itemNames)
      ? transaction.itemNames.filter(
          (itemName): itemName is string => typeof itemName === "string" && itemName.trim().length > 0
        )
      : [];

    if (transaction.type !== "expense") {
      throw new Error(`AI receipt transaction ${index + 1} type is invalid.`);
    }

    if (!isScope(scope)) {
      throw new Error(`AI receipt transaction ${index + 1} scope is invalid.`);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`AI receipt transaction ${index + 1} amount is invalid.`);
    }

    if (!category) {
      throw new Error(`AI receipt transaction ${index + 1} category is missing.`);
    }

    if (itemNames.length === 0) {
      throw new Error(`AI receipt transaction ${index + 1} itemNames are missing.`);
    }

    return {
      type: "expense" as const,
      scope,
      amount,
      category,
      note,
      itemNames,
    };
  });

  return {
    status: "receipt_transactions",
    transactions,
  };
}

function createPrompt(receipt: NormalizedReceipt, options: ParseOptions): string {
  const scopeText = options.forcedScope
    ? `The user selected expense scope "${options.forcedScope}". This scope is final and must not be changed. Group items only by category and amount.`
    : options.defaultScope
    ? `Default expense scope selected by the user: ${options.defaultScope}. Prefer it unless item names clearly suggest another scope.`
    : "No default expense scope was selected.";
  const sellerName = receipt.seller.retailPlace ?? receipt.seller.name ?? "";
  const items = receipt.items.map((item) => ({
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    sum: item.sum,
  }));

  return `
You are a strict receipt expense grouping parser for a Telegram finance bot.
Return JSON only. No markdown. No explanation.

User UI language: ${options.language}
Default currency: ${options.defaultCurrency}
${scopeText}
Receipt seller: ${sellerName}
Receipt date: ${receipt.fiscal.dateTime.toISOString()}
Receipt total: ${receipt.fiscal.totalSum}
Receipt items JSON:
${JSON.stringify(items)}

Output one of these exact shapes:
{"status":"receipt_transactions","transactions":[{"type":"expense","scope":"family","amount":4078,"category":"продукты","note":"Рыбная продукция из чека Рыба_35_Фрунзе","itemNames":["Рыбная продукция"]}]}
{"status":"cannot_group","reason":"..."}

Rules:
- Do not save anything.
- Group receipt items into useful expense transactions.
- Do not create one transaction per item unless necessary.
- Prefer grouping by category: продукты / еда / рыба / мясо / хлеб; бытовая химия; лекарства; кофе; другое.
- For groceries, home food, fish, meat, bread, and ordinary supermarket food products, usually use scope "family".
- For coffee, snacks, and clearly personal items, use scope "personal" unless they look household/family.
- If unsure, prefer "family" for ordinary supermarket food products.
- A receipt item named "Рыбная продукция" should normally become scope "family", category "рыба" or "продукты", amount equal to its sum, and note mentioning the receipt seller.
- Category language should match the receipt/item language or user's UI language.
- Amount total of all transactions must equal receipt total or be very close.
- Every transaction must have type "expense", a positive amount, a valid scope, a non-empty category, a useful note, and non-empty itemNames.
- Use amounts in rubles exactly as provided here, not kopecks.
`.trim();
}

export class AiReceiptParserService {
  private readonly provider: AiTextProvider | null;

  constructor() {
    if (!config.aiApiKey || !config.aiModel) {
      this.provider = null;
      return;
    }

    if ((config.aiProvider ?? "openrouter") !== "openrouter") {
      this.provider = null;
      return;
    }

    this.provider = new OpenRouterTextProvider(
      config.aiApiKey,
      config.aiModel,
      config.aiBaseUrl
    );
  }

  isConfigured(): boolean {
    return this.provider !== null;
  }

  async parse(
    receipt: NormalizedReceipt,
    options: ParseOptions
  ): Promise<AiReceiptParseResult> {
    if (!this.provider) {
      return {
        status: "cannot_group",
        reason: "AI receipt parsing is not configured.",
      };
    }

    const responseText = await this.provider.complete(createPrompt(receipt, options));
    const parsedJson = JSON.parse(extractJson(responseText));

    return validateReceiptParseResult(parsedJson);
  }
}
