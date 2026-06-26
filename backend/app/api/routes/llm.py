"""LLM 调用接口"""

from fastapi import APIRouter, HTTPException
from app.models.schemas import LLMChatRequest, LLMChatResponse
from app.services.llm_gateway import call_llm

router = APIRouter(prefix="/api/llm", tags=["LLM"])


@router.post("/chat", response_model=LLMChatResponse)
async def chat(req: LLMChatRequest):
    """调用大模型对话"""
    try:
        result = await call_llm(
            messages=req.messages,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
        )
        return LLMChatResponse(**result)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {str(e)}")
