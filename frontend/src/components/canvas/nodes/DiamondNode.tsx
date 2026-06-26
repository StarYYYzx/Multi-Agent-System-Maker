/* 条件分支节点（菱形） */
import React from "react";
import { NODE_STYLES } from "./nodeStyles";
import type { NodeType } from "../../../engine/types";

interface DiamondNodeProps {
  node: { id: string; data?: { nodeType?: NodeType; branchRule?: string } };
}

const DiamondNode: React.FC<DiamondNodeProps> = ({ node }) => {
  const nodeType = (node.data?.nodeType || "condition") as NodeType;
  const style = NODE_STYLES[nodeType];
  const rule = node.data?.branchRule || "";

  const size = style.width;
  const half = size / 2;

  return (
    <div
      style={{
        width: size,
        height: style.height,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width={size}
        height={style.height}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <polygon
          points={`${half},4 ${size - 4},${style.height / 2} ${half},${style.height - 4} 4,${style.height / 2}`}
          fill={style.bgColor}
          stroke={style.borderColor}
          strokeWidth="2"
        />
      </svg>
      <div
        style={{
          position: "relative",
          zIndex: 1,
          color: style.color,
          fontWeight: 600,
          fontSize: 12,
          userSelect: "none",
          textAlign: "center",
          maxWidth: size - 24,
          lineHeight: 1.3,
        }}
      >
        <div>{style.label}</div>
        {rule && (
          <div
            style={{
              fontSize: 9,
              fontWeight: 400,
              opacity: 0.85,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: size - 24,
            }}
          >
            {rule.length > 10 ? rule.slice(0, 10) + "..." : rule}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiamondNode;
