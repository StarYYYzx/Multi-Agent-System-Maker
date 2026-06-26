"""Prompt 生成接口"""

from fastapi import APIRouter, HTTPException
from app.models.schemas import PromptGenerateRequest, PromptGenerateResponse
from app.services.prompt_service import match_template, fill_template, auto_generate_prompt, get_template_by_id

router = APIRouter(prefix="/api/prompt", tags=["Prompt"])


@router.post("/generate", response_model=PromptGenerateResponse)
async def generate_prompt(req: PromptGenerateRequest):
    """根据用户任务描述生成结构化 Prompt

    优先匹配内置模板，无匹配则调用大模型自动生成。
    """
    # 如果强制指定了模板，直接使用
    if req.force_template:
        tpl = get_template_by_id(req.force_template)
        if not tpl:
            raise HTTPException(status_code=400, detail=f"未找到模板: {req.force_template}")
        return PromptGenerateResponse(
            system_prompt=tpl["system_prompt"],
            user_prompt=tpl["user_prompt_template"].format(task=req.task_description),
            template_id=tpl["template_id"],
            output_schema=tpl["output_schema"],
        )

    # 关键词匹配
    scene = match_template(req.task_description)
    if scene:
        result = fill_template(req.task_description, scene)
        return PromptGenerateResponse(**result)

    # 无匹配 → AI 自动生成
    try:
        result = await auto_generate_prompt(req.task_description)
        return PromptGenerateResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Prompt 自动生成失败: {str(e)}")
