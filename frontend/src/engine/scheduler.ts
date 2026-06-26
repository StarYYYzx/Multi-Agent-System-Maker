/* DAG 工作流调度器

  职责：
  1. 接收拓扑结果 + 用户输入，按分层依次执行
  2. 串行执行同层节点（MVP 简化：逐层串行，层内按序）
  3. 并行分支：识别并行节点，同时发起多个子路径
  4. 条件分支：调用大模型判断，选择对应出口
  5. 超时控制：整体 120 秒上限
  6. 异常即停：任一节点失败立即终止
*/

import type { WorkflowBlueprint, NodeMessage, ExecutionLog, NodeRecord } from "./types";
import { parseTopology } from "./topology";
import { executeNode, recordToMessage } from "./executor";

const TOTAL_TIMEOUT_MS = 120_000; // 120秒

export interface SchedulerOptions {
  onNodeStart?: (nodeId: string) => void;
  onNodeComplete?: (record: NodeRecord) => void;
  onFlowComplete?: (log: ExecutionLog) => void;
  onError?: (error: string) => void;
}

/**
 * 运行工作流
 *
 * @param bp         工作流蓝图
 * @param userInput  用户在开始节点输入的文本
 * @param options    回调钩子（用于实时可视化）
 * @returns ExecutionLog
 */
