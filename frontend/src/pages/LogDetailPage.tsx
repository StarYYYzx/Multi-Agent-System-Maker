/* 日志详情页 */

import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getLog } from "../services/storage";
import type { ExecutionLog, NodeRecord } from "../engine/types";
import { NODE_STYLES } from "../components/canvas/nodes/nodeStyles";
import type { NodeType } from "../engine/types";

function nodeLabel(type: NodeType): string {
  return NODE_STYLES[type]?.label || type;
}

export default function LogDetailPage() {
  const { logId } = useParams<{ logId: string }>();
  const navigate = useNavigate();

  const [log, setLog] = useState<ExecutionLog | null>(null);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (logId) {
      const found = getLog(logId) as ExecutionLog | undefined;
      setLog(found || null);
      setLoading(false);
    }
  }, [logId]);

  if (loading) {
    return <div style={{ padding: 40 }}>加载中...</div>;
  }

  if (!log) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 40 }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", marginBottom: 20 }}>
          ← 返回
        </button>
        <div style={{ textAlign: "center", color: "#999", padding: 40 }}>
          <h2>日志未找到</h2>
          <p style={{ marginTop: 8 }}>该日志可能已被清除或 ID 无效</p>
        </div>
      </div>
    );
  }

  const totalDuration = log.endTime - log.startTime;
  const successCount = log.nodeRecords.filter((r) => r.status === "success").length;
  const failCount = log.nodeRecords.filter((r) => r.status === "failed").length;
  const statusColor = log.status === "success" ? "#52c41a" : log.status === "timeout" ? "#fa8c16" : "#ff4d4f";
  const statusLabel = log.status === "success" ? "成功" : log.status === "timeout" ? "超时" : "失败";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 40 }}>
      {/* 返回 + 标题 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#333" }}>
          ← 返回首页
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>执行日志</h1>
      </div>

      {/* 全局摘要 */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e0e0e0",
          borderRadius: 10,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>日志 ID</div>
            <div style={{ fontFamily: "monospace", fontSize: 13 }}>{log.logId}</div>
          </div>
          <span
            style={{
              padding: "4px 16px",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: statusColor,
            }}
          >
            {statusLabel}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16 }}>
          <StatBox label="开始时间" value={new Date(log.startTime).toLocaleString()} />
          <StatBox label="结束时间" value={new Date(log.endTime).toLocaleString()} />
          <StatBox label="总耗时" value={`${(totalDuration / 1000).toFixed(2)} 秒`} />
          <StatBox label="蓝图 ID" value={log.blueprintId} />
          <StatBox label="节点数" value={`${log.nodeRecords.length}（成功 ${successCount} / 失败 ${failCount}）`} />
          <StatBox label="状态" value={statusLabel} color={statusColor} />
        </div>

        {log.errorMessage && (
          <div style={{ marginTop: 16, background: "#fff2f0", border: "1px solid #ffccc7", borderRadius: 6, padding: 12, color: "#ff4d4f", fontSize: 13 }}>
            <strong>错误：</strong> {log.errorMessage}
          </div>
        )}
      </div>

      {/* 节点执行时间线 */}
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>节点执行记录</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {log.nodeRecords.map((record, idx) => (
          <NodeRecordCard
            key={record.nodeId}
            record={record}
            isExpanded={expandedNodeId === record.nodeId}
            onToggle={() => setExpandedNodeId(expandedNodeId === record.nodeId ? null : record.nodeId)}
            index={idx + 1}
          />
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#999", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: color || "#333" }}>{value}</div>
    </div>
  );
}

function NodeRecordCard({
  record,
  isExpanded,
  onToggle,
  index,
}: {
  record: NodeRecord;
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
        border:
          record.status === "failed"
            ? "1px solid #ffccc7"
            : "1px solid #e0e0e0",
        overflow: "hidden",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          cursor: "pointer",
          background: record.status === "failed" ? "#fff2f0" : "transparent",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: style.bgColor,
              color: style.color,
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {index}
          </span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{nodeLabel(record.nodeType as NodeType)}</span>
          <span style={{ fontSize: 10, color: "#999", fontFamily: "monospace" }}>
            {record.nodeId.slice(0, 10)}...
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#999" }}>{record.durationMs}ms</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: record.status === "success" ? "#52c41a" : record.status === "failed" ? "#ff4d4f" : "#999",
            }}
          >
            {record.status === "success" ? "成功" : record.status === "failed" ? "失败" : record.status}
          </span>
          <span style={{ fontSize: 10, color: "#999" }}>{isExpanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {isExpanded && (
        <div style={{ padding: "0 14px 14px", borderTop: "1px solid #f0f0f0" }}>
          <LogField label="入参" value={safeStr(record.input)} />
          {record.prompt && <LogField label="实际 Prompt" value={record.prompt} />}
          {record.rawResponse && <LogField label="LLM 原始返回" value={record.rawResponse} />}
          {record.structuredOutput !== undefined && (
            <LogField label="结构化输出" value={safeStr(record.structuredOutput)} />
          )}
          {record.error && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: "#ff4d4f", marginBottom: 2 }}>错误</div>
              <div style={{ fontSize: 12, color: "#ff4d4f", background: "#fff1f0", padding: 8, borderRadius: 4 }}>
                {record.error}
              </div>
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 11, color: "#999" }}>
            开始: {new Date(record.startTime).toLocaleTimeString()} · 结束:{" "}
            {new Date(record.endTime).toLocaleTimeString()} · 耗时: {record.durationMs}ms
          </div>
        </div>
      )}
    </div>
  );
}

function LogField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: "#999", marginBottom: 2 }}>{label}</div>
      <div
        style={{
          fontSize: 12,
          background: "#f9f9f9",
          padding: "6px 8px",
          borderRadius: 4,
          maxHeight: 140,
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

function safeStr(obj: unknown): string {
  if (typeof obj === "string") return obj;
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}
