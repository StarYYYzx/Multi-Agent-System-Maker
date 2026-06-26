"""Prompt 生成接口"""

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    PromptGenerateRequest,
    PromptGenerateResponse,
    WorkflowPromptRequest,
    WorkflowPromptResponse,
)
from app.services.prompt_service import (
    match_template,
    fill_template,
    auto_generate_prompt,
    generate_workflow_prompts,
)


router = APIRouter(prefix="/api/prompt", tags=["Prompt"])


@router.post("/generate", response_model=PromptGenerateResponse)
async def generate_prompt(req: PromptGenerateRequest):
    """根据用户任务描述生成结构化 Prompt

    优先匹配内置模板，无匹配则调用大模型自动生成。
    """
    # 如果强制指定了模板，直接使用
    if req.force_template:
        from app.services.prompt_service import TEMPLATES
        tpl = TEMPLATES.get(req.force_template)
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



@router.post("/generate-for-workflow", response_model=WorkflowPromptResponse)
async def generate_prompts_for_workflow(req: WorkflowPromptRequest):
    """分析整个工作流结构，为所有 Agent 节点自动生成并分配 Prompt

    这是默认存在的"Auto Prompt Agent"——不在工作流画布中，
    而是作为系统内置服务，理解工作流全局上下文后为每个 Agent 角色量身定制 Prompt。
    """
    try:
        assignments = await generate_workflow_prompts(
            workflow_name=req.workflow_name,
            workflow_summary=req.workflow_summary,
            agent_nodes=req.agent_nodes,
        )
        return WorkflowPromptResponse(assignments=assignments)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"工作流 Prompt 自动生成失败: {str(e)}")