export async function runWorkflow(
  bp: WorkflowBlueprint,
  userInput: string,
  options: SchedulerOptions = {},
): Promise<ExecutionLog> {
  const logId = `log_${Date.now()}`;
  const log: ExecutionLog = {
    logId,
    blueprintId: bp.id,
    startTime: Date.now(),
    endTime: 0,
    status: "success",
    nodeRecords: [],
  };

  const globalStart = Date.now();

  try {
    // 1. 解析拓扑
    const topo = parseTopology(bp);

    // 2. 准备初始消息
    const initialMessage: NodeMessage = {
      sourceNodeId: "user",
      rawContent: userInput,
      structuredData: {},
      timestamp: Date.now(),
    };

    // 3. 按层执行
    // nodeResults 存储每个节点的执行结果消息，用于下游节点获取输入
    const nodeResults = new Map<string, NodeMessage>();
    nodeResults.set("user", initialMessage);

    for (const level of topo.levels) {
      // 检查总超时
      const elapsed = Date.now() - globalStart;
      if (elapsed >= TOTAL_TIMEOUT_MS) {
        throw new Error(`工作流执行超时（超过${TOTAL_TIMEOUT_MS / 1000}秒）`);
      }

      const remainingTime = TOTAL_TIMEOUT_MS - elapsed;

      // 判断当前层是否包含并行/分支节点
      const parallelNodes = level.nodeIds
        .map((id) => topo.nodeMap.get(id))
        .filter((n) => n?.nodeType === "parallel");
      const conditionNodes = level.nodeIds
        .map((id) => topo.nodeMap.get(id))
        .filter((n) => n?.nodeType === "condition");
      const mergeNodes = level.nodeIds
        .map((id) => topo.nodeMap.get(id))
        .filter((n) => n?.nodeType === "merge");

      // === 处理并行分支 ===
      if (parallelNodes.length > 0) {
        for (const paraNode of parallelNodes) {
          if (!paraNode) continue;

          options.onNodeStart?.(paraNode.nodeId);

          // 获取并行节点的输入
          const paraInput = getNodeInput(paraNode.nodeId, topo.predecessors, nodeResults);
          const paraRecord = await executeNode(paraNode, paraInput, remainingTime);
          log.nodeRecords.push(paraRecord);
          nodeResults.set(paraNode.nodeId, recordToMessage(paraRecord, paraNode.nodeId));

          options.onNodeComplete?.(paraRecord);

          if (paraRecord.status === "failed") {
            throw new Error(`并行分支节点 ${paraNode.nodeId} 执行失败: ${paraRecord.error}`);
          }

          // 找到并行分支的所有子路径，并发执行
          const branches = topo.successors.get(paraNode.nodeId) || [];
          const branchPromises = branches.map(async (branchStartId: string) => {
            const branchRecords: NodeRecord[] = [];
            await executeBranch(
              branchStartId,
              topo,
              nodeResults,
              branchRecords,
              remainingTime,
              options,
              globalStart,
            );
            return branchRecords;
          });

          const allBranchResults = await Promise.all(branchPromises);

          // 所有分支的结果存入 nodeResults（汇总节点读取）
          const allBranchOutputs = allBranchResults.flat();
          for (const record of allBranchOutputs) {
            log.nodeRecords.push(record);
            if (!nodeResults.has(record.nodeId)) {
              nodeResults.set(record.nodeId, recordToMessage(record, record.nodeId));
            }
          }
        }
        continue;
      }

      // === 处理汇总节点 ===
      if (mergeNodes.length > 0) {
        for (const mergeNode of mergeNodes) {
          if (!mergeNode) continue;

          options.onNodeStart?.(mergeNode.nodeId);

          // 汇总节点需要收集所有前驱的结果
          const predIds = topo.predecessors.get(mergeNode.nodeId) || [];
          const allResults = predIds.map((pid) => nodeResults.get(pid)).filter(Boolean);

          const mergeInput: NodeMessage = {
            sourceNodeId: "merge",
            rawContent: JSON.stringify(allResults.map((r) => r?.structuredData)),
            structuredData: { branches: allResults.map((r) => r?.structuredData) },
            timestamp: Date.now(),
          };

          const mergeRecord = await executeNode(mergeNode, mergeInput, remainingTime);
          log.nodeRecords.push(mergeRecord);
          nodeResults.set(mergeNode.nodeId, recordToMessage(mergeRecord, mergeNode.nodeId));

          options.onNodeComplete?.(mergeRecord);

          if (mergeRecord.status === "failed") {
            throw new Error(`汇总节点 ${mergeNode.nodeId} 执行失败: ${mergeRecord.error}`);
          }
        }
        continue;
      }

      // === 处理条件分支 ===
      if (conditionNodes.length > 0) {
        for (const condNode of conditionNodes) {
          if (!condNode) continue;

          options.onNodeStart?.(condNode.nodeId);

          const condInput = getNodeInput(condNode.nodeId, topo.predecessors, nodeResults);
          const condRecord = await executeNode(condNode, condInput, remainingTime);
          log.nodeRecords.push(condRecord);
          nodeResults.set(condNode.nodeId, recordToMessage(condRecord, condNode.nodeId));

          options.onNodeComplete?.(condRecord);

          if (condRecord.status === "failed") {
            throw new Error(`条件分支节点 ${condNode.nodeId} 执行失败: ${condRecord.error}`);
          }

          // 根据判断结果选择后续路径
          const decision = (condRecord.structuredOutput as any)?.branch || "pass";
          const successors = topo.successors.get(condNode.nodeId) || [];
          const edges = bp.edges.filter((e) => e.sourceNodeId === condNode.nodeId);
          const chosenEdge = edges.find(
            (e) => e.label === decision || e.label === undefined
          );
          const targetNodeId = chosenEdge?.targetNodeId || successors[0];

          if (targetNodeId) {
            await executeBranch(
              targetNodeId as string,
              topo,
              nodeResults,
              log.nodeRecords,
              remainingTime,
              options,
              globalStart,
              new Set([condNode.nodeId]),
            );
          }
        }
        continue;
      }

      // === 普通节点（串行执行当前层） ===
      for (const nodeId of level.nodeIds) {
        const elapsed2 = Date.now() - globalStart;
        if (elapsed2 >= TOTAL_TIMEOUT_MS) {
          throw new Error(`工作流执行超时（超过${TOTAL_TIMEOUT_MS / 1000}秒）`);
        }

        const node = topo.nodeMap.get(nodeId);
        if (!node) continue;
        // 跳过已处理的特殊节点
        if (["parallel", "condition", "merge"].includes(node.nodeType)) continue;

        options.onNodeStart?.(node.nodeId);

        const nodeInput = getNodeInput(node.nodeId, topo.predecessors, nodeResults);
        const nodeTimeout = TOTAL_TIMEOUT_MS - (Date.now() - globalStart);
        const record = await executeNode(node, nodeInput, nodeTimeout);
        log.nodeRecords.push(record);
        nodeResults.set(node.nodeId, recordToMessage(record, node.nodeId));

        options.onNodeComplete?.(record);

        if (record.status === "failed") {
          throw new Error(`节点 ${node.nodeId} 执行失败: ${record.error}`);
        }
      }
    }

    log.status = "success";
  } catch (e: any) {
    log.status = e.message?.includes("超时") ? "timeout" : "failed";
    log.errorMessage = e.message || String(e);
    options.onError?.(log.errorMessage!);
  }

  log.endTime = Date.now();
  options.onFlowComplete?.(log);
  return log;
}

