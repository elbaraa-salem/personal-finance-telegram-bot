import { config } from "../../config/env";
import {
  TransactionScope,
  TransactionType,
} from "../../infrastructure/database/models/transaction.model";
import { callChatWithFallback, extractJson } from "./ai-client.service";
import { extractRelativeDateFromText } from "./relative-date-parser.service";

type MissingField = "amount" | "type" | "category" | "date" | "scope";

export type AiTransactionParseResult =
  | {
      status: "transaction";
      confidence: number;
      type: TransactionType;
      scope: TransactionScope | null;
      amount: number;
      parentCategory?: string;
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

const INCOME_PARENT_CATEGORIES = new Set([
  "Работа",
  "Уроки",
  "Долг",
  "Подарок",
  "Другое",
]);

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

const EXPLICIT_DATE_PATTERN =
  /(?<!\d)(?:(\d{2})[-./](\d{2})[-./](\d{4})|(\d{4})[-./](\d{2})[-./](\d{2}))(?!\d)/;

export function extractExplicitDateFromText(
  text: string
): { date: Date; matchedText: string } | null {
  const match = EXPLICIT_DATE_PATTERN.exec(text);

  if (!match) {
    return null;
  }

  const isDayFirst = Boolean(match[1] && match[2] && match[3]);
  const isYearFirst = Boolean(match[4] && match[5] && match[6]);

  if (!isDayFirst && !isYearFirst) {
    return null;
  }

  const day = Number(isDayFirst ? match[1] : match[6]);
  const month = Number(isDayFirst ? match[2] : match[5]);
  const year = Number(isDayFirst ? match[3] : match[4]);
  const date = new Date(Date.UTC(year, month - 1, day));

  const isValidDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isValidDate) {
    return null;
  }

  return {
    date,
    matchedText: match[0],
  };
}

function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function removeDateText(text: string, matchedText: string): string {
  return text
    .replace(matchedText, " ")
    .replace(EXPLICIT_DATE_PATTERN, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/^[,.;:!?]\s*/, "")
    .replace(/\s*[,.;:!?]$/, "")
    .replace(/\s+/g, " ")
    .trim();
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
  const parentCategory = toOptionalString(result.parentCategory);
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

  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("AI confidence is invalid.");
  }

  const allowedParentCategories = type === "income"
    ? INCOME_PARENT_CATEGORIES
    : EXPENSE_PARENT_CATEGORIES;
  const normalizedParentCategory =
    parentCategory && allowedParentCategories.has(parentCategory)
      ? parentCategory
      : undefined;

  return {
    status: "transaction",
    confidence,
    type,
    scope: scope ?? null,
    amount,
    ...(normalizedParentCategory ? { parentCategory: normalizedParentCategory } : {}),
    category,
    transactionDate: transactionDate && isIsoDate(transactionDate) ? transactionDate : "",
    note,
    currency,
    needsScopeConfirmation,
  };
}

