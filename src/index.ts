import { registerStartCommand } from "./bot/commands/start.command";
import { createBot } from "./bot/bot";
import { UserService } from "./application/services/user.service";
import { UserRepository } from "./infrastructure/repositories/user.repository";
import { connectToDatabase } from "./infrastructure/database/mongoose";
import { TransactionRepository } from "./infrastructure/repositories/transaction.repository";
import { TransactionService } from "./application/services/transaction.service";
import { registerTransactionCommands } from "./bot/commands/transaction.command";
import { registerReportCommand } from "./bot/commands/report.command";
import { ReportService } from "./application/services/report.service";
import { registerHistoryCommand } from "./bot/commands/history.command";
import { HistoryService } from "./application/services/history.service";
import { registerDeleteLastCommand } from "./bot/commands/delete-last.command";
import { registerHelpCommand } from "./bot/commands/help.command";
import { registerMenuCommandHandlers } from "./bot/commands/menu.command";
import { registerTransactionFlowCommand } from "./bot/commands/transaction-flow.command";
import { registerLanguageCommand } from "./bot/commands/language.command";
import { registerCurrencyCommand } from "./bot/commands/currency.command";
import { registerReceiptImportCommand } from "./bot/commands/receipt-import.command";
import { GeminiReceiptExtractor } from "./infrastructure/ai/receipt-extractor";
import { config } from "./config/env";
import { AiTransactionParserService } from "./application/services/ai-transaction-parser.service";
import { ReceiptImportRepository } from "./infrastructure/repositories/receipt-import.repository";
import { ProverkachekaClient } from "./infrastructure/receipt/proverkacheka.client";
import { ReceiptNormalizerService } from "./application/services/receipt-normalizer.service";
import { AiReceiptParserService } from "./application/services/ai-receipt-parser.service";
import { ReceiptImportService } from "./application/services/receipt-import.service";

async function main(): Promise<void> {
  await connectToDatabase();

  const bot = createBot();

  const userRepository = new UserRepository();
  const userService = new UserService(userRepository);

  const transactionRepository = new TransactionRepository();
  const transactionService = new TransactionService(
    transactionRepository,
    userRepository
  );

  const reportService = new ReportService(
    transactionRepository,
    userRepository
  );

  const historyService = new HistoryService(
    transactionRepository,
    userRepository
  );

  const receiptExtractor = config.geminiApiKey
    ? new GeminiReceiptExtractor(config.geminiApiKey, config.geminiModel)
    : null;
  const aiTransactionParser = new AiTransactionParserService();
  const receiptImportRepository = new ReceiptImportRepository();
  const proverkachekaClient =
    config.receiptProvider === "proverkacheka" && config.proverkachekaToken
      ? new ProverkachekaClient(
          config.proverkachekaBaseUrl,
          config.proverkachekaToken
        )
      : null;
  const receiptImportService = new ReceiptImportService(
    userRepository,
    receiptImportRepository,
    transactionService,
    proverkachekaClient,
    new ReceiptNormalizerService(),
    new AiReceiptParserService()
  );

  registerStartCommand(bot, userService);
  registerLanguageCommand(bot, userService);
  registerCurrencyCommand(bot, userService);
  registerTransactionFlowCommand(
    bot,
    transactionService,
    userService,
    aiTransactionParser,
    receiptImportService
  );
  registerReceiptImportCommand(
    bot,
    receiptExtractor,
    transactionService,
    userService
  );
  
  registerHelpCommand(bot, userService);
  registerTransactionCommands(bot, transactionService, userService);
  registerReportCommand(bot, reportService, userService);
  registerHistoryCommand(bot, historyService, userService);
  registerDeleteLastCommand(
    bot,
    transactionService,
    userService,
    receiptImportRepository
  );
  registerMenuCommandHandlers(
    bot,
    reportService,
    historyService,
    userService
  );

  bot.start({
    onStart: () => {
      console.log("🤖 Bot is running...");
    },
  });
}

main().catch((error) => {
  console.error("❌ Application failed to start:", error);
  process.exit(1);
});
