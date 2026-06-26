"""全局配置"""

import os
from dotenv import load_dotenv

load_dotenv()

APP_HOST = os.getenv("APP_HOST", "127.0.0.1")
APP_PORT = int(os.getenv("APP_PORT", "8000"))
APP_ENV = os.getenv("APP_ENV", "development")

# API Key 临时文件存储路径（重启后丢失）
KEY_FILE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", ".key_store.enc")
