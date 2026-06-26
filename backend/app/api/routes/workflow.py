"""工作流主Agent分析接口"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.services.workflow_service import analyze_workflow

router = APIRouter(prefix="/api/workflow", tags=["Workflow"])


class WorkflowAnalyzeRequest(BaseModel):
    id: str = Field(..., description="蓝图ID")
    name: str = Field(default="未命名工作流")
    nodes: list[dict] = Field(..., description="节点列表")
    edges: list[dict] = Field(..., description="连线列表")
    createTime: Optional[int] = None


class NodeConfigResult(BaseModel):
    nodeId: str
    taskDescription: str


class WorkflowAnalyzeResponse(BaseModel):
    node_configs: list[NodeConfigResult]
    summary: str


@router.post("/analyze", response_model=WorkflowAnalyzeResponse)
async def analyze(req: WorkflowAnalyzeRequest):
    """主Agent分析工作流，为每个Agent节点智能生成任务描述

    主Agent会理解整体DAG结构，分析每个Agent节点的上下游关系，
    并生成贴合流程的taskDescription。
    """
    try:
        blueprint = {
            "name": req.name,
            "nodes": req.nodes,
            "edges": req.edges,
        }
        result = await analyze_workflow(blueprint)
        return WorkflowAnalyzeResponse(**result)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"工作流分析失败: {str(e)}")
