/* 蓝图列表页（首页） */
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useBlueprintStore } from "../store/blueprintStore";
import { deleteBlueprint, loadLogs } from "../services/storage";
import type { ExecutionLog } from "../engine/types";

export default function BlueprintListPage() {
  const navigate = useNavigate();
  const list = useBlueprintStore((s) => s.list);
  const refreshList = useBlueprintStore((s) => s.refreshList);
  const newBlueprint = useBlueprintStore((s) => s.newBlueprint);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);

  useEffect(() => {
    setLogs(loadLogs() as ExecutionLog[]);
  }, []);

  const handleCreate = () => {
    newBlueprint();
    const bp = useBlueprintStore.getState().current;
    navigate(`/editor/${bp.id}`);
  };

  const handleDelete = (id: string) => {
    deleteBlueprint(id);
    refreshList();
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1>我的工作流</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => navigate("/settings")}
            style={{
              padding: "8px 16px",
              background: "#fff",
              color: "#666",
              border: "1px solid #d9d9d9",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
            }}
            title="配置 API Key"
          >
            ⚙ 设置
          </button>
          <button
            onClick={handleCreate}
            style={{
              padding: "8px 20px",
              background: "#4a6cf7",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            + 新建蓝图
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#999" }}>
          <p>暂无保存的蓝图</p>
          <p style={{ marginTop: 8, fontSize: 13 }}>点击「新建蓝图」开始创建你的第一个多Agent工作流</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((bp) => (
            <div
              key={bp.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                background: "#fff",
                borderRadius: 8,
                border: "1px solid #e0e0e0",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{bp.name}</div>
                <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                  {bp.nodes.length} 个节点 · {new Date(bp.createTime).toLocaleString()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => navigate(`/editor/${bp.id}`)}
                  style={{ padding: "4px 12px", border: "1px solid #4a6cf7", color: "#4a6cf7", background: "#fff", borderRadius: 4 }}
                >
                  编辑
                </button>
                <button
                  onClick={() => navigate(`/execute/${bp.id}`)}
                  style={{ padding: "4px 12px", border: "1px solid #52c41a", color: "#52c41a", background: "#fff", borderRadius: 4 }}
                >
                  运行
                </button>
                <button
                  onClick={() => handleDelete(bp.id)}
                  style={{ padding: "4px 12px", border: "1px solid #ff4d4f", color: "#ff4d4f", background: "#fff", borderRadius: 4 }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 执行日志历史 */}
      {logs.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>执行历史</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {logs.slice(0, 10).map((log) => (
              <div
                key={log.logId}
                onClick={() => navigate(`/logs/${log.logId}`)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 16px",
                  background: "#fff",
                  borderRadius: 6,
                  border: "1px solid #e0e0e0",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: log.status === "success" ? "#52c41a" : log.status === "timeout" ? "#fa8c16" : "#ff4d4f",
                    }}
                  />
                  <span style={{ fontSize: 13, fontFamily: "monospace" }}>{log.logId}</span>
                </div>
                <div style={{ fontSize: 12, color: "#999" }}>
                  {new Date(log.startTime).toLocaleString()} · {log.nodeRecords.length} 节点
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
