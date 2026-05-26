import { config } from "../config/env";
import { ProverkachekaClient } from "../infrastructure/receipt/proverkacheka.client";

async function main(): Promise<void> {
  const qrRaw = process.argv.slice(2).join(" ").trim();

  if (!qrRaw) {
    throw new Error("QR raw string argument is required.");
  }

  if (!config.proverkachekaToken) {
    throw new Error("PROVERKACHEKA_TOKEN is required to test receipt import.");
  }

  const client = new ProverkachekaClient(config.proverkachekaBaseUrl, config.proverkachekaToken);
  const result = await client.getCheckByQrRaw(qrRaw);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