function applyDeterministicDate(
  result: AiTransactionParseResult,
  originalText: string,
  currentDate: string,
  timezone: string
): AiTransactionParseResult {
  if (result.status !== "transaction") {
    return result;
  }

  const explicitDate = extractExplicitDateFromText(originalText);

  if (explicitDate) {
    return {
      ...result,
      transactionDate: formatDateOnly(explicitDate.date),
      category: removeDateText(result.category, explicitDate.matchedText) || result.category,
      note: removeDateText(result.note, explicitDate.matchedText),
    };
  }

  const relativeDate = extractRelativeDateFromText(
    originalText,
    new Date(`${currentDate}T00:00:00.000Z`),
    timezone
  );

  if (relativeDate) {
    return {
      ...result,
      transactionDate: formatDateOnly(relativeDate.date),
      category: removeDateText(result.category, relativeDate.matchedText) || result.category,
      note: removeDateText(result.note, relativeDate.matchedText),
    };
  }

  return {
    ...result,
    transactionDate: result.transactionDate || currentDate,
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

Current date in the user's timezone: ${options.currentDate}
User timezone: ${options.timezone}
User language: ${options.language}
${forcedTypeText}
${forcedScopeText}

Output one of these exact shapes:
{"status":"transaction","confidence":0.95,"type":"income","scope":null,"amount":1000,"parentCategory":"Работа","category":"salary","transactionDate":null,"note":"salary","currency":"RUB","needsScopeConfirmation":false}
{"status":"not_transaction","reason":"..."}
{"status":"missing_details","missingFields":["amount"],"question":"..."}

Rules:
- amount must be a positive number. Prefer returning amount as a JSON number, not a string.
- If amount is written with currency, extract only the numeric value. Example: "2000 рублей" => 2000.
- If amount is uncertain, return missing_details.
- transactionDate must be YYYY-MM-DD when there is an explicit or relative date. If no explicit or relative date is mentioned, return transactionDate as null.
- The user may write explicit dates in DD-MM-YYYY, DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD, YYYY.MM.DD, or YYYY/MM/DD formats.
- DD-MM-YYYY means day-month-year. YYYY-MM-DD means year-month-day.
- If there is a date in the message, use it as transactionDate.
- Do not include the date in category or note. Remove the date from note.
- Resolve all relative dates using the current date in the user's timezone and return transactionDate as YYYY-MM-DD.
- Support relative dates: اليوم, النهاردة, today, сегодня = current date; أمس, yesterday, вчера = current date minus 1 day; أول أمس, позавчера = current date minus 2 days; قبل يومين, two days ago, два дня назад = current date minus 2 days.
- Support weekday relative dates such as "يوم الجمعة اللي فاتت" and "в прошлую пятницу" as the previous matching weekday before the current date in the user's timezone.
- Do not include relative date phrases in category or note.
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
- Return parentCategory when possible.
- For expense parentCategory, use exactly one of: Продукты, Кафе и рестораны, Транспорт, Жильё, Коммунальные услуги, Связь и интернет, Здоровье, Аптека, Одежда, Бытовая химия, Дом, Подписки, Образование, Работа, Подарки, Долги, Развлечения, Другое.
- For income parentCategory, use exactly one of: Работа, Уроки, Долг, Подарок, Другое.
- parentCategory is a broad controlled Russian category. category remains the specific clean item/service in the user's language.
- Clean category by removing brand names, package sizes, weights, volumes, percentages, and marketing details when the text contains product names.
- Put extra details such as person names, shop names, or context into note.
- Example Russian: "1500 работа урок с Сергей" => category "репетиторство" or "работа", not "tutoring".
- Example Arabic: "أخذت 1500 من درس مع سيرجي" => category "تدريس", not "tutoring".
- Example English: "1500 lesson with Sergey" => category "tutoring".
- note should preserve the original idea without unnecessary words.
- Arabic amount words may appear: ألف = 1000, ألفين = 2000, نص ألف = 500.
- Support 2k as 2000 and common ruble words/symbols.

Examples:
Input: "ярче продукты 2026-05-01 1233"
Output:
{"status":"transaction","confidence":0.95,"type":"expense","scope":null,"amount":1233,"parentCategory":"Продукты","category":"продукты","transactionDate":"2026-05-01","note":"ярче","currency":"RUB","needsScopeConfirmation":true}

Input: "17-05-2026 урок с Мария 3000 работа"
Output:
{"status":"transaction","confidence":0.95,"type":"income","scope":null,"amount":3000,"parentCategory":"Уроки","category":"работа","transactionDate":"2026-05-17","note":"урок с Мария","currency":"RUB","needsScopeConfirmation":false}

Assume current date is 2026-05-29 for these relative-date examples:
Input: "اشتريت عصير قصب من يومين ب ٣٠٠ روبل"
Output:
{"status":"transaction","confidence":0.95,"type":"expense","scope":null,"amount":300,"parentCategory":"Продукты","category":"عصير قصب","transactionDate":"2026-05-27","note":null,"currency":"RUB","needsScopeConfirmation":true}

Input: "اشتريت لحمة 500 روبل الجمعة اللي فاتت"
Output:
{"status":"transaction","confidence":0.95,"type":"expense","scope":null,"amount":500,"parentCategory":"Продукты","category":"لحمة","transactionDate":"2026-05-22","note":null,"currency":"RUB","needsScopeConfirmation":true}

Input: "يوم السبت اللي فات اشتريت بصل بخمسين جنيه"
Output:
{"status":"transaction","confidence":0.95,"type":"expense","scope":null,"amount":50,"parentCategory":"Продукты","category":"بصل","transactionDate":"2026-05-23","note":null,"currency":"EGP","needsScopeConfirmation":true}

Input: "купил мясо в прошлую пятницу за 500 рублей"
Rule: transactionDate is the previous Friday strictly before the current date.

Input: "bought meat for 500 rubles last Friday"
Rule: transactionDate is the previous Friday strictly before the current date.

Text:
${JSON.stringify(text)}
`.trim();
}

export class AiTransactionParserService {
  isConfigured(): boolean {
    return config.aiProvider !== "none" || config.aiFallbackProvider !== "none";
  }

  async parse(
    text: string,
    options: ParseOptions
  ): Promise<AiTransactionParseResult> {
    if (!this.isConfigured()) {
      throw new Error("AI parsing is not configured.");
    }

    const result = await callChatWithFallback<AiTransactionParseResult>({
      prompt: createPrompt(text, options),
      primaryProvider: config.aiProvider,
      fallbackProvider: config.aiFallbackProvider,
      timeoutMs: config.aiRequestTimeoutMs,
      logPrefix: "AI text parser",
      groqApiKey: config.groqApiKey,
      groqModel: config.groqChatModel,
      openrouterApiKey: config.openrouterApiKey ?? config.aiApiKey,
      openrouterModel: config.openrouterChatModel ?? config.aiModel,
      openrouterBaseUrl: config.openrouterBaseUrl ?? config.aiBaseUrl,
      validateContent: (content) => validateParseResult(JSON.parse(extractJson(content))),
    });

    if (!result.ok) {
      throw new Error(`AI parsing failed: ${result.error}`);
    }

    const parsedResult = result.value;
    const datedResult = applyDeterministicDate(
      parsedResult,
      text,
      options.currentDate,
      options.timezone
    );

    return applyForcedOptions(datedResult, options);
  }
}
