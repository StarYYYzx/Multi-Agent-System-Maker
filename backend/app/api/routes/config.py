"""API Key 管理接口"""

from fastapi import APIRouter
from app.models.schemas import KeyConfigRequest, KeyStatusResponse, MessageResponse
from app.services.key_manager import save_api_key, is_key_configured, clear_api_key

router = APIRouter(prefix="/api/config", tags=["Config"])


@router.post("/key", response_model=MessageResponse)
async def set_api_key(req: KeyConfigRequest):
    """设置 API Key"""
    save_api_key(req.api_key)
    return MessageResponse(success=True, message="API Key 已保存，重启服务后需重新设置")


@router.get("/key", response_model=KeyStatusResponse)
async def check_api_key():
    """检查 API Key 是否已配置"""
    configured = is_key_configured()
    return KeyStatusResponse(
        configured=configured,
        message="API Key 已配置" if configured else "未配置 API Key，请通过 POST /api/config/key 设置",
    )


@router.delete("/key", response_model=MessageResponse)
async def delete_api_key():
    """清除 API Key"""
    clear_api_key()
    return MessageResponse(success=True, message="API Key 已清除")
