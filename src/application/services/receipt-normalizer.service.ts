export type NormalizedReceipt = {
  fiscal: {
    fn?: string;
    fd?: string;
    fp?: string;
    dateTime: Date;
    totalSum: number;
  };
  seller: {
    name?: string;
    inn?: string;
    retailPlace?: string;
    address?: string;
  };
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    sum: number;
  }>;
};

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error(`${name} is missing or invalid.`);
  }

  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalScalarString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function moneyFromKopecks(value: unknown, field: string): number {
  const amount = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(amount)) {
    throw new Error(`Receipt field ${field} is invalid.`);
  }

  return amount / 100;
}

function optionalMoneyFromKopecks(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const amount = typeof value === "number" ? value : Number(value);

  return Number.isFinite(amount) ? amount / 100 : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export class ReceiptNormalizerService {
  normalizeProverkachekaResponse(response: unknown): NormalizedReceipt {
    const root = asRecord(response, "Proverkacheka response");

    if (root.code !== 1) {
      throw new Error("Proverkacheka response code is not successful.");
    }

    const data = asRecord(root.data, "Proverkacheka data");
    const json = asRecord(data.json, "Proverkacheka receipt JSON");
    const rawItems = json.items;

    const receiptItems = Array.isArray(rawItems) ? rawItems : [];

    const dateTimeText = optionalString(json.dateTime);
    const dateTime = dateTimeText ? new Date(dateTimeText) : new Date(Number.NaN);

    if (Number.isNaN(dateTime.getTime())) {
      throw new Error("Receipt dateTime is invalid.");
    }

    const metadata =
      json.metadata && typeof json.metadata === "object"
        ? (json.metadata as Record<string, unknown>)
        : {};
    const fn = optionalScalarString(json.fn) ?? optionalScalarString(json.fiscalDriveNumber);
    const fd = optionalScalarString(json.fd) ?? optionalScalarString(json.fiscalDocumentNumber);
    const fp = optionalScalarString(json.fp) ?? optionalScalarString(json.fiscalSign);
    const sellerName = optionalString(json.user);
    const sellerInn = optionalString(json.userInn);
    const retailPlace = optionalString(json.retailPlace);
    const address = optionalString(metadata.address);

    const items = receiptItems.flatMap((itemValue, index) => {
      const item = asRecord(itemValue, `Receipt item ${index + 1}`);
      const name = optionalString(item.name) ?? "receipt";
      const quantity = optionalNumber(item.quantity) ?? 1;
      const price = optionalMoneyFromKopecks(item.price);
      const sum = optionalMoneyFromKopecks(item.sum) ?? (
        price !== undefined && Number.isFinite(quantity) && quantity > 0
          ? price * quantity
          : undefined
      );

      if (!Number.isFinite(quantity) || quantity <= 0 || sum === undefined || sum <= 0) {
        return [];
      }

      return {
        name,
        price: price ?? sum / quantity,
        quantity,
        sum,
      };
    });

    return {
      fiscal: {
        ...(fn ? { fn } : {}),
        ...(fd ? { fd } : {}),
        ...(fp ? { fp } : {}),
        dateTime,
        totalSum: moneyFromKopecks(json.totalSum, "totalSum"),
      },
      seller: {
        ...(sellerName ? { name: sellerName } : {}),
        ...(sellerInn ? { inn: sellerInn } : {}),
        ...(retailPlace ? { retailPlace } : {}),
        ...(address ? { address } : {}),
      },
      items,
    };
  }
}
