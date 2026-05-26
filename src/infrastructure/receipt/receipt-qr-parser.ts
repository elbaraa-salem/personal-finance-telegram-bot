export type ReceiptQrFields = {
  fn: string;
  fd: string;
  fp: string;
  t: string;
  s: string;
  n: string;
};

const requiredQrFields = ["fn", "i", "fp", "t", "s", "n"] as const;

export function parseReceiptQrRaw(qrRaw: string): ReceiptQrFields {
  const trimmedQrRaw = qrRaw.trim();

  if (!trimmedQrRaw) {
    throw new Error("Receipt QR raw string is empty.");
  }

  const params = new URLSearchParams(trimmedQrRaw);
  const missingFields = requiredQrFields.filter((field) => !params.get(field));

  if (missingFields.length > 0) {
    throw new Error(`Receipt QR raw string is missing required field(s): ${missingFields.join(", ")}.`);
  }

  return {
    fn: params.get("fn")!,
    fd: params.get("i")!,
    fp: params.get("fp")!,
    t: params.get("t")!,
    s: params.get("s")!,
    n: params.get("n")!,
  };
}
