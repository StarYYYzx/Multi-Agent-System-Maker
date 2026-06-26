/* 后端 API 封装 */

const API_BASE = ""; // 开发环境通过 Vite proxy 转发到 http://127.0.0.1:8000

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "请求失败");
  }
  return res.json();
}

// === Config ===
export const api = {
  // API Key
  setApiKey: (apiKey: string) =>
    request<unknown>("/api/config/key", { method: "POST", body: JSON.stringify({ api_key: apiKey }) }),
  checkApiKey: () => request<{ configured: boolean; message: string }>("/api/config/key"),
  deleteApiKey: () => request<unknown>("/api/config/key", { method: "DELETE" }),

  // LLM
  chat: (messages: Array<{ role: string; content: string }>, temp = 0.7, maxTokens = 4096, signal?: AbortSignal) =>
    request<{ content: string; model: string; usage: object }>("/api/llm/chat", {
      method: "POST",
      body: JSON.stringify({ messages, temperature: temp, max_tokens: maxTokens }),
      signal,
    }),

  // Prompt
  generatePrompt: (taskDescription: string, forceTemplate?: string, signal?: AbortSignal) =>
    request<{
      system_prompt: string;
      user_prompt: string;
      template_id: string | null;
      output_schema: Record<string, unknown>;
    }>("/api/prompt/generate", {
      method: "POST",
      body: JSON.stringify({ task_description: taskDescription, force_template: forceTemplate }),
      signal,
    }),

  // Health
  health: () => request<{ status: string }>("/api/health"),

  // Workflow
  analyzeWorkflow: (blueprint: {
    id: string;
    name: string;
    nodes: unknown[];
    edges: unknown[];
  }) =>
    request<{ node_configs: Array<{ nodeId: string; taskDescription: string }>; summary: string }>(
      "/api/workflow/analyze",
      { method: "POST", body: JSON.stringify(blueprint) }
    ),
};
