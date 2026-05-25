import { config } from "../../config/env";
import {
  TransactionScope,
  TransactionType,
} from "../../infrastructure/database/models/transaction.model";

type MissingField = "amount" | "type" | "category" | "date" | "scope";

export type AiTransactionParseResult =
  | {
      status: "transaction";
      confidence: number;
      type: TransactionType;
      scope: TransactionScope | null;
      amount: number;
      category: string;
      transactionDate: string;
      note: string;
      currency?: string | null;
      needsScopeConfirmation: boolean;
    }
  | {
      status: "not_transaction";
      reason: string;
    }
  | {
      status: "missing_details";
      missingFields: MissingField[];
      question: string;
    };

type ParseOptions = {
  language: string;
  timezone: string;
  currentDate: string;
  forcedType?: TransactionType;
  forcedScope?: TransactionScope;
};

interface AiTextProvider {
  complete(prompt: string): Promise<string>;
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

class OpenRouterTextProvider implements AiTextProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string
  ) {}

  async complete(prompt: string): Promise<string> {
    const response = await fetch(
      `${this.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0,
          response_format: {
            type: "json_object",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `AI provider request failed: ${response.status}${
          errorText ? ` - ${errorText}` : ""
        }`
      );
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("AI provider returned an empty response.");
    }

    return content;
  }
}

function extractJson(text: string): string {
  const trimmedText = text.trim();

  if (trimmedText.startsWith("```")) {
    return trimmedText
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
  }

  const firstBraceIndex = trimmedText.indexOf("{");
  const lastBraceIndex = trimmedText.lastIndexOf("}");

  if (
    firstBraceIndex === -1 ||
    lastBraceIndex === -1 ||
    lastBraceIndex <= firstBraceIndex
  ) {
    throw new Error("AI did not return JSON.");
  }

  return trimmedText.slice(firstBraceIndex, lastBraceIndex + 1);
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isTransactionType(value: unknown): value is TransactionType {
  return value === "income" || value === "expense";
}

function isTransactionScope(value: unknown): value is TransactionScope {
  return value === "personal" || value === "family";
}

function isMissingField(value: unknown): value is MissingField {
  return (
    value === "amount" ||
    value === "type" ||
    value === "category" ||
    value === "date" ||
    value === "scope"
  );
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeAiAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim().toLowerCase();

  if (!text) {
    return null;
  }

  if (text.includes("نص ألف") || text.includes("نصف ألف")) {
    return 500;
  }

  if (text.includes("ألفين") || text.includes("الفين")) {
    return 2000;
  }

  if (text.includes("ألف") || text.includes("الف")) {
    return 1000;
  }

  if (/^\d+(\.\d+)?k$/.test(text)) {
    return Number.parseFloat(text.replace("k", "")) * 1000;
  }

  let numericText = text.replace(/\s/g, "").replace(/[^\d.,]/g, "");

  if (!numericText) {
    return null;
  }

  const hasComma = numericText.includes(",");
  const hasDot = numericText.includes(".");

  if (hasComma && hasDot) {
    numericText = numericText.replace(/,/g, "");
  } else if (hasComma) {
    const parts = numericText.split(",");

    if (parts.length === 2 && parts[1]?.length === 3) {
      numericText = parts.join("");
    } else {
      numericText = numericText.replace(",", ".");
    }
  } else if (hasDot) {
    const parts = numericText.split(".");

    if (parts.length === 2 && parts[1]?.length === 3) {
      numericText = parts.join("");
    }
  }

  const amount = Number(numericText);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return amount;
}

function validateParseResult(value: unknown): AiTransactionParseResult {
  if (!value || typeof value !== "object") {
    throw new Error("AI parse result is not an object.");
  }

  const result = value as Record<string, unknown>;

  if (result.status === "not_transaction") {
    return {
      status: "not_transaction",
      reason: toOptionalString(result.reason) ?? "No transaction detected.",
    };
  }

  if (result.status === "missing_details") {
    const missingFields = Array.isArray(result.missingFields)
      ? result.missingFields.filter(isMissingField)
      : [];

    if (missingFields.length === 0) {
      throw new Error("Missing details result has no valid missing fields.");
    }

    return {
      status: "missing_details",
      missingFields,
      question: toOptionalString(result.question) ?? "Please add more details.",
    };
  }

  if (result.status !== "transaction") {
    throw new Error("AI parse result has an invalid status.");
  }

  const type = result.type;
  const scope = result.scope;
  const amount = normalizeAiAmount(result.amount);
  const category = toOptionalString(result.category);
  const transactionDate = toOptionalString(result.transactionDate);
  const note = toOptionalString(result.note) ?? category ?? "";
  const confidence =
    typeof result.confidence === "number"
      ? result.confidence
      : Number(result.confidence);
  const needsScopeConfirmation = result.needsScopeConfirmation === true;
  const currency = toOptionalString(result.currency) ?? null;

  if (!isTransactionType(type)) {
    throw new Error("AI transaction type is invalid.");
  }

  if (scope !== null && scope !== undefined && !isTransactionScope(scope)) {
    throw new Error("AI transaction scope is invalid.");
  }

  if (amount === null) {
    throw new Error("AI transaction amount is invalid.");
  }

  if (!category) {
    throw new Error("AI transaction category is missing.");
  }

  if (!transactionDate || !isIsoDate(transactionDate)) {
    throw new Error("AI transaction date is invalid.");
  }

  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("AI confidence is invalid.");
  }

  return {
    status: "transaction",
    confidence,
    type,
    scope: scope ?? null,
    amount,
    category,
    transactionDate,
    note,
    currency,
    needsScopeConfirmation,
  };
}

