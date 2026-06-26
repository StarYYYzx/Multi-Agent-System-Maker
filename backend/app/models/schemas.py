"""Pydantic 请求/响应数据模型"""

from pydantic import BaseModel, Field
from typing import Optional, Any


# === API Key 管理 ===

class KeyConfigRequest(BaseModel):
    api_key: str = Field(..., description="用户提供的 API Key")

    provider: str = Field(default="deepseek", description="LLM 厂商（deepseek）")



class KeyStatusResponse(BaseModel):
    configured: bool
    message: str


# === LLM 调用 ===

class LLMChatRequest(BaseModel):
    messages: list[dict] = Field(..., description="对话消息列表")
    temperature: float = Field(default=0.7, ge=0, le=2.0)
    max_tokens: int = Field(default=4096, ge=1, le=32768)


class LLMChatResponse(BaseModel):
    content: str = Field(..., description="模型返回文本")
    model: str = Field(default="deepseek-chat")
    usage: dict = Field(default_factory=dict)


# === Prompt 生成 ===

class PromptGenerateRequest(BaseModel):
    task_description: str = Field(..., description="用户填写的任务描述")
    force_template: Optional[str] = Field(default=None, description="强制使用指定模板ID")


class PromptGenerateResponse(BaseModel):
    system_prompt: str = Field(..., description="生成的 System Prompt")
    user_prompt: str = Field(..., description="生成的 User Prompt")
    template_id: Optional[str] = Field(default=None, description="匹配到的模板ID，无匹配则为None")
    output_schema: dict = Field(default_factory=dict, description="强制输出JSON格式约束")




class WorkflowPromptNode(BaseModel):
    """工作流中一个 Agent 节点的描述信息"""
    node_id: str = Field(..., description="节点ID")
    task_description: str = Field(default="", description="任务描述")


class WorkflowPromptRequest(BaseModel):
    """分析整个工作流，为所有 Agent 节点生成 Prompt"""
    workflow_name: str = Field(default="未命名工作流")
    workflow_summary: str = Field(default="", description="工作流结构概览（自然语言）")
    agent_nodes: list[WorkflowPromptNode] = Field(..., description="Agent 节点列表")


class AgentPromptAssignment(BaseModel):
    node_id: str
    system_prompt: str
    user_prompt: str
    output_schema: dict = Field(default_factory=dict)


class WorkflowPromptResponse(BaseModel):
    assignments: list[AgentPromptAssignment]
    model: str = Field(default="deepseek-chat")



# === 通用响应 ===

class MessageResponse(BaseModel):
    success: bool
    message: str
    data: Any = None
