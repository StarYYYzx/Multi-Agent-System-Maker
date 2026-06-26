"""Prompt 生成服务

双模式结合：
1. 关键词匹配 → 命中模板 → 自动填充
2. 无匹配模板 → 调用大模型自动生成
3. 工作流级 → 分析全局 DAG 上下文，为每个 Agent 生成专属 Prompt
"""

import re
import json
from typing import Optional
from app.models.schemas import AgentPromptAssignment, WorkflowPromptNode

# === 场景关键词表 ===
KEYWORD_TABLE = {
    "文案创作": ["写", "文案", "创作", "文章", "广告", "营销", "宣传"],
    "客户答疑": ["客户", "答疑", "问答", "客服", "回答", "咨询", "问题"],
    "信息总结": ["总结", "摘要", "概括", "归纳", "整理", "提炼"],
    "内容审核": ["审核", "审查", "检查", "合规", "敏感", "违规"],
}


# === 四类 Prompt 模板 ===
TEMPLATES = {
    "文案创作": {
        "template_id": "template_copywriting",
        "system_prompt": "你是一位资深的文案撰写专家，擅长各类文本创作。",
        "user_prompt_template": "请根据以下任务描述，撰写高质量文案：\n{task}\n\n请确保输出内容结构清晰、语言精炼。",
        "output_schema": {
            "title": "string",
            "content": "string",
            "keywords": ["string"],
        },
    },
    "客户答疑": {
        "template_id": "template_customer_service",
        "system_prompt": "你是一位专业的客户服务代表，耐心、准确地回答客户问题。",
        "user_prompt_template": "请回答以下客户问题：\n{task}\n\n请确保回答专业、准确、友好。",
        "output_schema": {
            "answer": "string",
            "references": ["string"],
            "confidence": "string",
        },
    },
    "信息总结": {
        "template_id": "template_summary",
        "system_prompt": "你是一位信息整理专家，擅长从大量信息中提炼关键要点。",
        "user_prompt_template": "请对以下内容进行总结提炼：\n{task}\n\n请输出结构化的总结，包含核心要点和详细说明。",
        "output_schema": {
            "summary": "string",
            "key_points": ["string"],
            "detail": "string",
        },
    },
    "内容审核": {
        "template_id": "template_review",
        "system_prompt": "你是一位严谨的内容审核专家，依据规则审核文本内容。",
        "user_prompt_template": "请审核以下内容：\n{task}\n\n请判断内容是否合规，并给出详细审核意见。",
        "output_schema": {
            "is_compliant": "boolean",
            "issues": ["string"],
            "suggestion": "string",
        },
    },
}


def match_template(task_description: str) -> Optional[str]:
    """关键词匹配场景模板

    Args:
        task_description: 用户任务描述

    Returns:
        场景标签（"文案创作"/"客户答疑"/"信息总结"/"内容审核"）或 None
    """
    text = task_description.lower()
    for scene, keywords in KEYWORD_TABLE.items():
        for kw in keywords:
            if kw in text:
                return scene
    return None


def fill_template(task_description: str, scene: str) -> dict:
    """根据匹配到的场景标签，填充对应模板

    Args:
        task_description: 用户任务描述
        scene: 场景标签

    Returns:
        {"system_prompt": str, "user_prompt": str, "template_id": str, "output_schema": dict}
    """
    tpl = TEMPLATES[scene]
    return {
        "system_prompt": tpl["system_prompt"],
        "user_prompt": tpl["user_prompt_template"].format(task=task_description),
        "template_id": tpl["template_id"],
        "output_schema": tpl["output_schema"],
    }


async def auto_generate_prompt(task_description: str) -> dict:
    """无匹配模板时，调用大模型自动生成结构化 Prompt

    Args:
        task_description: 用户任务描述

    Returns:
        {"system_prompt": str, "user_prompt": str, "template_id": None, "output_schema": dict}
    """
    from app.services.llm_gateway import call_llm

    generate_messages = [
        {
            "role": "system",
            "content": (
                "你是一个专业的AI Prompt设计专家。用户会给出一个任务描述，你需要为其设计合适的System Prompt和User Prompt。\n"
                "请以JSON格式返回，包含以下字段：\n"
                '{"system_prompt": "给AI的角色设定和指令", "user_prompt": "给AI的具体任务（包含用户的原始任务描述）", '
                '"output_schema": {"字段名": "类型说明（string/number/boolean/array）"}}\n'
                "注意：output_schema 必须是一个合法的JSON Schema对象，约束AI的输出格式。"
            ),
        },
        {"role": "user", "content": f"请为以下任务设计Prompt：\n{task_description}"},
    ]

    try:
        result = await call_llm(generate_messages, temperature=0.5, max_tokens=2048)
        import json

        content = result["content"]
        # 尝试提取 JSON
        match = re.search(r"\{[\s\S]*\}", content)
        if match:
            prompt_data = json.loads(match.group())
        else:
            prompt_data = json.loads(content)

        return {
            "system_prompt": prompt_data.get("system_prompt", "You are a helpful assistant."),
            "user_prompt": prompt_data.get("user_prompt", task_description),
            "template_id": None,
            "output_schema": prompt_data.get("output_schema", {}),
        }
    except Exception:
        # 降级：返回通用 Prompt
        return {
            "system_prompt": "你是一个智能助手，请根据用户需求提供高质量的回复。",
            "user_prompt": task_description,
            "template_id": None,
            "output_schema": {"result": "string"},
        }


