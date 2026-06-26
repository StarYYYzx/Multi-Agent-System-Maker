/* X6 画布编辑器核心组件 */

import React, { useRef, useEffect, useCallback, useState } from "react";
import { Graph } from "@antv/x6";
import { useBlueprintStore } from "../../store/blueprintStore";
import { NODE_STYLES, NODE_PORT_GROUPS } from "./nodes/nodeStyles";
import NodeConfigDrawer from "./NodeConfigDrawer";
import type { NodeType, NodeConfig, WorkflowNode } from "../../engine/types";

// ============ 工具：生成节点 HTML ============

function buildNodeHTML(wfNode: WorkflowNode): string {
  const style = NODE_STYLES[wfNode.nodeType];
  const label = style.label;
  const desc =
    wfNode.config.taskDescription ||
    wfNode.config.branchRule ||
    "";

  const shortDesc = desc.length > 12 ? desc.slice(0, 12) + "..." : desc;

  if (wfNode.nodeType === "condition") {
    const size = style.width;
    const half = size / 2;
    return `
      <div style="width:${size}px;height:${style.height}px;position:relative;display:flex;align-items:center;justify-content:center;">
        <svg width="${size}" height="${style.height}" style="position:absolute;top:0;left:0;">
          <polygon points="${half},4 ${size - 4},${style.height / 2} ${half},${style.height - 4} 4,${style.height / 2}"
            fill="${style.bgColor}" stroke="${style.borderColor}" stroke-width="2"/>
        </svg>
        <div style="position:relative;z-index:1;color:${style.color};font-weight:600;font-size:12px;text-align:center;max-width:${size - 24}px;line-height:1.3;">
          <div>${label}</div>
          ${shortDesc ? `<div style="font-size:9px;font-weight:400;opacity:0.85;">${shortDesc}</div>` : ""}
        </div>
      </div>`;
  }

  if (wfNode.nodeType === "start" || wfNode.nodeType === "end") {
    const size = style.width;
    return `
      <div style="width:${size}px;height:${size}px;border-radius:50%;background:${style.bgColor};border:2px solid ${style.borderColor};
        display:flex;align-items:center;justify-content:center;color:${style.color};font-weight:600;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.15);">
        ${label}
      </div>`;
  }

  // 矩形节点（agent / parallel / merge）
  return `
    <div style="width:${style.width}px;height:${style.height}px;border-radius:8px;background:${style.bgColor};border:2px solid ${style.borderColor};
      display:flex;flex-direction:column;align-items:center;justify-content:center;color:${style.color};font-weight:600;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.15);overflow:hidden;padding:4px 8px;">
      <span>${label}</span>
      ${shortDesc ? `<span style="font-size:10px;font-weight:400;opacity:0.85;margin-top:2px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${shortDesc}</span>` : ""}
    </div>`;
}

function x6NodeFromWF(wfNode: WorkflowNode) {
  const style = NODE_STYLES[wfNode.nodeType];
  return {
    id: wfNode.nodeId,
    x: wfNode.position.x,
    y: wfNode.position.y,
    shape: "html",
    width: style.width,
    height: style.height,
    html: buildNodeHTML(wfNode),
    ports: {
      groups: NODE_PORT_GROUPS,
      items: [
        { id: "top", group: "top" },
        { id: "bottom", group: "bottom" },
        { id: "left", group: "left" },
        { id: "right", group: "right" },
      ],
    },
  };
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
      const srcId = edge.getSourceCellId() as string;
      const tgtId = edge.getTargetCellId() as string;
      addEdge(srcId, tgtId);
    });

    // Delete 键删除
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

    // 节点移动结束
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
          // 更新 HTML 内容
          gNode.setPropByPath("html", buildNodeHTML(wfNode));
        }
      }
    });

    // 删除节点
    graphNodeIds.forEach((gid) => {
      if (!storeNodeIds.has(gid)) {
        graph.removeCell(gid);
      }
    });

    // 新增连线
    current.edges.forEach((wfEdge) => {
      if (!graphEdgeIds.has(wfEdge.edgeId)) {
        graph.addEdge({
          id: wfEdge.edgeId,
          source: { cell: wfEdge.sourceNodeId, port: "bottom" },
          target: { cell: wfEdge.targetNodeId, port: "top" },
          attrs: {
            line: {
              stroke: "#999",
              strokeWidth: 2,
              targetMarker: { name: "block", size: 8, fill: "#999" },
            },
          },
          labels: wfEdge.label
            ? [{ attrs: { text: { text: wfEdge.label, fontSize: 10, fill: "#666" } }, position: 0.5 }]
            : undefined,
        });
      }
    });

    // 删除连线
    graphEdgeIds.forEach((gid) => {
      if (!storeEdgeIds.has(gid)) {
        graph.removeCell(gid);
      }
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
    (nodeId: string, config: Partial<NodeConfig>) => {
      updateNodeConfig(nodeId, config);
    },
    [updateNodeConfig]
  );

  const handleConfigDelete = useCallback(
    (nodeId: string) => {
      removeNode(nodeId);
    },
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
