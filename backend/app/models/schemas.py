"""Pydantic 请求/响应数据模型"""

from pydantic import BaseModel, Field
from typing import Optional, Any


# === API Key 管理 ===

class KeyConfigRequest(BaseModel):
    api_key: str = Field(..., description="用户提供的 API Key")


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


# === 通用响应 ===

class MessageResponse(BaseModel):
    success: bool
    message: str
    data: Any = None
