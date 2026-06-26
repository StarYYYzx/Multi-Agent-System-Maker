/* 核心数据模型类型定义

  与后端 schemas.py 和设计文档第五部分保持一致。
*/

// === 节点类型 ===
export type NodeType = "start" | "agent" | "condition" | "parallel" | "merge" | "end";

// === 工作流蓝图 ===
export interface WorkflowBlueprint {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createTime: number;
}

// === 节点 ===
export interface WorkflowNode {
  nodeId: string;
  nodeType: NodeType;
  config: NodeConfig;
  position: { x: number; y: number };
}

export interface NodeConfig {
  taskDescription?: string;   // Agent节点：用户填写的任务
  branchRule?: string;        // 分支节点：自然语言判断条件
  templateId?: string;        // 匹配到的Prompt模板ID
}

// === 连线 ===
export interface WorkflowEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;       // 分支标识，如 "pass"、"reject"
  branchIndex?: number; // 分支数字索引
}

// === 节点间传递的数据报文 ===
export interface NodeMessage {
  sourceNodeId: string;
  rawContent: string;
  structuredData: Record<string, unknown>;
  timestamp: number;
}

// === Prompt 模板 ===
export interface PromptTemplate {
  templateId: string;
  sceneTag: string[];
  content: string;
  outputSchema: Record<string, unknown>;
}

// === 执行日志 ===
export interface ExecutionLog {
  logId: string;
  blueprintId: string;
  startTime: number;
  endTime: number;
  status: "success" | "failed" | "timeout";
  errorMessage?: string;
  nodeRecords: NodeRecord[];
}

export interface NodeRecord {
  nodeId: string;
  nodeType: string;
  input: unknown;
  prompt?: string;
  rawResponse?: string;
  structuredOutput?: unknown;
  startTime: number;
  endTime: number;
  durationMs: number;
  status: "pending" | "running" | "success" | "failed";
  error?: string;
}
