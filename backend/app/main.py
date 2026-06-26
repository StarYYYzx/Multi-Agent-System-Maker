"""FastAPI 应用入口"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import config, llm, prompt, workflow
from app.core.config import APP_HOST, APP_PORT, APP_ENV

app = FastAPI(
    title="MASM Multi-Agent System Maker API",
    description="零代码多Agent拖拽式工作流设计平台 - 后端API服务",
    version="0.1.0",
)

# CORS 配置：允许前端开发服务器跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # MVP 阶段允许所有源，生产环境应限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(config.router)
app.include_router(llm.router)
app.include_router(prompt.router)
app.include_router(workflow.router)


@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "env": APP_ENV}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=APP_HOST, port=APP_PORT, reload=True)