function applyForcedOptions(
  result: AiTransactionParseResult,
  options: ParseOptions
): AiTransactionParseResult {
  if (result.status !== "transaction") {
    return result;
  }

  const finalType = options.forcedType ?? result.type;

  if (finalType === "income") {
    return {
      ...result,
      type: "income",
      scope: null,
      needsScopeConfirmation: false,
    };
  }

  if (options.forcedScope) {
    return {
      ...result,
      type: "expense",
      scope: options.forcedScope,
      needsScopeConfirmation: false,
    };
  }

  return {
    ...result,
    type: finalType,
  };
}

function createPrompt(text: string, options: ParseOptions): string {
  const forcedTypeText = options.forcedType
    ? `The user selected transaction type "${options.forcedType}". This type is final and must not be changed.`
    : "No transaction type was selected. Infer income or expense from the text.";

  const forcedScopeText = options.forcedScope
    ? `The user selected expense scope "${options.forcedScope}". This scope is final and must not be changed. Analyze only amount, category, date, and note.`
    : "No expense scope was selected. Infer scope only when there is clear evidence.";

  return `
You are a strict financial transaction parser for a Telegram personal finance bot.
Return JSON only. No markdown. No explanation.

Current date: ${options.currentDate}
Timezone: ${options.timezone}
User language: ${options.language}
${forcedTypeText}
${forcedScopeText}

Output one of these exact shapes:
{"status":"transaction","confidence":0.95,"type":"income","scope":null,"amount":1000,"category":"salary","transactionDate":"YYYY-MM-DD","note":"salary","currency":"RUB","needsScopeConfirmation":false}
{"status":"not_transaction","reason":"..."}
{"status":"missing_details","missingFields":["amount"],"question":"..."}

Rules:
- amount must be a positive number. Prefer returning amount as a JSON number, not a string.
- If amount is written with currency, extract only the numeric value. Example: "2000 рублей" => 2000.
- If amount is uncertain, return missing_details.
- transactionDate must be YYYY-MM-DD. If no date is mentioned, use the current date.
- Support relative dates: اليوم, النهاردة, today, сегодня = current date; أمس, yesterday, вчера = current date minus 1 day; قبل يومين, two days ago, два дня назад = current date minus 2 days.
- If the user selected a transaction type, keep that type exactly.
- If the user selected an expense scope, keep that scope exactly.
- For expenses without selected scope, scope is "family" for home/family/wife/house/shared household/groceries for home: البيت, للبيت, الأسرة, العائلة, مراتي, زوجتي, لنا, أكل البيت, حاجات البيت, домой, для дома, семья, жене, продукты домой, для нас, home, family, wife, groceries for home, for us.
- For expenses without selected scope, scope is "personal" for myself/personal/friends/invitation/social/private/university/my transport: لنفسي, شخصي, أصحابي, أصدقائي, عزومة, قهوة لنفسي, الجامعة, مواصلاتي, себе, личный, друзьям, с друзьями, угостил, университет, мой проезд, myself, personal, friends, treated friends, my transport.
- A meal or invitation for friends is personal unless the text clearly says family.
- If expense scope is unclear and no scope was selected by the user, set scope to null and needsScopeConfirmation to true.
- Income does not need scope; set scope to null.
- Detect the main language of the user's message.
- category must be written in the same language as the user's message.
- If the user writes in Russian, category must be Russian, for example: работа, продукты, кофе, транспорт, репетиторство, зарплата.
- If the user writes in Arabic, category must be Arabic, for example: شغل، طعام، قهوة، مواصلات، تدريس، راتب.
- If the user writes in English, category must be English, for example: work, groceries, coffee, transport, tutoring, salary.
- Do not translate category to English unless the user's message is in English.
- The category does not have to be copied exactly from the user's words; choose a short, natural category in the same language.
- Put extra details such as person names, shop names, or context into note.
- Example Russian: "1500 работа урок с Сергей" => category "репетиторство" or "работа", not "tutoring".
- Example Arabic: "أخذت 1500 من درس مع سيرجي" => category "تدريس", not "tutoring".
- Example English: "1500 lesson with Sergey" => category "tutoring".
- note should preserve the original idea without unnecessary words.
- Arabic amount words may appear: ألف = 1000, ألفين = 2000, نص ألف = 500.
- Support 2k as 2000 and common ruble words/symbols.

Text:
${JSON.stringify(text)}
`.trim();
}

export class AiTransactionParserService {
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
    text: string,
    options: ParseOptions
  ): Promise<AiTransactionParseResult> {
    if (!this.provider) {
      throw new Error("AI parsing is not configured.");
    }

    const responseText = await this.provider.complete(createPrompt(text, options));
    const parsedJson = JSON.parse(extractJson(responseText));
    const parsedResult = validateParseResult(parsedJson);

    return applyForcedOptions(parsedResult, options);
  }
}