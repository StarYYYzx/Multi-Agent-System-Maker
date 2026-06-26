/* 开始/结束节点（圆形） */
import React from "react";
import { NODE_STYLES } from "./nodeStyles";
import type { NodeType } from "../../../engine/types";

interface CircleNodeProps {
  node: { id: string; data?: { nodeType?: NodeType } };
}

const CircleNode: React.FC<CircleNodeProps> = ({ node }) => {
  const nodeType = (node.data?.nodeType || "start") as NodeType;
  const style = NODE_STYLES[nodeType];

  return (
    <div
      style={{
        width: style.width,
        height: style.height,
        borderRadius: "50%",
        background: style.bgColor,
        border: `2px solid ${style.borderColor}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: style.color,
        fontWeight: 600,
        fontSize: 14,
        userSelect: "none",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
      }}
    >
      {style.label}
    </div>
  );
};

export default CircleNode;
