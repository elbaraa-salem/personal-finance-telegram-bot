import jsQR from "jsqr";
import sharp, { Sharp } from "sharp";
import { parseReceiptQrRaw } from "./receipt-qr-parser";

type SharpVariant = {
  name: string;
  image: Sharp;
};

async function decodeSharpVariant(variant: SharpVariant): Promise<string | null> {
  const { data, info } = await variant.image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);

  return code?.data ?? null;
}

function validateReceiptQrRaw(qrRaw: string): string {
  try {
    parseReceiptQrRaw(qrRaw);
  } catch {
    throw new Error("Decoded QR code is not a supported receipt QR.");
  }

  return qrRaw;
}

export async function decodeReceiptQrFromImageBuffer(imageBuffer: Buffer): Promise<string> {
  const baseImage = sharp(imageBuffer).rotate().resize({
    width: 1600,
    height: 1600,
    fit: "inside",
    withoutEnlargement: true,
  });
  const variants: SharpVariant[] = [
    {
      name: "normalized",
      image: baseImage.clone(),
    },
    {
      name: "grayscale-threshold",
      image: baseImage.clone().grayscale().threshold(150),
    },
    {
      name: "normalize-sharpen",
      image: baseImage.clone().normalize().sharpen(),
    },
    {
      name: "larger-normalized",
      image: sharp(imageBuffer).rotate().resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      }),
    },
  ];

  for (const variant of variants) {
    const decodedText = await decodeSharpVariant(variant);

    if (decodedText) {
      return validateReceiptQrRaw(decodedText.trim());
    }
  }

  throw new Error("Could not detect QR code in image.");
}
