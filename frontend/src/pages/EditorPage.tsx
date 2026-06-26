/* 画布编辑页 */
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useCallback, useState } from "react";
import { useBlueprintStore } from "../store/blueprintStore";
import CanvasEditor from "../components/canvas/CanvasEditor";
import { NODE_STYLES } from "../components/canvas/nodes/nodeStyles";
import type { NodeType } from "../engine/types";
import { api } from "../services/api";

const NODE_TYPES: { type: NodeType; label: string }[] = [
  { type: "start", label: "→ 开始" },
  { type: "agent", label: "🤖 Agent" },
  { type: "condition", label: "◇ 条件分支" },
  { type: "parallel", label: "⇉ 并行分支" },
  { type: "merge", label: "⊕ 数据汇总" },
  { type: "end", label: "◎ 结束" },
];

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  const loadBlueprint = useBlueprintStore((s) => s.loadBlueprint);
  const current = useBlueprintStore((s) => s.current);
  const saveCurrent = useBlueprintStore((s) => s.saveCurrent);
  const addNode = useBlueprintStore((s) => s.addNode);
  const updateNodeConfig = useBlueprintStore((s) => s.updateNodeConfig);
  const undo = useBlueprintStore((s) => s.undo);

  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMsg, setAiMsg] = useState("");

  useEffect(() => {
    if (id && id !== current.id) {
      const ok = loadBlueprint(id);
      if (!ok) navigate("/");
    }
  }, [id]);

  // ============ 拖拽创建节点 ============

  const handleDragStart = useCallback((e: React.DragEvent, nodeType: NodeType) => {
    e.dataTransfer.setData("application/masm-node-type", nodeType);
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData("application/masm-node-type") as NodeType;
      if (!nodeType) return;

      // 计算画布内的坐标
      const rect = canvasContainerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left - 60; // 居中偏移
      const y = e.clientY - rect.top - 30;

      addNode(nodeType, { x: Math.max(0, x), y: Math.max(0, y) });
    },
    [addNode]
  );

  // ============ 智能生成 Prompt ============

  const handleAiGenerate = useCallback(async () => {
    const agentNodes = current.nodes.filter((n) => n.nodeType === "agent");
    if (agentNodes.length === 0) {
      setAiMsg("画布上没有 Agent 节点，请先拖入 Agent 节点再使用智能生成。");
      return;
    }

    setAiGenerating(true);
    setAiMsg("");

    try {
      const result = await api.analyzeWorkflow({
        id: current.id,
        name: current.name,
        nodes: current.nodes,
        edges: current.edges,
      });

      // 将生成的 taskDescription 写入对应 Agent 节点
      for (const cfg of result.node_configs) {
        // 确保节点存在且为 agent 类型
        const node = current.nodes.find(
          (n) => n.nodeId === cfg.nodeId && n.nodeType === "agent"
        );
        if (node) {
          updateNodeConfig(cfg.nodeId, { taskDescription: cfg.taskDescription });
        }
      }

      setAiMsg(`已为 ${result.node_configs.length} 个 Agent 节点生成任务描述。${result.summary}`);
    } catch (e: any) {
      setAiMsg(`智能生成失败: ${e.message}`);
    } finally {
      setAiGenerating(false);
    }
  }, [current, updateNodeConfig]);

  if (!id || current.id !== id) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#999" }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* 顶部工具栏 */}
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
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate("/")}
            style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#333" }}
            title="返回首页"
          >
            ← 返回
          </button>
          <input
            value={current.name}
            onChange={(e) => useBlueprintStore.getState().setBlueprintName(e.target.value)}
            style={{ border: "none", fontSize: 16, fontWeight: 600, background: "transparent", outline: "none", minWidth: 120 }}
          />
          <span style={{ fontSize: 11, color: "#999" }}>
            节点: {current.nodes.length} | 连线: {current.edges.length}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => navigate("/settings")}
            style={{
              padding: "4px 12px",
              background: "#fff",
              color: "#666",
              border: "1px solid #d9d9d9",
              borderRadius: 4,
              fontSize: 13,
              cursor: "pointer",
            }}
            title="配置 API Key"
          >
            ⚙
          </button>
          <button
            onClick={undo}
            style={{
              padding: "4px 12px",
              background: "#fff",
              color: "#666",
              border: "1px solid #d9d9d9",
              borderRadius: 4,
              fontSize: 13,
              cursor: "pointer",
            }}
            title="撤销 (Ctrl+Z)"
          >
            ↶ 撤销
          </button>
          <button
            onClick={saveCurrent}
            style={{
              padding: "4px 16px",
              background: "#4a6cf7",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            保存
          </button>
          <button
            onClick={() => navigate(`/execute/${id}`)}
            style={{
              padding: "4px 16px",
              background: "#52c41a",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            运行
          </button>
          <button
            onClick={handleAiGenerate}
            disabled={aiGenerating}
            style={{
              padding: "4px 16px",
              background: aiGenerating ? "#d9d9d9" : "#fa8c16",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              cursor: aiGenerating ? "not-allowed" : "pointer",
            }}
            title="由主Agent分析流程并自动生成各Agent节点Prompt"
          >
            {aiGenerating ? "分析中..." : "🧠 智能生成"}
          </button>
        </div>
      </div>

      {/* AI 消息提示 */}
      {aiMsg && (
        <div
          style={{
            height: 32,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            background: aiMsg.startsWith("智能生成失败") ? "#fff2f0" : "#f6ffed",
            borderBottom: "1px solid #e0e0e0",
            fontSize: 12,
            color: aiMsg.startsWith("智能生成失败") ? "#ff4d4f" : "#52c41a",
            flexShrink: 0,
          }}
        >
          {aiMsg}
        </div>
      )}

      {/* 主区域：左侧面板 + 画布 */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* 左侧节点面板 */}
        <div
          style={{
            width: 180,
            background: "#fff",
            borderRight: "1px solid #e0e0e0",
            padding: 12,
            flexShrink: 0,
            overflowY: "auto",
            zIndex: 5,
          }}
        >
          <h4 style={{ fontSize: 13, marginBottom: 10, color: "#999", fontWeight: 500 }}>节点库（拖拽到画布）</h4>
          {NODE_TYPES.map(({ type, label }) => {
            const style = NODE_STYLES[type];
            return (
              <div
                key={type}
                draggable
                onDragStart={(e) => handleDragStart(e, type)}
                style={{
                  padding: "10px 12px",
                  marginBottom: 8,
                  background: style.bgColor,
                  color: style.color,
                  borderRadius: 6,
                  cursor: "grab",
                  fontSize: 13,
                  fontWeight: 600,
                  border: `1px solid ${style.borderColor}`,
                  userSelect: "none",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}
              >
                {label}
              </div>
            );
          })}

          <div
            style={{
              marginTop: 20,
              padding: 10,
              background: "#f5f5f5",
              borderRadius: 6,
              fontSize: 11,
              color: "#999",
              lineHeight: 1.6,
            }}
          >
            <div><strong>快捷键：</strong></div>
            <div>Ctrl+Z — 撤销</div>
            <div>Delete — 删除选中</div>
            <div>Ctrl+滚轮 — 缩放</div>
            <div>拖拽空白 — 平移</div>
          </div>
        </div>

        {/* 画布区域 + 配置抽屉覆盖层 */}
        <div
          ref={canvasContainerRef}
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
          }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <CanvasEditor canvasRef={canvasContainerRef} />
        </div>
      </div>
    </div>
  );
}
