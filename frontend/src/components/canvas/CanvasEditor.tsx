/* X6 画布编辑器核心组件

   使用 X6 原生 SVG markup + attrs 渲染节点（避免 HTML foreignObject 兼容问题）。
*/

import React, { useRef, useEffect, useCallback, useState } from "react";
import { Graph } from "@antv/x6";
import { useBlueprintStore } from "../../store/blueprintStore";
import { NODE_STYLES, NODE_PORT_GROUPS } from "./nodes/nodeStyles";
import NodeConfigDrawer from "./NodeConfigDrawer";
import type { NodeType, NodeConfig, WorkflowNode } from "../../engine/types";

// ============ 自定义节点形状注册 ============

const SHAPE_CIRCLE = "masm-circle";
const SHAPE_RECT = "masm-rect";
const SHAPE_DIAMOND = "masm-diamond";

/** 注册三个自定义 SVG 节点形状（在 Graph 实例化之前调用） */
function registerCustomShapes() {
  // 已注册则跳过
  if ((Graph as any).__masmShapesRegistered) return;
  (Graph as any).__masmShapesRegistered = true;

  // 圆形节点（开始/结束）
  Graph.registerNode(SHAPE_CIRCLE, {
    inherit: "circle",
    width: 80,
    height: 80,
    markup: [
      { tagName: "circle", selector: "body" },
      { tagName: "text", selector: "label" },
      { tagName: "text", selector: "subLabel" },
    ],
    attrs: {
      body: {
        refCx: "50%",
        refCy: "50%",
        refR: "50%",
        strokeWidth: 2,
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))",
      },
      label: {
        refX: "50%",
        refY: "50%",
        textAnchor: "middle",
        dominantBaseline: "central",
        fontSize: 14,
        fontWeight: 600,
      },
      subLabel: {
        refX: "50%",
        refDy: 10,
        textAnchor: "middle",
        dominantBaseline: "central",
        fontSize: 10,
        fontWeight: 400,
        opacity: 0.85,
      },
    },
    ports: {
      groups: NODE_PORT_GROUPS,
      items: [
        { id: "top", group: "top" },
        { id: "bottom", group: "bottom" },
        { id: "left", group: "left" },
        { id: "right", group: "right" },
      ],
    },
  });

  // 矩形节点（Agent / 并行分支 / 汇总）
  Graph.registerNode(SHAPE_RECT, {
    inherit: "rect",
    width: 140,
    height: 60,
    markup: [
      { tagName: "rect", selector: "body" },
      { tagName: "text", selector: "label" },
      { tagName: "text", selector: "subLabel" },
    ],
    attrs: {
      body: {
        refWidth: "100%",
        refHeight: "100%",
        rx: 8,
        ry: 8,
        strokeWidth: 2,
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))",
      },
      label: {
        refX: "50%",
        refY: 14,
        textAnchor: "middle",
        dominantBaseline: "central",
        fontSize: 13,
        fontWeight: 600,
      },
      subLabel: {
        refX: "50%",
        refY: 14,
        refDy: 16,
        textAnchor: "middle",
        dominantBaseline: "central",
        fontSize: 10,
        fontWeight: 400,
        opacity: 0.85,
      },
    },
    ports: {
      groups: NODE_PORT_GROUPS,
      items: [
        { id: "top", group: "top" },
        { id: "bottom", group: "bottom" },
        { id: "left", group: "left" },
        { id: "right", group: "right" },
      ],
    },
  });

  // 菱形节点（条件分支）
  Graph.registerNode(SHAPE_DIAMOND, {
    width: 120,
    height: 80,
    markup: [
      { tagName: "polygon", selector: "body" },
      { tagName: "text", selector: "label" },
      { tagName: "text", selector: "subLabel" },
    ],
    attrs: {
      body: {
        points: "60,4 116,40 60,76 4,40",
        strokeWidth: 2,
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))",
      },
      label: {
        refX: "50%",
        refY: 22,
        textAnchor: "middle",
        dominantBaseline: "central",
        fontSize: 12,
        fontWeight: 600,
      },
      subLabel: {
        refX: "50%",
        refY: 22,
        refDy: 16,
        textAnchor: "middle",
        dominantBaseline: "central",
        fontSize: 10,
        fontWeight: 400,
        opacity: 0.85,
      },
    },
    ports: {
      groups: NODE_PORT_GROUPS,
      items: [
        { id: "top", group: "top" },
        { id: "bottom", group: "bottom" },
        { id: "left", group: "left" },
        { id: "right", group: "right" },
      ],
    },
  });
}

