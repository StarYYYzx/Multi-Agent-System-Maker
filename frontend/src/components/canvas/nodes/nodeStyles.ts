/* 节点样式配置 */
import type { NodeType } from "../../../engine/types";

export interface NodeStyle {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  width: number;
  height: number;
}

export const NODE_STYLES: Record<NodeType, NodeStyle> = {
  start: {
    label: "开始",
    color: "#fff",
    bgColor: "#52c41a",
    borderColor: "#389e0d",
    width: 80,
    height: 80,
  },
  agent: {
    label: "Agent",
    color: "#fff",
    bgColor: "#1677ff",
    borderColor: "#0958d9",
    width: 140,
    height: 60,
  },
  condition: {
    label: "条件分支",
    color: "#333",
    bgColor: "#fadb14",
    borderColor: "#d4b106",
    width: 120,
    height: 80,
  },
  parallel: {
    label: "并行分支",
    color: "#fff",
    bgColor: "#fa8c16",
    borderColor: "#d46b08",
    width: 140,
    height: 60,
  },
  merge: {
    label: "数据汇总",
    color: "#fff",
    bgColor: "#722ed1",
    borderColor: "#531dab",
    width: 140,
    height: 60,
  },
  end: {
    label: "结束",
    color: "#fff",
    bgColor: "#ff4d4f",
    borderColor: "#cf1322",
    width: 80,
    height: 80,
  },
};

export const NODE_PORT_GROUPS = {
  top: {
    position: { name: "top" as const },
    attrs: { circle: { r: 4, magnet: true, stroke: "#666", fill: "#fff", strokeWidth: 2 } },
  },
  bottom: {
    position: { name: "bottom" as const },
    attrs: { circle: { r: 4, magnet: true, stroke: "#666", fill: "#fff", strokeWidth: 2 } },
  },
  left: {
    position: { name: "left" as const },
    attrs: { circle: { r: 4, magnet: true, stroke: "#666", fill: "#fff", strokeWidth: 2 } },
  },
  right: {
    position: { name: "right" as const },
    attrs: { circle: { r: 4, magnet: true, stroke: "#666", fill: "#fff", strokeWidth: 2 } },
  },
};
