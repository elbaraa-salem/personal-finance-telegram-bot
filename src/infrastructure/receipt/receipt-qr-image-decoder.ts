import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import jsQR from "jsqr";
import sharp, { Sharp } from "sharp";
import { config } from "../../config/env";
import { parseReceiptQrRaw } from "./receipt-qr-parser";

const execFileAsync = promisify(execFile);
const zbarTimeoutMs = 10_000;

type SharpVariant = {
  name: string;
  image: Sharp;
};

type ReceiptQrDecodeResult = {
  rawText: string;
  decoder: string;
  variant?: string;
};

function debugLog(message: string, details?: unknown): void {
  if (!config.qrDebug) {
    return;
  }

  if (details === undefined) {
    console.info(message);
    return;
  }

  console.info(message, details);
}

async function decodeSharpVariant(variant: SharpVariant): Promise<string | null> {
  const { data, info } = await variant.image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);

  return code?.data?.trim() || null;
}

function validateReceiptQrRaw(qrRaw: string): string | null {
  const requiredMarkers = ["t=", "s=", "fn=", "i=", "fp=", "n="];
  const matchedMarkers = requiredMarkers.filter((marker) => qrRaw.includes(marker));

  if (matchedMarkers.length < 5) {
    return null;
  }

  try {
    parseReceiptQrRaw(qrRaw);
  } catch {
    return null;
  }

  return qrRaw;
}

function createVariants(imageBuffer: Buffer): SharpVariant[] {
  const rotatedImage = sharp(imageBuffer).rotate();
  const resizedImage = rotatedImage.clone().resize({
    width: 1800,
    height: 1800,
    fit: "inside",
    withoutEnlargement: false,
  });
  const largeImage = rotatedImage.clone().resize({
    width: 2600,
    height: 2600,
    fit: "inside",
    withoutEnlargement: false,
  });

  return [
    {
      name: "jsQR-original",
      image: sharp(imageBuffer),
    },
    {
      name: "jsQR-rotate",
      image: rotatedImage.clone(),
    },
    {
      name: "jsQR-resize",
      image: resizedImage.clone(),
    },
    {
      name: "jsQR-grayscale",
      image: resizedImage.clone().grayscale(),
    },
    {
      name: "jsQR-normalize",
      image: resizedImage.clone().grayscale().normalize(),
    },
    {
      name: "jsQR-normalize-sharpen",
      image: resizedImage.clone().grayscale().normalize().sharpen(),
    },
    {
      name: "jsQR-threshold-120",
      image: resizedImage.clone().grayscale().normalize().threshold(120),
    },
    {
      name: "jsQR-threshold-150",
      image: resizedImage.clone().grayscale().normalize().threshold(150),
    },
    {
      name: "jsQR-threshold-180",
      image: resizedImage.clone().grayscale().normalize().threshold(180),
    },
    {
      name: "jsQR-border-normalize",
      image: resizedImage
        .clone()
        .grayscale()
        .normalize()
        .extend({ top: 80, bottom: 80, left: 80, right: 80, background: "white" }),
    },
    {
      name: "jsQR-border-threshold-150",
      image: largeImage
        .clone()
        .grayscale()
        .normalize()
        .threshold(150)
        .extend({ top: 120, bottom: 120, left: 120, right: 120, background: "white" }),
    },
  ];
}

async function decodeWithJsQr(imageBuffer: Buffer): Promise<ReceiptQrDecodeResult | null> {
  const attemptedVariants: string[] = [];

  for (const variant of createVariants(imageBuffer)) {
    attemptedVariants.push(variant.name);

    try {
      const decodedText = await decodeSharpVariant(variant);
      const validText = decodedText ? validateReceiptQrRaw(decodedText) : null;

      if (validText) {
        console.info(`Receipt QR decoded with ${variant.name}`);
        return {
          rawText: validText,
          decoder: "jsQR",
          variant: variant.name,
        };
      }

      if (decodedText) {
        debugLog(`Receipt QR ${variant.name} decoded unrelated text.`);
      }
    } catch (error) {
      debugLog(`Receipt QR ${variant.name} failed.`, error);
    }
  }

  debugLog("Receipt QR jsQR variants failed.", attemptedVariants);
  return null;
}

async function decodeWithZbarimg(imageBuffer: Buffer): Promise<ReceiptQrDecodeResult | null> {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "receipt-qr-"));
  const imagePath = path.join(tempDirectory, "qr-image");

  try {
    await writeFile(imagePath, imageBuffer);

    const { stdout } = await execFileAsync("zbarimg", ["--raw", imagePath], {
      timeout: zbarTimeoutMs,
      maxBuffer: 1024 * 1024,
    });
    const decodedText = stdout.trim().split("\n").find(Boolean)?.trim();
    const validText = decodedText ? validateReceiptQrRaw(decodedText) : null;

    if (!validText) {
      debugLog("Receipt QR zbarimg returned no valid receipt QR text.", decodedText);
      return null;
    }

    console.info("Receipt QR decoded with zbarimg");
    return {
      rawText: validText,
      decoder: "zbarimg",
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      console.warn("zbarimg is not installed; skipping receipt QR fallback decoder.");
      return null;
    }

    debugLog("Receipt QR zbarimg fallback failed.", error);
    return null;
  } finally {
    await rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function decodeReceiptQrFromImageBuffer(
  imageBuffer: Buffer,
  options: {
    mimeType?: string;
  } = {}
): Promise<string> {
  const metadata = await sharp(imageBuffer).metadata().catch(() => null);

  debugLog("Receipt QR image decode input.", {
    bytes: imageBuffer.length,
    mimeType: options.mimeType,
    width: metadata?.width,
    height: metadata?.height,
    format: metadata?.format,
    orientation: metadata?.orientation,
  });

  const jsQrResult = await decodeWithJsQr(imageBuffer);

  if (jsQrResult) {
    debugLog("Receipt QR decode succeeded.", jsQrResult);
    return jsQrResult.rawText;
  }

  const zbarResult = await decodeWithZbarimg(imageBuffer);

  if (zbarResult) {
    debugLog("Receipt QR decode succeeded.", zbarResult);
    return zbarResult.rawText;
  }

  console.error("Receipt QR decode failed after all variants.", {
    attemptedVariants: createVariants(imageBuffer).map((variant) => variant.name).concat("zbarimg"),
    bytes: imageBuffer.length,
    mimeType: options.mimeType,
    width: metadata?.width,
    height: metadata?.height,
    format: metadata?.format,
  });
  throw new Error("Could not detect a supported receipt QR code in image.");
}
