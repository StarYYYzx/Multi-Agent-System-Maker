/* 右侧节点配置抽屉 */
import React, { useState, useEffect } from "react";
import type { NodeType, NodeConfig } from "../../engine/types";
import { NODE_STYLES } from "../canvas/nodes/nodeStyles";

interface NodeConfigDrawerProps {
  open: boolean;
  nodeId: string | null;
  nodeType: NodeType | null;
  config: NodeConfig;
  onSave: (nodeId: string, config: Partial<NodeConfig>) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

const NodeConfigDrawer: React.FC<NodeConfigDrawerProps> = ({
  open,
  nodeId,
  nodeType,
  config,
  onSave,
  onDelete,
  onClose,
}) => {
  const [taskDescription, setTaskDescription] = useState("");
  const [branchRule, setBranchRule] = useState("");

  useEffect(() => {
    if (open) {
      setTaskDescription(config.taskDescription || "");
      setBranchRule(config.branchRule || "");
    }
  }, [open, config.taskDescription, config.branchRule]);

  if (!open || !nodeId) return null;

  const style = nodeType ? NODE_STYLES[nodeType] : null;

  const handleSave = () => {
    if (nodeType === "agent") {
      onSave(nodeId, { taskDescription });
    } else if (nodeType === "condition") {
      onSave(nodeId, { branchRule });
    }
    onClose();
  };

  const handleBlur = () => {
    if (nodeType === "agent") {
      onSave(nodeId, { taskDescription });
    } else if (nodeType === "condition") {
      onSave(nodeId, { branchRule });
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: 300,
        background: "#fff",
        borderLeft: "1px solid #e0e0e0",
        boxShadow: "-2px 0 8px rgba(0,0,0,0.1)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 头部 */}
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid #e0e0e0",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {style && (
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: style.bgColor,
              }}
            />
          )}
          <span style={{ fontWeight: 600, fontSize: 14 }}>{style?.label || "节点"} 配置</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#999" }}
        >
          ×
        </button>
      </div>

      {/* 内容 */}
      <div style={{ flex: 1, padding: 16, overflow: "auto" }}>
        {/* Agent 节点：任务描述 */}
        {nodeType === "agent" && (
          <div>
            <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>任务描述</label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              onBlur={handleBlur}
              placeholder="用自然语言描述这个Agent的任务..."

              rows={4}

              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #d9d9d9",
                borderRadius: 4,
                resize: "vertical",
                fontSize: 13,
              }}
            />
            <p style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
              系统将自动匹配模板或生成结构化 Prompt
            </p>


            {/* 自动生成的 Prompt（由 Auto Prompt Agent 生成） */}
            {(config.generatedSystemPrompt || config.generatedUserPrompt) && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  background: "#f6ffed",
                  borderRadius: 6,
                  border: "1px solid #b7eb8f",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "#389e0d", marginBottom: 8 }}>
                  🤖 Auto Prompt Agent 已生成
                </div>

                {config.generatedSystemPrompt && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: "#999", marginBottom: 2 }}>System Prompt:</div>
                    <div
                      style={{
                        fontSize: 12,
                        background: "#fff",
                        padding: "6px 8px",
                        borderRadius: 4,
                        border: "1px solid #e8e8e8",
                        whiteSpace: "pre-wrap",
                        maxHeight: 100,
                        overflow: "auto",
                      }}
                    >
                      {config.generatedSystemPrompt}
                    </div>
                  </div>
                )}

                {config.generatedUserPrompt && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: "#999", marginBottom: 2 }}>User Prompt:</div>
                    <div
                      style={{
                        fontSize: 12,
                        background: "#fff",
                        padding: "6px 8px",
                        borderRadius: 4,
                        border: "1px solid #e8e8e8",
                        whiteSpace: "pre-wrap",
                        maxHeight: 100,
                        overflow: "auto",
                      }}
                    >
                      {config.generatedUserPrompt}
                    </div>
                  </div>
                )}

                {config.outputSchema && Object.keys(config.outputSchema).length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: "#999", marginBottom: 2 }}>输出格式约束:</div>
                    <div
                      style={{
                        fontSize: 11,
                        background: "#fff",
                        padding: "6px 8px",
                        borderRadius: 4,
                        border: "1px solid #e8e8e8",
                        fontFamily: "monospace",
                      }}
                    >
                      {JSON.stringify(config.outputSchema, null, 1)}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* 条件分支节点：判断规则 */}
        {nodeType === "condition" && (
          <div>
            <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>分支判断规则</label>
            <textarea
              value={branchRule}
              onChange={(e) => setBranchRule(e.target.value)}
              onBlur={handleBlur}
              placeholder="用自然语言描述分支判断条件..."
              rows={4}
              style={{
                width: "100%",
                padding: 8,
                border: "1px solid #d9d9d9",
                borderRadius: 4,
                resize: "vertical",
                fontSize: 13,
              }}
            />
            <p style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
              大模型将根据此规则判断走哪条分支
            </p>
            <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
              <strong>出口说明：</strong>
              <div style={{ marginTop: 4 }}>上方连线 → 通过 (pass)</div>
              <div>右侧连线 → 不通过 (reject)</div>
            </div>
          </div>
        )}

        {/* 开始节点：只读说明 */}
        {nodeType === "start" && (
          <div style={{ fontSize: 13, color: "#666" }}>
            <p>工作流入口节点，运行时在此输入初始文本。</p>
            <p style={{ marginTop: 8 }}>无需额外配置。</p>
          </div>
        )}

        {/* 结束节点 */}
        {nodeType === "end" && (
          <div style={{ fontSize: 13, color: "#666" }}>
            <p>工作流出口节点，汇总并展示最终结果。</p>
            <p style={{ marginTop: 8 }}>无需额外配置。</p>
          </div>
        )}

        {/* 并行分支节点 */}
        {nodeType === "parallel" && (
          <div style={{ fontSize: 13, color: "#666" }}>
            <p>将上游数据同时分发到多条子链路并行执行。</p>
            <p style={{ marginTop: 8 }}>请从该节点拖出至少 2 条连线到下游节点。</p>
          </div>
        )}

        {/* 汇总节点 */}
        {nodeType === "merge" && (
          <div style={{ fontSize: 13, color: "#666" }}>
            <p>接收多条并行链路的输出，做纯 JSON 数组拼接。</p>
            <p style={{ marginTop: 8 }}>请确保有至少 2 条入边连接到此节点。</p>
          </div>
        )}
      </div>

      {/* 底部操作 */}
      <div
        style={{
          padding: 12,
          borderTop: "1px solid #e0e0e0",
          display: "flex",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => {
            onDelete(nodeId);
            onClose();
          }}
          style={{
            padding: "6px 16px",
            border: "1px solid #ff4d4f",
            color: "#ff4d4f",
            background: "#fff",
            borderRadius: 4,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          删除节点
        </button>
        <button
          onClick={handleSave}
          style={{
            padding: "6px 16px",
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
      </div>
    </div>
  );
};

export default NodeConfigDrawer;