// ============ 节点数据映射 ============

/** 节点类型 → X6 shape 名称 */
function shapeForType(nodeType: NodeType): string {
  switch (nodeType) {
    case "start":
    case "end":
      return SHAPE_CIRCLE;
    case "condition":
      return SHAPE_DIAMOND;
    default:
      return SHAPE_RECT;
  }
}

/** 从 WorkflowNode 构建 X6 节点数据 */
function x6NodeFromWF(wfNode: WorkflowNode) {
  const style = NODE_STYLES[wfNode.nodeType];
  const desc = wfNode.config.taskDescription || wfNode.config.branchRule || "";

  return {
    id: wfNode.nodeId,
    x: wfNode.position.x,
    y: wfNode.position.y,
    shape: shapeForType(wfNode.nodeType),
    width: style.width,
    height: style.height,
    attrs: {
      body: {
        fill: style.bgColor,
        stroke: style.borderColor,
      },
      label: {
        text: style.label,
        fill: style.color,
      },
      subLabel: {
        text: truncate(desc, 12),
        fill: style.color,
      },
    },
  };
}

/** 更新已有节点的 attrs 属性（配置变更时） */
function updateX6NodeAttrs(graph: Graph, wfNode: WorkflowNode) {
  const gNode = graph.getCellById(wfNode.nodeId);
  if (!gNode || !gNode.isNode()) return;
  const style = NODE_STYLES[wfNode.nodeType];
  const desc = wfNode.config.taskDescription || wfNode.config.branchRule || "";

  gNode.setAttrs({
    body: {
      fill: style.bgColor,
      stroke: style.borderColor,
    },
    label: {
      text: style.label,
      fill: style.color,
    },
    subLabel: {
      text: truncate(desc, 12),
      fill: style.color,
    },
  } as any);
}

function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "..." : s;
}

// ============ 主组件 ============

interface CanvasEditorProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

