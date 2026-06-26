"""Prompt 生成服务

双模式结合：
1. 关键词匹配 → 命中模板 → 自动填充
2. 无匹配模板 → 调用大模型自动生成
"""

import re
from typing import Optional

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
