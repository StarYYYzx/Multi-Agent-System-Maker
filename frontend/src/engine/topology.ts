/* DAG 拓扑解析器

  职责：
  1. 环路检测（基于 DFS 染色法）
  2. 拓扑排序（Kahn BFS 算法）
  3. 连通性校验（所有节点在 start→end 路径上）
  3. 生成分层的执行顺序（用于调度器）
*/

import type { WorkflowBlueprint, WorkflowNode } from "./types";

export interface TopologyLevel {
  level: number;
  nodeIds: string[];
}

export interface TopologyResult {
  /** 分层执行列表 */
  levels: TopologyLevel[];
  /** 从 nodeId → 节点对象 的快速查找 */
  nodeMap: Map<string, WorkflowNode>;
  /** 从 nodeId → 后继节点ID列表 */
  successors: Map<string, string[]>;
  /** 从 nodeId → 前驱节点ID列表 */
  predecessors: Map<string, string[]>;
  /** 拓扑排序后的节点ID列表 */
  sortedIds: string[];
  /** 是否包含并行/分支结构（影响调度策略） */
  hasComplexFlow: boolean;
}

/**
 * 解析蓝图，生成拓扑执行计划
 * @throws Error 如果检测到环路、缺少开始/结束节点、存在未连通节点
 */
export function parseTopology(bp: WorkflowBlueprint): TopologyResult {
  const nodes = bp.nodes;
  const edges = bp.edges;

  // 构建邻接表
  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  const nodeMap = new Map<string, WorkflowNode>();

  for (const node of nodes) {
    nodeMap.set(node.nodeId, node);
    successors.set(node.nodeId, []);
    predecessors.set(node.nodeId, []);
  }

  for (const edge of edges) {
    const succ = successors.get(edge.sourceNodeId);
    if (succ) succ.push(edge.targetNodeId);
    const pred = predecessors.get(edge.targetNodeId);
    if (pred) pred.push(edge.sourceNodeId);
  }

  // 校验：必须有一个开始节点
  const startNodes = nodes.filter((n) => n.nodeType === "start");
  if (startNodes.length === 0) throw new Error("工作流缺少开始节点");
  if (startNodes.length > 1) throw new Error("工作流只能有一个开始节点");

  // 校验：必须至少有一个结束节点
  const endNodes = nodes.filter((n) => n.nodeType === "end");
  if (endNodes.length === 0) throw new Error("工作流缺少结束节点");

  // 环路检测（DFS 三色染色）
  const colors = new Map<string, 0 | 1 | 2>(); // 0=white, 1=gray, 2=black
  for (const nodeId of nodeMap.keys()) colors.set(nodeId, 0);

  function dfs(id: string): boolean {
    colors.set(id, 1);
    const children = successors.get(id) || [];
    for (const childId of children) {
      const c = colors.get(childId);
      if (c === 1) return true; // 发现环路
      if (c === 0 && dfs(childId)) return true;
    }
    colors.set(id, 2);
    return false;
  }

  for (const nodeId of nodeMap.keys()) {
    if (colors.get(nodeId) === 0 && dfs(nodeId)) {
      throw new Error(`检测到循环闭环，请检查节点连线`);
    }
  }

  // 连通性校验：所有节点必须从 start 可达
  const startId = startNodes[0].nodeId;
  const reachable = new Set<string>();
  const queue = [startId];
  reachable.add(startId);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of successors.get(cur) || []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  const unreachable = nodes.filter((n) => !reachable.has(n.nodeId));
  if (unreachable.length > 0) {
    const names = unreachable.map((n) => n.nodeId.slice(0, 12)).join(", ");
    throw new Error(`存在未连接的节点（从开始节点不可达）: ${names}`);
  }

  // 拓扑排序（Kahn BFS）
  const inDegree = new Map<string, number>();
  for (const nodeId of nodeMap.keys()) {
    inDegree.set(nodeId, predecessors.get(nodeId)?.length || 0);
  }

  const sortedIds: string[] = [];
  const toProcess = [startId];

  while (toProcess.length > 0) {
    const cur = toProcess.shift()!;
    sortedIds.push(cur);

    for (const next of successors.get(cur) || []) {
      const deg = (inDegree.get(next) || 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) {
        toProcess.push(next);
      }
    }
  }

  // 有未处理的节点说明存在死循环 (理论上经过环路检测后不应出现)
  if (sortedIds.length !== nodes.length) {
    throw new Error("拓扑排序异常：存在无法到达的节点");
  }

  // 生成分层（BFS level）
  const levels: TopologyLevel[] = [];
  const levelMap = new Map<string, number>();

  const bfsQueue: string[] = [startId];
  levelMap.set(startId, 0);

  while (bfsQueue.length > 0) {
    const cur = bfsQueue.shift()!;
    const curLevel = levelMap.get(cur)!;

    for (const next of successors.get(cur) || []) {
      const newLevel = curLevel + 1;
      if (!levelMap.has(next) || levelMap.get(next)! < newLevel) {
        levelMap.set(next, newLevel);
        bfsQueue.push(next);
      }
    }
  }

  const maxLevel = Math.max(...levelMap.values());
  for (let lv = 0; lv <= maxLevel; lv++) {
    const nodeIdsAtLevel = sortedIds.filter((id) => levelMap.get(id) === lv);
    if (nodeIdsAtLevel.length > 0) {
      levels.push({ level: lv, nodeIds: nodeIdsAtLevel });
    }
  }

  // 判断是否有复杂流程
  const hasComplexFlow = nodes.some(
    (n) => n.nodeType === "condition" || n.nodeType === "parallel" || n.nodeType === "merge"
  );

  return { levels, nodeMap, successors, predecessors, sortedIds, hasComplexFlow };
}

