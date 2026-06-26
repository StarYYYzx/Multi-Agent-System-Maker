/* 矩形节点（Agent / 并行分支 / 数据汇总） */
import React from "react";
import { NODE_STYLES } from "./nodeStyles";
import type { NodeType } from "../../../engine/types";

interface RectNodeProps {
  node: { id: string; data?: { nodeType?: NodeType; taskDescription?: string } };
}

const RectNode: React.FC<RectNodeProps> = ({ node }) => {
  const nodeType = (node.data?.nodeType || "agent") as NodeType;
  const style = NODE_STYLES[nodeType];
  const desc = node.data?.taskDescription || "";

  return (
    <div
      style={{
        width: style.width,
        height: style.height,
        borderRadius: 8,
        background: style.bgColor,
        border: `2px solid ${style.borderColor}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: style.color,
        fontWeight: 600,
        fontSize: 13,
        userSelect: "none",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        overflow: "hidden",
        padding: "4px 8px",
      }}
    >
      <span>{style.label}</span>
      {desc && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 400,
            opacity: 0.85,
            marginTop: 2,
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {desc.length > 16 ? desc.slice(0, 16) + "..." : desc}
        </span>
      )}
    </div>
  );
};

export default RectNode;
