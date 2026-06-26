/* 蓝图编辑器状态管理 (Zustand) */

import { create } from "zustand";
import type { WorkflowNode, WorkflowEdge, WorkflowBlueprint } from "../engine/types";
import { loadBlueprints, saveBlueprint } from "../services/storage";

let _nodeIdCounter = 0;
let _edgeIdCounter = 0;

function genNodeId(): string {
  return `node_${Date.now()}_${++_nodeIdCounter}`;
}
function genEdgeId(): string {
  return `edge_${Date.now()}_${++_edgeIdCounter}`;
}

interface BlueprintStore {
  // 当前编辑的蓝图
  current: WorkflowBlueprint;
  // 撤销栈
  undoStack: string[];
  // 蓝图列表
  list: WorkflowBlueprint[];
  // 是否已修改（未保存）
  dirty: boolean;

  // 蓝图操作
  newBlueprint: (name?: string) => void;
  loadBlueprint: (id: string) => boolean;
  saveCurrent: () => void;
  setBlueprintName: (name: string) => void;
  refreshList: () => void;

  // 节点操作
  addNode: (nodeType: WorkflowNode["nodeType"], position: { x: number; y: number }) => void;
  updateNodeConfig: (nodeId: string, config: Partial<WorkflowNode["config"]>) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  removeNode: (nodeId: string) => void;

  // 连线操作
  addEdge: (sourceNodeId: string, targetNodeId: string, label?: string) => void;
  removeEdge: (edgeId: string) => void;

  // 撤销
  undo: () => void;
}

function snapshot(bp: WorkflowBlueprint): string {
  return JSON.stringify({ nodes: bp.nodes, edges: bp.edges });
}

function restore(snapshotJson: string): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  return JSON.parse(snapshotJson);
}

export const useBlueprintStore = create<BlueprintStore>((set, get) => ({
  current: emptyBlueprint(),
  undoStack: [],
  list: loadBlueprints(),
  dirty: false,

  newBlueprint: (name = "未命名工作流") => {
    const bp = emptyBlueprint(name);
    set({ current: bp, undoStack: [], dirty: false });
  },

  loadBlueprint: (id: string) => {
    const bp = loadBlueprints().find((b) => b.id === id);
    if (!bp) return false;
    set({ current: JSON.parse(JSON.stringify(bp)), undoStack: [], dirty: false });
    return true;
  },

  saveCurrent: () => {
    const bp = { ...get().current, createTime: Date.now() };
    saveBlueprint(bp);
    set({ dirty: false });
    get().refreshList();
  },

  setBlueprintName: (name: string) => {
    set((s) => ({ current: { ...s.current, name }, dirty: true }));
  },

  refreshList: () => {
    set({ list: loadBlueprints() });
  },

  // --- 节点 ---

  addNode: (nodeType, position) => {
    set((s) => {
      const pushUndo = () => {
        if (s.undoStack.length >= 50) s.undoStack.shift();
        s.undoStack.push(snapshot(s.current));
      };
      pushUndo();
      const newNode: WorkflowNode = {
        nodeId: genNodeId(),
        nodeType,
        config: {},
        position,
      };
      return {
        current: { ...s.current, nodes: [...s.current.nodes, newNode] },
        dirty: true,
      };
    });
  },

  updateNodeConfig: (nodeId, config) => {
    set((s) => ({
      current: {
        ...s.current,
        nodes: s.current.nodes.map((n) =>
          n.nodeId === nodeId ? { ...n, config: { ...n.config, ...config } } : n
        ),
      },
      dirty: true,
    }));
  },

  updateNodePosition: (nodeId, position) => {
    set((s) => ({
      current: {
        ...s.current,
        nodes: s.current.nodes.map((n) =>
          n.nodeId === nodeId ? { ...n, position } : n
        ),
      },
      dirty: true,
    }));
  },

  removeNode: (nodeId) => {
    set((s) => {
      const pushUndo = () => {
        if (s.undoStack.length >= 50) s.undoStack.shift();
        s.undoStack.push(snapshot(s.current));
      };
      pushUndo();
      return {
        current: {
          ...s.current,
          nodes: s.current.nodes.filter((n) => n.nodeId !== nodeId),
          edges: s.current.edges.filter(
            (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
          ),
        },
        dirty: true,
      };
    });
  },

  // --- 连线 ---

  addEdge: (sourceNodeId, targetNodeId, label) => {
    set((s) => {
      const pushUndo = () => {
        if (s.undoStack.length >= 50) s.undoStack.shift();
        s.undoStack.push(snapshot(s.current));
      };
      pushUndo();
      const newEdge: WorkflowEdge = {
        edgeId: genEdgeId(),
        sourceNodeId,
        targetNodeId,
        label,
      };
      return {
        current: { ...s.current, edges: [...s.current.edges, newEdge] },
        dirty: true,
      };
    });
  },

  removeEdge: (edgeId) => {
    set((s) => {
      const pushUndo = () => {
        if (s.undoStack.length >= 50) s.undoStack.shift();
        s.undoStack.push(snapshot(s.current));
      };
      pushUndo();
      return {
        current: {
          ...s.current,
          edges: s.current.edges.filter((e) => e.edgeId !== edgeId),
        },
        dirty: true,
      };
    });
  },

  // --- 撤销 ---

  undo: () => {
    set((s) => {
      const stack = [...s.undoStack];
      if (stack.length === 0) return {};
      const snap = stack.pop()!;
      const restored = restore(snap);
      return {
        current: { ...s.current, nodes: restored.nodes, edges: restored.edges },
        undoStack: stack,
        dirty: true,
      };
    });
  },
}));

function emptyBlueprint(name = "未命名工作流"): WorkflowBlueprint {
  return {
    id: `bp_${Date.now()}`,
    name,
    nodes: [],
    edges: [],
    createTime: Date.now(),
  };
}
