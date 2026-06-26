"""主Agent工作流分析服务

主Agent负责梳理用户在流程图上设计的流程，理解整体 DAG 结构，
为每个 Agent 节点生成合适的 taskDescription。
"""

import json
import re
from app.services.llm_gateway import call_llm


async def analyze_workflow(blueprint: dict) -> dict:
    """分析工作流蓝图，为每个 Agent 节点智能生成任务描述

    Args:
        blueprint: 工作流蓝图 {"nodes": [...], "edges": [...], "name": "..."}

    Returns:
        {"node_configs": [{"nodeId": "...", "taskDescription": "..."}], "summary": "..."}
    """
    # 构建工作流结构摘要
    nodes = blueprint.get("nodes", [])
    edges = blueprint.get("edges", [])
    bp_name = blueprint.get("name", "未命名工作流")

    # 构建节点描述
    node_desc_lines = []
    agent_nodes = []
    for node in nodes:
        node_type = node["nodeType"]
        node_id = node["nodeId"]
        existing_desc = node.get("config", {}).get("taskDescription", "") or "(未配置)"
        label = _node_label(node_type)
        node_desc_lines.append(
            f"  - [{label}] ID={node_id[:12]}  当前描述: {existing_desc}"
        )
        if node_type == "agent":
            agent_nodes.append(node)

    # 构建连线描述
    edge_desc_lines = []
    for edge in edges:
        src = edge["sourceNodeId"][:12]
        tgt = edge["targetNodeId"][:12]
        lbl = edge.get("label", "")
        if lbl:
            edge_desc_lines.append(f"  {src} --[{lbl}]--> {tgt}")
        else:
            edge_desc_lines.append(f"  {src} --> {tgt}")

    # 主Agent分析 Prompt
    system_prompt = (
        "你是一个专业的多Agent工作流设计专家。用户给出了一个可视化工作流的节点和连线结构，"
        "你需要分析整个流程的意图和每个Agent节点的角色，为每个Agent节点生成具体的任务描述（taskDescription）。\n\n"
        "分析要点：\n"
        "1. 理解整体工作流的业务目标\n"
        "2. 分析每个Agent节点在流程中的位置（上游是谁、下游是谁、在分支还是主干）\n"
        "3. 为每个Agent节点生成清晰、可执行的自然语言任务描述\n"
        "4. 任务描述应包含：该Agent的角色定位、需要完成的具体任务、输入数据来自哪里、输出格式要求\n\n"
        "请以JSON格式返回，格式如下：\n"
        '{"summary": "整体流程概述（一句话）", '
        '"node_configs": [{"nodeId": "完整节点ID", "taskDescription": "该节点的任务描述"}]}\n'
        "注意：nodeId必须与输入完全一致，不能截断或修改。"
    )

    user_prompt = (
        f"工作流名称：{bp_name}\n\n"
        f"节点列表（共{len(nodes)}个）：\n"
        + "\n".join(node_desc_lines)
        + f"\n\n连线列表（共{len(edges)}条）：\n"
        + "\n".join(edge_desc_lines)
        + f"\n\n请分析上述工作流，为其中{len(agent_nodes)}个Agent节点生成合适的任务描述。"
    )

    # 调用 LLM 分析
    try:
        result = await call_llm(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
            max_tokens=4096,
        )

        content = result["content"]
        # 提取 JSON
        match = re.search(r"\{[\s\S]*\}", content)
        if match:
            analysis = json.loads(match.group())
        else:
            analysis = json.loads(content)

        return {
            "node_configs": analysis.get("node_configs", []),
            "summary": analysis.get("summary", ""),
        }
    except (json.JSONDecodeError, KeyError):
        # 降级：返回简单的提示
        return {
            "node_configs": [
                {
                    "nodeId": n["nodeId"],
                    "taskDescription": f"请根据上游输入完成以下任务：{n.get('config', {}).get('taskDescription', '处理数据并传递给下游')}"
                }
                for n in agent_nodes
            ],
            "summary": "自动分析失败，请手动配置各Agent节点。",
        }


def _node_label(node_type: str) -> str:
    labels = {
        "start": "开始",
        "agent": "Agent",
        "condition": "条件分支",
        "parallel": "并行分支",
        "merge": "数据汇总",
        "end": "结束",
    }
    return labels.get(node_type, node_type)
