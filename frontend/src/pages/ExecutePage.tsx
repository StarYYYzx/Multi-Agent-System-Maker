/* 流程执行页 - 运行时可视化 */

import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { useBlueprintStore } from "../store/blueprintStore";
import { runWorkflow } from "../engine/scheduler";
import { validateTopology } from "../engine/topology";
import { saveLog } from "../services/storage";
import type { NodeRecord, ExecutionLog } from "../engine/types";
import { NODE_STYLES } from "../components/canvas/nodes/nodeStyles";
import type { NodeType } from "../engine/types";

type RunStatus = "idle" | "input" | "running" | "done" | "error";

function nodeLabel(type: NodeType): string {
  return NODE_STYLES[type]?.label || type;
}

export default function ExecutePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const loadBlueprint = useBlueprintStore((s) => s.loadBlueprint);
  const current = useBlueprintStore((s) => s.current);

  const [status, setStatus] = useState<RunStatus>("idle");
  const [userInput, setUserInput] = useState("");
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [nodeRecords, setNodeRecords] = useState<NodeRecord[]>([]);
  const [flowLog, setFlowLog] = useState<ExecutionLog | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  // 加载蓝图
  useEffect(() => {
    if (id && id !== current.id) {
      const ok = loadBlueprint(id);
      if (!ok) navigate("/");
    }
  }, [id]);

  // 开始运行
  const handleStart = useCallback(async () => {
    // 拓扑校验
    const errors = validateTopology(current);
    if (errors.length > 0) {
      setErrorMsg(errors.join("\n"));
      setStatus("error");
      return;
    }

    if (!userInput.trim()) return;

    setStatus("running");
    setNodeRecords([]);
    setActiveNodeId(null);
    setErrorMsg("");

    const log = await runWorkflow(current, userInput, {
      onNodeStart: (nodeId) => setActiveNodeId(nodeId),
      onNodeComplete: (record) => {
        setNodeRecords((prev) => [...prev, record]);
      },
      onFlowComplete: (log) => {
        setFlowLog(log);
        saveLog(log);
        setStatus("done");
      },
      onError: (err) => {
        setErrorMsg(err);
        setStatus("error");
      },
    });

    if (log.status !== "success") {
      setFlowLog(log);
    }
  }, [current, userInput]);

  if (!id || current.id !== id) {
    return <div style={{ padding: 40 }}>加载中...</div>;
  }

  const totalDuration = flowLog ? flowLog.endTime - flowLog.startTime : 0;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f5f6fa" }}>
      {/* 顶部栏 */}
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          background: "#fff",
          borderBottom: "1px solid #e0e0e0",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate(`/editor/${id}`)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer" }}>
            ← 返回编辑
          </button>
          <span style={{ fontWeight: 600, fontSize: 16 }}>运行: {current.name}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusBadge status={status} />
          {flowLog && (
            <button
              onClick={() => navigate(`/logs/${flowLog.logId}`)}
              style={{ padding: "4px 12px", border: "1px solid #4a6cf7", color: "#4a6cf7", background: "#fff", borderRadius: 4, fontSize: 13, cursor: "pointer" }}
            >
              查看日志
            </button>
          )}
        </div>
      </div>

      {/* 主体 */}
      <div style={{ flex: 1, overflow: "auto", padding: 20, maxWidth: 900, margin: "0 auto", width: "100%" }}>
        {/* 输入区域 */}
        {status === "idle" && (
          <div style={{ background: "#fff", borderRadius: 8, padding: 24, border: "1px solid #e0e0e0" }}>
            <h3 style={{ marginBottom: 12 }}>请输入初始文本</h3>
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="在此输入你要发送给工作流的初始内容..."
              rows={5}
              style={{ width: "100%", padding: 10, border: "1px solid #d9d9d9", borderRadius: 6, fontSize: 14, resize: "vertical" }}
            />
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button
                onClick={handleStart}
                disabled={!userInput.trim()}
                style={{
                  padding: "8px 24px",
                  background: userInput.trim() ? "#52c41a" : "#d9d9d9",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  cursor: userInput.trim() ? "pointer" : "not-allowed",
                }}
              >
                开始运行
              </button>
            </div>
          </div>
        )}

        {/* 运行中 / 已完成 */}
        {(status === "running" || status === "done" || status === "error") && (
          <>
            {/* 用户输入摘要 */}
            <div style={{ background: "#fff", borderRadius: 8, padding: 16, border: "1px solid #e0e0e0", marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>用户输入</div>
              <div style={{ fontSize: 14 }}>{userInput}</div>
            </div>

            {/* 节点记录 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {nodeRecords.map((record, idx) => (
                <NodeCard
                  key={record.nodeId}
                  record={record}
                  isActive={record.nodeId === activeNodeId}
                  isExpanded={expandedNodeId === record.nodeId}
                  onToggle={() => setExpandedNodeId(expandedNodeId === record.nodeId ? null : record.nodeId)}
                  index={idx + 1}
                />
              ))}

              {/* 运行中占位 */}
              {status === "running" && nodeRecords.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
                  正在运行...
                </div>
              )}
            </div>

            {/* 错误信息 */}
            {errorMsg && (
              <div style={{ marginTop: 16, background: "#fff2f0", border: "1px solid #ffccc7", borderRadius: 8, padding: 16, color: "#ff4d4f" }}>
                <strong>执行失败：</strong>
                <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, fontSize: 13 }}>{errorMsg}</pre>
              </div>
            )}

            {/* 完成摘要 */}
            {status === "done" && flowLog && (
              <div style={{ marginTop: 16, background: "#f6ffed", border: "1px solid #b7eb8f", borderRadius: 8, padding: 16 }}>
                <div style={{ fontWeight: 600, color: "#52c41a", marginBottom: 8 }}>执行完成</div>
                <div style={{ fontSize: 13, color: "#666" }}>
                  总耗时: {(totalDuration / 1000).toFixed(2)}秒 · 节点数: {nodeRecords.length} · 
                  成功: {nodeRecords.filter((r) => r.status === "success").length} · 
                  失败: {nodeRecords.filter((r) => r.status === "failed").length}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============ 子组件 ============

function StatusBadge({ status }: { status: RunStatus }) {
  const config: Record<RunStatus, { label: string; color: string; bg: string }> = {
    idle: { label: "待输入", color: "#666", bg: "#f5f5f5" },
    input: { label: "输入中", color: "#666", bg: "#f5f5f5" },
    running: { label: "运行中...", color: "#1677ff", bg: "#e6f4ff" },
    done: { label: "已完成", color: "#52c41a", bg: "#f6ffed" },
    error: { label: "失败", color: "#ff4d4f", bg: "#fff2f0" },
  };
  const c = config[status];
  return (
    <span style={{ padding: "2px 10px", borderRadius: 4, fontSize: 12, fontWeight: 500, color: c.color, background: c.bg }}>
      {c.label}
    </span>
  );
}

function NodeCard({
  record,
  isActive,
  isExpanded,
  onToggle,
  index,
}: {
  record: NodeRecord;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
}) {
  const style = NODE_STYLES[record.nodeType as NodeType] || NODE_STYLES.agent;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        border: isActive ? `2px solid #4a6cf7` : "1px solid #e0e0e0",
        overflow: "hidden",
        transition: "border-color 0.3s",
      }}
    >
      {/* 头部 */}
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          cursor: "pointer",
          background: isActive ? "#f0f5ff" : "transparent",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: style.bgColor,
              color: style.color,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {index}
          </span>
          <span style={{ fontSize: 10, color: "#999", background: "#f5f5f5", padding: "1px 6px", borderRadius: 3 }}>
            {record.nodeId.slice(0, 10)}
          </span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{nodeLabel(record.nodeType as NodeType)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#999" }}>{record.durationMs}ms</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: record.status === "success" ? "#52c41a" : "#ff4d4f",
            }}
          >
            {record.status === "success" ? "成功" : "失败"}
          </span>
          <span style={{ color: "#999" }}>{isExpanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid #f0f0f0" }}>
          <Field label="输入" value={safeStringify(record.input)} />
          {record.prompt && <Field label="Prompt" value={record.prompt} />}
          {record.rawResponse && <Field label="LLM 原始返回" value={record.rawResponse} />}
          {record.structuredOutput !== undefined && (
            <Field label="结构化输出" value={safeStringify(record.structuredOutput)} />
          )}
          {record.error && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: "#ff4d4f", marginBottom: 2 }}>错误信息</div>
              <div style={{ fontSize: 12, color: "#ff4d4f", background: "#fff2f0", padding: 8, borderRadius: 4 }}>
                {record.error}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 12,
          background: "#f9f9f9",
          padding: "8px 10px",
          borderRadius: 4,
          maxHeight: 160,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          fontFamily: "monospace",
          lineHeight: 1.5,
          border: "1px solid #eee",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function safeStringify(obj: unknown): string {
  if (typeof obj === "string") return obj;
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}