const CanvasEditor: React.FC<CanvasEditorProps> = ({ canvasRef }) => {
  const graphRef = useRef<Graph | null>(null);
  const isInternalChange = useRef(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<NodeType | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<NodeConfig>({});

  // Store
  const current = useBlueprintStore((s) => s.current);
  const updateNodeConfig = useBlueprintStore((s) => s.updateNodeConfig);
  const updateNodePosition = useBlueprintStore((s) => s.updateNodePosition);
  const removeNode = useBlueprintStore((s) => s.removeNode);
  const addEdge = useBlueprintStore((s) => s.addEdge);
  const removeEdge = useBlueprintStore((s) => s.removeEdge);
  const undo = useBlueprintStore((s) => s.undo);

  // ============ 挂载：初始化 X6 Graph ============
  useEffect(() => {
    if (!canvasRef.current) return;
    if (graphRef.current) return;

    registerCustomShapes();

    const graph = new Graph({
      container: canvasRef.current,
      width: canvasRef.current.clientWidth,
      height: canvasRef.current.clientHeight,
      background: { color: "#fafbfc" },
      grid: { size: 20, visible: true, type: "dot", args: { color: "#d0d0d0", thickness: 1 } },
      panning: { enabled: true, modifiers: "shift" },
      mousewheel: { enabled: true, modifiers: "ctrl", factor: 1.1 },
      connecting: {
        connector: { name: "smooth" },
        connectionPoint: "anchor",
        allowBlank: false,
        snap: { radius: 20 },
        validateConnection({ sourceCell, targetCell }: any) {
          if (!sourceCell || !targetCell) return false;
          if (sourceCell.id === targetCell.id) return false;
          return true;
        },
      },
      highlighting: {
        magnetAdsorbed: {
          name: "stroke",
          args: { padding: 4, attrs: { stroke: "#4a6cf7", strokeWidth: 3 } },
        },
      },
    });

    graphRef.current = graph;

    // 连线创建
    graph.on("edge:connected", ({ isNew, edge }: { isNew: boolean; edge: any }) => {
      if (!isNew) return;
      isInternalChange.current = true;
      addEdge(edge.getSourceCellId() as string, edge.getTargetCellId() as string);
    });

    // Delete 键删除选中
    graph.bindKey("delete", () => {
      const cells = graph.getSelectedCells();
      if (cells.length > 0) {
        cells.forEach((cell: any) => {
          if (cell.isNode()) removeNode(cell.id);
          if (cell.isEdge()) removeEdge(cell.id);
        });
        setDrawerOpen(false);
        setSelectedNodeId(null);
      }
    });

    // Ctrl+Z 撤销
    graph.bindKey("ctrl+z", () => undo());

    // 节点移动结束 → 同步位置
    graph.on("node:moved", ({ node }: { node: any }) => {
      isInternalChange.current = true;
      const pos = node.getPosition() as { x: number; y: number };
      updateNodePosition(node.id as string, { x: pos.x, y: pos.y });
    });

    // 节点点击 → 打开配置抽屉
    graph.on("node:click", ({ node }: { node: any }) => {
      const wfNode = current.nodes.find((n) => n.nodeId === (node.id as string));
      if (wfNode) {
        setSelectedNodeId(wfNode.nodeId);
        setSelectedNodeType(wfNode.nodeType);
        setSelectedConfig({ ...wfNode.config });
        setDrawerOpen(true);
      }
    });

    // 空白区域点击 → 关闭抽屉
    graph.on("blank:click", () => {
      setDrawerOpen(false);
      setSelectedNodeId(null);
      graph.cleanSelection();
    });

    // 边点击 → 选中
    graph.on("edge:click", ({ edge }: { edge: any }) => {
      graph.cleanSelection();
      graph.select(edge);
    });

    graph.on("edge:removed", () => {
      isInternalChange.current = false;
    });

    // 窗口尺寸变化
    const onResize = () => {
      if (canvasRef.current && graph) {
        graph.resize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      graph.dispose();
      graphRef.current = null;
    };
  }, []);

  // ============ 数据同步：store → graph ============
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }

    const graphNodeIds = new Set(graph.getNodes().map((n) => n.id));
    const storeNodeIds = new Set(current.nodes.map((n) => n.nodeId));
    const graphEdgeIds = new Set(graph.getEdges().map((e) => e.id));
    const storeEdgeIds = new Set(current.edges.map((e) => e.edgeId));

    // 新增 / 更新节点
    current.nodes.forEach((wfNode) => {
      if (!graphNodeIds.has(wfNode.nodeId)) {
        graph.addNode(x6NodeFromWF(wfNode));
      } else {
        const gNode = graph.getCellById(wfNode.nodeId);
        if (gNode && gNode.isNode()) {
          const gPos = gNode.getPosition();
          if (gPos.x !== wfNode.position.x || gPos.y !== wfNode.position.y) {
            gNode.setPosition(wfNode.position);
          }
          updateX6NodeAttrs(graph, wfNode);
        }
      }
    });

    // 删除节点
    graphNodeIds.forEach((gid) => {
      if (!storeNodeIds.has(gid)) graph.removeCell(gid);
    });

    // 新增连线
    current.edges.forEach((wfEdge) => {
      if (!graphEdgeIds.has(wfEdge.edgeId)) {
        graph.addEdge({
          id: wfEdge.edgeId,
          source: { cell: wfEdge.sourceNodeId, port: "bottom" },
          target: { cell: wfEdge.targetNodeId, port: "top" },
          attrs: {
            line: { stroke: "#999", strokeWidth: 2, targetMarker: { name: "block", size: 8, fill: "#999" } },
          },
          labels: wfEdge.label
            ? [{ attrs: { text: { text: wfEdge.label, fontSize: 10, fill: "#666" } }, position: 0.5 }]
            : undefined,
        });
      }
    });

    // 删除连线
    graphEdgeIds.forEach((gid) => {
      if (!storeEdgeIds.has(gid)) graph.removeCell(gid);
    });
  }, [current.nodes, current.edges]);

  // 刷新选中配置
  useEffect(() => {
    if (selectedNodeId && drawerOpen) {
      const wfNode = current.nodes.find((n) => n.nodeId === selectedNodeId);
      if (wfNode) setSelectedConfig({ ...wfNode.config });
    }
  }, [current.nodes, selectedNodeId, drawerOpen]);

  const handleConfigSave = useCallback(
    (nodeId: string, config: Partial<NodeConfig>) => updateNodeConfig(nodeId, config),
    [updateNodeConfig]
  );

  const handleConfigDelete = useCallback(
    (nodeId: string) => removeNode(nodeId),
    [removeNode]
  );

  return (
    <NodeConfigDrawer
      open={drawerOpen}
      nodeId={selectedNodeId}
      nodeType={selectedNodeType}
      config={selectedConfig}
      onSave={handleConfigSave}
      onDelete={handleConfigDelete}
      onClose={() => {
        setDrawerOpen(false);
        setSelectedNodeId(null);
        graphRef.current?.cleanSelection();
      }}
    />
  );
};

export default CanvasEditor;
