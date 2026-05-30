import { BotContext, ActiveFlowType } from "../context";

function createFlowId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function cancelTextFlows(ctx: BotContext): void {
  ctx.session.pendingCustomReport = null;
  ctx.session.pendingTransaction = null;
  ctx.session.pendingCurrencyInput = false;
}

export function clearActiveFlow(ctx: BotContext): void {
  ctx.session.activeFlow = null;
  ctx.session.pendingCustomReport = null;
  ctx.session.pendingTransactionConfirmation = null;
  ctx.session.pendingTransaction = null;
  ctx.session.pendingCurrencyInput = false;
}

export function startFlow(ctx: BotContext, type: ActiveFlowType): string {
  cancelTextFlows(ctx);
  const id = createFlowId();

  ctx.session.activeFlow = {
    id,
    type,
    createdAt: Date.now(),
  };

  return id;
}

export function isActiveFlow(
  ctx: BotContext,
  type: ActiveFlowType,
  flowId: string | undefined
): boolean {
  return Boolean(
    flowId &&
    ctx.session.activeFlow &&
    ctx.session.activeFlow.type === type &&
    ctx.session.activeFlow.id === flowId
  );
}

export async function answerStaleCallback(ctx: BotContext, text: string): Promise<void> {
  await ctx.answerCallbackQuery({
    text,
    show_alert: false,
  }).catch(() => undefined);
}

export function rememberInteractiveMessage(ctx: BotContext, messageId: number): void {
  const chatId = ctx.chat?.id;

  if (!chatId) {
    return;
  }

  ctx.session.lastInteractiveMessage = {
    chatId,
    messageId,
  };
}
