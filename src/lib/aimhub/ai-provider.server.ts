// Independent AI layer: any OpenAI-compatible endpoint (OpenAI, OpenRouter,
// Groq, a self-hosted gateway...). The key is supplied by the app owner in
// Aymane AI settings and stored encrypted — never hardcoded here.

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface CompletionResult {
  content: string;
  toolCalls: ToolCall[];
}

export class AiProviderError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function chatCompletion(
  config: ProviderConfig,
  messages: ChatMessage[],
  tools?: ToolDefinition[],
): Promise<CompletionResult> {
  const base = config.baseUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new AiProviderError(res.status, text.slice(0, 600) || res.statusText);
  }

  let body: {
    choices?: Array<{
      message?: { content?: string | null; tool_calls?: ToolCall[] };
    }>;
  };
  try {
    body = JSON.parse(text);
  } catch {
    throw new AiProviderError(502, `رد غير صالح من مزود الذكاء: ${text.slice(0, 200)}`);
  }

  const message = body.choices?.[0]?.message;
  return {
    content: message?.content ?? "",
    toolCalls: message?.tool_calls ?? [],
  };
}