/**
 * 应用拓扑约束校验（保存/运行前调用）
 * 返回错误消息数组，空数组表示通过
 */
export function validateTopology(bp: WorkflowBlueprint): string[] {
  const errors: string[] = [];

  // 各节点类型的入边/出边约束
  const nodeInDegree = new Map<string, number>();
  const nodeOutDegree = new Map<string, number>();

  for (const node of bp.nodes) {
    nodeInDegree.set(node.nodeId, 0);
    nodeOutDegree.set(node.nodeId, 0);
  }

  for (const edge of bp.edges) {
    nodeOutDegree.set(edge.sourceNodeId, (nodeOutDegree.get(edge.sourceNodeId) || 0) + 1);
    nodeInDegree.set(edge.targetNodeId, (nodeInDegree.get(edge.targetNodeId) || 0) + 1);
  }

  for (const node of bp.nodes) {
    const inDeg = nodeInDegree.get(node.nodeId) || 0;
    const outDeg = nodeOutDegree.get(node.nodeId) || 0;

    switch (node.nodeType) {
      case "start":
        if (inDeg !== 0) errors.push("开始节点不能有入边");
        if (outDeg > 1) errors.push("开始节点只能有一条出边");
        if (outDeg === 0) errors.push("开始节点需要一条出边");
        break;
      case "end":
        if (inDeg === 0) errors.push("结束节点至少需要一条入边");
        if (outDeg !== 0) errors.push("结束节点不能有出边");
        break;
      case "agent":
        if (outDeg > 1) errors.push(`Agent节点(${node.nodeId.slice(0, 10)})在MVP中只能有一条出边`);
        if (outDeg === 0) errors.push(`Agent节点(${node.nodeId.slice(0, 10)})需要连接到下游节点`);
        break;
      case "condition":
        if (outDeg !== 2) errors.push(`条件分支节点(${node.nodeId.slice(0, 10)})必须有恰好2条出边`);
        break;
      case "parallel":
        if (outDeg < 2) errors.push(`并行分支节点(${node.nodeId.slice(0, 10)})需要至少2条出边`);
        break;
      case "merge":
        if (inDeg < 2) errors.push(`汇总节点(${node.nodeId.slice(0, 10)})需要至少2条入边`);
        if (outDeg !== 1) errors.push(`汇总节点(${node.nodeId.slice(0, 10)})需要有1条出边`);
        break;
    }
  }

  // 环路检测、连通性检测
  try {
    parseTopology(bp);
  } catch (e: any) {
    errors.push(e.message);
  }

  return errors;
}
