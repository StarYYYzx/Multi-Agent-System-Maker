"""大模型网关 - DeepSeek API 封装

统一封装 LLM 调用接口，方便后续切换模型厂商。
"""

import httpx
from app.services.key_manager import load_api_key

# DeepSeek API 配置
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
DEEPSEEK_CHAT_MODEL = "deepseek-chat"

# 超时配置（秒）：单次 LLM 调用最长等待时间
LLM_TIMEOUT = 60


async def call_llm(
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> dict:
    """调用 DeepSeek Chat Completion API

    Args:
        messages: 对话消息列表 [{"role": "system", "content": "..."}, ...]
        temperature: 采样温度
        max_tokens: 最大输出 token 数

    Returns:
        {"content": str, "model": str, "usage": dict}

    Raises:
        RuntimeError: API Key 未配置
        httpx.HTTPError: 网络或 API 错误
    """
    api_key = load_api_key()
    if not api_key:
        raise RuntimeError("API Key 未配置，请先通过 POST /api/config/key 设置")

    url = f"{DEEPSEEK_BASE_URL}/chat/completions"

    payload = {
        "model": DEEPSEEK_CHAT_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    return {
        "content": data["choices"][0]["message"]["content"],
        "model": data.get("model", DEEPSEEK_CHAT_MODEL),
        "usage": data.get("usage", {}),
    }
