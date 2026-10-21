export type CopyAssistOperationalEvent = {
  requestId: string;
  providerId: string;
  modelId: string;
  promptVersion: string;
  sectionType: string;
  latencyMs: number;
  status: "ok" | "error";
  errorCode?: string;
  tokenUsage?: number;
  inputTokens?: number;
  outputTokens?: number;
};

export function emitCopyAssistLog(
  event: CopyAssistOperationalEvent,
  sink?: (event: CopyAssistOperationalEvent) => void,
) {
  sink?.(event);
}
