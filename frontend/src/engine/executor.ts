/* 节点执行器

  对每种节点类型执行具体逻辑，调用后端 API。
  返回 NodeRecord 用于日志记录。
*/

import type { WorkflowNode, NodeMessage, NodeRecord } from "./types";
import { api } from "../services/api";

/** 单节点执行总超时（毫秒），从总执行时限中分配 */
const DEFAULT_NODE_TIMEOUT = 60000;

/**
 * 执行单个节点
 *
 * @param node     工作流节点定义
 * @param input    上游传入的标准化报文（开始节点时为用户输入）
 * @param timeoutMs 本节点允许的最大执行时间
 * @returns NodeRecord 执行记录
 */
export async function executeNode(
  node: WorkflowNode,
  input: NodeMessage,
  timeoutMs: number = DEFAULT_NODE_TIMEOUT,
): Promise<NodeRecord> {
  const record: NodeRecord = {
    nodeId: node.nodeId,
    nodeType: node.nodeType,
    input,
    startTime: Date.now(),
    endTime: 0,
    durationMs: 0,
    status: "running",
  };

  try {
    const result = await executeWithTimeout(node, input, timeoutMs);
    record.status = "success";
    record.prompt = result.prompt;
    record.rawResponse = result.rawResponse;
    record.structuredOutput = result.output;
  } catch (e: any) {
    record.status = "failed";
    record.error = e.message || String(e);
  }

  record.endTime = Date.now();
  record.durationMs = record.endTime - record.startTime;
  return record;
}

/** 将 NodeRecord 的 output 包装为 NodeMessage */
export function recordToMessage(record: NodeRecord, nodeId: string): NodeMessage {
  return {
    sourceNodeId: nodeId,
    rawContent: record.rawResponse || "",
    structuredData: (record.structuredOutput as Record<string, unknown>) || {},
    timestamp: Date.now(),
  };
}

// ============ 内部实现 ============

interface ExecuteResult {
  prompt?: string;
  rawResponse?: string;
  output: unknown;
}

async function executeWithTimeout(
  node: WorkflowNode,
  input: NodeMessage,
  timeoutMs: number,
): Promise<ExecuteResult> {
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    switch (node.nodeType) {
      case "start":
        return executeStart(node, input);
      case "agent":
        return await executeAgent(node, input);
      case "condition":
        return await executeCondition(node, input);
      case "parallel":
        return executeParallel(node, input);
      case "merge":
        return executeMerge(node, input);
      case "end":
        return executeEnd(node, input);
      default:
        throw new Error(`未知节点类型: ${node.nodeType}`);
    }
  } finally {
    clearTimeout(timer);
    abortController.abort(); // 清理
  }
}

function executeStart(_node: WorkflowNode, input: NodeMessage): ExecuteResult {
  // 开始节点：透传用户输入，标记为结构化数据
  return {
    rawResponse: input.rawContent,
    output: {
      userInput: input.rawContent,
      timestamp: input.timestamp,
    },
  };
}

async function executeAgent(node: WorkflowNode, input: NodeMessage): Promise<ExecuteResult> {
  const taskDesc = node.config.taskDescription || input.rawContent;

  // Step 1: 生成 Prompt
  let systemPrompt = "You are a helpful assistant.";
  let userPrompt = taskDesc;

  try {
    const promptResult = await api.generatePrompt(taskDesc);
    systemPrompt = promptResult.system_prompt;
    userPrompt = promptResult.user_prompt;
  } catch {
    // Prompt 生成失败降级：直接使用原始任务描述
  }

  // Step 2: 调用 LLM
  const combinedPrompt = `System: ${systemPrompt}\nUser: ${userPrompt}`;

  const chatResult = await api.chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  // Step 3: 尝试解析 JSON 输出
  let output: unknown = { result: chatResult.content };
  try {
    const jsonMatch = chatResult.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      output = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // JSON 解析失败，使用原始文本
  }

  return {
    prompt: combinedPrompt,
    rawResponse: chatResult.content,
    output,
  };
}

async function executeCondition(node: WorkflowNode, input: NodeMessage): Promise<ExecuteResult> {
  const branchRule = node.config.branchRule || "判断输入内容是否合格";
  const content = typeof input.structuredData === "object"
    ? JSON.stringify(input.structuredData)
    : input.rawContent;

  const conditionPrompt = `根据以下规则判断分支结果：\n"${branchRule}"\n\n输入内容：\n${content}\n\n请只输出一个单词：pass（通过）或 reject（不通过），不要输出其他内容。`;

  let decision = "pass";
  try {
    const result = await api.chat([{ role: "user", content: conditionPrompt }], 0.1);
    const cleaned = result.content.trim().toLowerCase();
    if (cleaned.includes("reject")) {
      decision = "reject";
    } else {
      decision = "pass";
    }
  } catch {
    decision = "pass"; // 降级：默认通过
  }

  return {
    prompt: conditionPrompt,
    rawResponse: decision,
    output: { branch: decision },
  };
}

function executeParallel(_node: WorkflowNode, input: NodeMessage): ExecuteResult {
  // 并行分支节点：透传上游数据
  return {
    rawResponse: input.rawContent,
    output: input.structuredData,
  };
}

function executeMerge(_node: WorkflowNode, input: NodeMessage): ExecuteResult {
  // 汇总节点：纯 JSON 数组拼接
  // scheduler 会传入一个包装后的 input，包含所有分支结果
  return {
    rawResponse: JSON.stringify(input.structuredData),
    output: input.structuredData,
  };
}

function executeEnd(_node: WorkflowNode, input: NodeMessage): ExecuteResult {
  // 结束节点：透传最终结果
  return {
    rawResponse: input.rawContent,
    output: input.structuredData,
  };
}
