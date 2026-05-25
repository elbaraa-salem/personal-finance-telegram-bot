import { GoogleGenAI } from "@google/genai";

export type ExtractedReceiptItem = {
  name: string;
  amount: number;
  category?: string;
};

export type ExtractedReceipt = {
  merchant?: string;
  date?: string;
  currency?: string;
  total?: number;
  items: ExtractedReceiptItem[];
};

export interface ReceiptExtractor {
  extract(image: Buffer, mimeType: string): Promise<ExtractedReceipt>;
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

  if (firstBraceIndex === -1 || lastBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
    throw new Error("Gemini did not return JSON.");
  }

  return trimmedText.slice(firstBraceIndex, lastBraceIndex + 1);
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
}

function validateReceipt(value: unknown): ExtractedReceipt {
  if (!value || typeof value !== "object") {
    throw new Error("Receipt data is not an object.");
  }

  const receipt = value as Record<string, unknown>;
  const itemsValue = receipt.items;

  if (!Array.isArray(itemsValue)) {
    throw new Error("Receipt items are missing.");
  }

  const items = itemsValue
    .map((itemValue) => {
      if (!itemValue || typeof itemValue !== "object") {
        return null;
      }

      const item = itemValue as Record<string, unknown>;
      const name = toOptionalString(item.name);
      const amount = toOptionalNumber(item.amount);

      if (!name || !amount) {
        return null;
      }

      const category = toOptionalString(item.category);

      return {
        name,
        amount,
        ...(category ? { category } : {}),
      };
    })
    .filter((item): item is ExtractedReceiptItem => item !== null);

  if (items.length === 0) {
    throw new Error("No readable receipt items found.");
  }

  const merchant = toOptionalString(receipt.merchant);
  const date = toOptionalString(receipt.date);
  const currency = toOptionalString(receipt.currency);
  const total = toOptionalNumber(receipt.total);

  return {
    ...(merchant ? { merchant } : {}),
    ...(date ? { date } : {}),
    ...(currency ? { currency } : {}),
    ...(total ? { total } : {}),
    items,
  };
}

export class GeminiReceiptExtractor implements ReceiptExtractor {
  private readonly ai: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async extract(image: Buffer, mimeType: string): Promise<ExtractedReceipt> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [
        {
          inlineData: {
            mimeType,
            data: image.toString("base64"),
          },
        },
        {
          text:
            "Extract receipt data from this image. " +
            "Return ONLY valid JSON without markdown. " +
            "Use this exact shape: " +
            '{"merchant":"","date":"YYYY-MM-DD","currency":"RUB","total":0,"items":[{"name":"","amount":0,"category":"food"}]}. ' +
            "If a field is unknown, use an empty string. " +
            "The amount must be a number. Do not include taxes, totals, discounts, or payment lines as items unless they are actual purchased products.",
        },
      ],
    });

    const text = response.text;

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    return validateReceipt(JSON.parse(extractJson(text)));
  }
}
