/* 节点类型 → React 组件 映射 */
import type { NodeType } from "../../../engine/types";
import CircleNode from "./CircleNode";
import RectNode from "./RectNode";
import DiamondNode from "./DiamondNode";
import React from "react";

/** 根据节点类型返回对应的 React 渲染组件 */
export function getNodeComponent(nodeType: NodeType): React.FC<{ node: { id: string; data?: Record<string, unknown> } }> {
  switch (nodeType) {
    case "start":
    case "end":
      return CircleNode as React.FC<{ node: { id: string; data?: Record<string, unknown> } }>;
    case "condition":
      return DiamondNode as React.FC<{ node: { id: string; data?: Record<string, unknown> } }>;
    case "agent":
    case "parallel":
    case "merge":
    default:
      return RectNode as React.FC<{ node: { id: string; data?: Record<string, unknown> } }>;
  }
}
