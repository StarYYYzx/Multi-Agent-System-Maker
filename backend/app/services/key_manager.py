"""API Key 加密存储管理

MVP 方案：加密后存入本地临时文件，重启服务后文件丢失需重新配置。
"""

import os
from cryptography.fernet import Fernet
from app.core.config import KEY_FILE_PATH

_cipher = Fernet(b"55WXcgtk7EyDZs8L55KoKxcMH4PbxUgGB7__HL1l-Ic=")  # 预生成的 Fernet key


def save_api_key(api_key: str) -> None:
    """加密并存储 API Key 到临时文件"""
    encrypted = _cipher.encrypt(api_key.encode("utf-8"))
    with open(KEY_FILE_PATH, "wb") as f:
        f.write(encrypted)


def load_api_key() -> str | None:
    """从临时文件加载并解密 API Key"""
    if not os.path.exists(KEY_FILE_PATH):
        return None
    try:
        with open(KEY_FILE_PATH, "rb") as f:
            encrypted = f.read()
        return _cipher.decrypt(encrypted).decode("utf-8")
    except Exception:
        return None


def is_key_configured() -> bool:
    """检查 API Key 是否已配置"""
    return load_api_key() is not None


def clear_api_key() -> None:
    """清除已存储的 API Key（重启时自动丢失）"""
    if os.path.exists(KEY_FILE_PATH):
        os.remove(KEY_FILE_PATH)