async def generate_workflow_prompts(
    workflow_name: str,
    workflow_summary: str,
    agent_nodes: list[WorkflowPromptNode],
) -> list[AgentPromptAssignment]:
    """Auto Prompt Agent：分析整个工作流 DAG 结构，为每个 Agent 量身定制 Prompt

    这是系统默认存在的"额外 Agent"，不在用户画布中显示，
    而是作为内置服务，理解工作流全局上下文后为每个 Agent 角色分配专属 Prompt。

    Args:
        workflow_name: 工作流名称
        workflow_summary: 工作流结构自然语言概览（前端根据 DAG 生成）
        agent_nodes: Agent 节点列表（含任务描述）

    Returns:
        list[AgentPromptAssignment]: 每个 Agent 的 System/User Prompt + 输出 Schema
    """
    from app.services.llm_gateway import call_llm

    if not agent_nodes:
        raise ValueError("工作流中至少需要一个 Agent 节点")

    # 构建 Agent 节点描述列表
    agent_descriptions = []
    for i, node in enumerate(agent_nodes, 1):
        desc = node.task_description or "未设定任务描述"
        agent_descriptions.append(f"Agent-{i}（ID: {node.node_id}）: {desc}")

    agent_list_text = "\n".join(agent_descriptions)

    meta_prompt = f"""你是一个专业的AI工作流 Prompt 设计专家。

用户设计了一个名为「{workflow_name}」的多 Agent 协作工作流。

工作流整体结构：
{workflow_summary or "未提供结构概览"}

工作流中包含以下 Agent 节点，你需要为每个 Agent 设计专属的 System Prompt 和 User Prompt：

{agent_list_text}

设计要求：
1. 每个 Agent 的 System Prompt 应定义其职责、角色定位和专业领域
2. 每个 Agent 的 User Prompt 应与工作流上下游衔接，考虑前序节点的输出作为上下文
3. 为每个 Agent 定义一个 output_schema，约束其输出为结构化 JSON，包含合适的字段名和类型
4. Prompt 应简洁专业，每条不超过 300 字

请以严格 JSON 数组格式返回，不要包含任何额外文本：

[
  {{
    "node_id": "节点ID",
    "system_prompt": "该 Agent 的角色设定",
    "user_prompt": "该 Agent 的具体任务指令",
    "output_schema": {{"字段名": "类型(string/number/boolean/array)"}}
  }}
]"""

    messages = [
        {"role": "system", "content": "你是一个专业的AI工作流 Prompt 设计专家，请严格按照 JSON 格式输出。"},
        {"role": "user", "content": meta_prompt},
    ]

    try:
        result = await call_llm(messages, temperature=0.4, max_tokens=4096)
        content = result["content"]

        # 提取 JSON 数组
        json_match = re.search(r"\[[\s\S]*\]", content)
        if not json_match:
            raise ValueError("LLM 未返回合法的 JSON 数组")

        parsed: list[dict] = json.loads(json_match.group())

        assignments: list[AgentPromptAssignment] = []
        for item in parsed:
            assignments.append(
                AgentPromptAssignment(
                    node_id=item.get("node_id", ""),
                    system_prompt=item.get("system_prompt", ""),
                    user_prompt=item.get("user_prompt", ""),
                    output_schema=item.get("output_schema", {}),
                )
            )

        return assignments

    except Exception as e:
        # 降级：调用单节点生成逻辑作为兜底
        fallback: list[AgentPromptAssignment] = []
        for node in agent_nodes:
            try:
                single = await auto_generate_prompt(node.task_description or "通用任务")
                fallback.append(
                    AgentPromptAssignment(
                        node_id=node.node_id,
                        system_prompt=single["system_prompt"],
                        user_prompt=single["user_prompt"],
                        output_schema=single["output_schema"],
                    )
                )
            except Exception:
                fallback.append(
                    AgentPromptAssignment(
                        node_id=node.node_id,
                        system_prompt="你是一个智能助手，请根据输入内容完成指定的任务。",
                        user_prompt=node.task_description or "请根据上下文信息完成你的任务。",
                        output_schema={"result": "string"},
                    )
                )

        return fallback