// ============ 辅助函数 ============

/** 获取节点的输入消息（取第一个前驱的结果） */
function getNodeInput(
  nodeId: string,
  predecessors: Map<string, string[]>,
  nodeResults: Map<string, NodeMessage>,
): NodeMessage {
  const preds = predecessors.get(nodeId) || [];
  const predResult = preds.map((pid) => nodeResults.get(pid)).find(Boolean);
  return predResult || {
    sourceNodeId: "unknown",
    rawContent: "",
    structuredData: {},
    timestamp: Date.now(),
  };
}

/** 从指定节点开始，按拓扑顺序递归执行一条分支路径 */
async function executeBranch(
  startNodeId: string,
  topo: ReturnType<typeof parseTopology>,
  nodeResults: Map<string, NodeMessage>,
  records: NodeRecord[],
  remainingTime: number,
  options: SchedulerOptions,
  globalStart: number,
  skipNodeIds?: Set<string>,
): Promise<void> {
  // BFS 遍历该分支路径
  const visited = new Set<string>(skipNodeIds || []);
  const queue = [startNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const elapsed = Date.now() - globalStart;
    if (elapsed >= TOTAL_TIMEOUT_MS) {
      throw new Error(`分支执行超时`);
    }

    const node = topo.nodeMap.get(nodeId);
    if (!node) continue;

    // 如果是并行/条件/汇总节点，递归处理
    if (node.nodeType === "parallel") {
      // 嵌套并行：递归
      const paraInput = getNodeInput(node.nodeId, topo.predecessors, nodeResults);
      const paraRecord = await executeNode(node, paraInput, remainingTime);
      records.push(paraRecord);
      nodeResults.set(node.nodeId, recordToMessage(paraRecord, node.nodeId));

      const branches = topo.successors.get(node.nodeId) || [];
      const nestedResults = await Promise.all(
        branches.map(async (bid) => {
          const nestedRecords: NodeRecord[] = [];
          await executeBranch(bid, topo, nodeResults, nestedRecords, remainingTime, options, globalStart, visited);
          return nestedRecords;
        })
      );
      nestedResults.flat().forEach((r) => records.push(r));
      continue;
    }

    if (node.nodeType === "condition") {
      const condInput = getNodeInput(node.nodeId, topo.predecessors, nodeResults);
      const condRecord = await executeNode(node, condInput, remainingTime);
      records.push(condRecord);
      nodeResults.set(node.nodeId, recordToMessage(condRecord, node.nodeId));

      const decision = (condRecord.structuredOutput as any)?.branch || "pass";
      const successors = topo.successors.get(node.nodeId) || [];
      const chosenId = successors[decision === "pass" ? 0 : 1] || successors[0];
      if (chosenId && !visited.has(chosenId)) {
        queue.push(chosenId);
      }
      continue;
    }

    if (node.nodeType === "merge") {
      // 子路径中的汇总节点：跳过（主流程会处理）
      continue;
    }

    // 普通节点
    options.onNodeStart?.(node.nodeId);
    const nodeInput = getNodeInput(node.nodeId, topo.predecessors, nodeResults);
    const nodeTimeout = TOTAL_TIMEOUT_MS - (Date.now() - globalStart);
    const record = await executeNode(node, nodeInput, nodeTimeout);
    records.push(record);
    nodeResults.set(node.nodeId, recordToMessage(record, node.nodeId));
    options.onNodeComplete?.(record);

    if (record.status === "failed") {
      throw new Error(`节点 ${node.nodeId} 执行失败: ${record.error}`);
    }

    // 将后继加入队列
    const succs = topo.successors.get(node.nodeId) || [];
    for (const sid of succs) {
      if (!visited.has(sid)) queue.push(sid);
    }
  }
}
