# MASM - Multi-Agent System Maker

> 零代码多 Agent 拖拽式工作流设计平台

面向无代码业务人员，通过可视化画布拖拽搭建多智能体协作链路。用户仅需填写任务描述，系统自动生成标准化 Prompt，完成多 Agent 串行、分支、并行协作。

---

## 项目结构

```
Multi-Agent-System-Maker/
├── frontend/                    # React + Vite + AntV X6
│   │   ├── index.html           #   Vite 入口 HTML
│   │   ├── tsconfig.json        #   TypeScript 编译配置
│   │   ├── vite-env.d.ts        #   Vite 类型声明
│   │   └── src/
│       ├── components/canvas/   # 画布编辑器（X6 Graph + 6 种自定义节点）
│       │   └── nodes/           #   CircleNode / RectNode / DiamondNode
│       ├── engine/              # DAG 工作流引擎
│       │   ├── types.ts         #   核心数据模型（8 个类型定义）
│       │   ├── topology.ts      #   拓扑解析（环路检测 + Kahn 排序 + 约束校验）
│       │   ├── scheduler.ts     #   调度器（分层执行 + Promise.all 并行 + 120s 超时）
│       │   └── executor.ts      #   节点执行器（6 种节点逻辑 + LLM 调用 + AbortController）
│       ├── pages/               # 5 个 SPA 页面
│       │   ├── BlueprintListPage.tsx  # `/`           蓝图列表 + 执行历史
│       │   ├── EditorPage.tsx         # `/editor/:id` 画布编辑器 + 主Agent智能生成
│       │   ├── ExecutePage.tsx        # `/execute/:id` 流程运行可视化
│       │   ├── LogDetailPage.tsx      # `/logs/:logId` 执行日志详情
│       │   └── SettingsPage.tsx       # `/settings`   API Key 配置页
│       ├── services/            # api.ts（后端封装）/ storage.ts（LocalStorage CRUD）
│       ├── store/               # Zustand 状态管理（蓝图编辑 + 撤销栈）
│       └── templates/           # 4 类内置 Prompt 模板 + 场景关键词表
│
├── backend/                     # FastAPI
│   └── app/
│       ├── api/routes/          # config.py / llm.py / prompt.py / workflow.py
│       ├── services/            # key_manager / llm_gateway / prompt_service / workflow_service
│       ├── models/schemas.py    # Pydantic 数据模型
│       └── main.py              # FastAPI 入口 + CORS
│
└── docs/
    └── 初步设计.md              # 完整设计文档
```

## 功能概览

| 功能模块 | 说明 |
|---------|------|
| 可视化画布 | 拖拽创建 6 种节点（开始/Agent/条件分支/并行分支/汇总/结束），鼠标连线构建 DAG |
| 节点配置 | 右侧抽屉面板，配置 Agent 任务描述或分支判断规则 |
| 主 Agent 智能生成 | 一键分析工作流 DAG 结构，自动为每个 Agent 节点生成贴合流程的 Prompt |
| Prompt 引擎 | 关键词匹配 4 类内置模板，无匹配时 AI 自动生成结构化 Prompt |
| 工作流运行 | DAG 拓扑解析 → 分层调度 → 串行/分支/并行执行 → 实时可视化 |
| 日志系统 | 每次执行的完整日志持久化到 LocalStorage，支持分节点查看 I/O 详情 |
| 蓝图管理 | 保存/加载/删除本地蓝图 JSON |
| 撤销操作 | Ctrl+Z 撤销（最近 50 步），支持节点增删/连线/移动 |
| 拓扑校验 | 实时检测环路、节点出入度约束、悬挂节点 |
| API Key 管理 | 页面内配置 DeepSeek API Key，加密存储到服务端临时文件 |

## 节点类型

| 节点 | 入/出边 | 说明 |
|------|---------|------|
| 开始 | 0 / 1 | 全局唯一入口，接收用户输入 |
| Agent | ≥1 / 1 | 核心业务节点，调用 LLM 执行任务 |
| 条件分支 | ≥1 / 2 | LLM 判断自然语言规则，选择 pass/reject |
| 并行分支 | ≥1 / ≥2 | 同时分发至多条子链路（Promise.all） |
| 数据汇总 | ≥2 / 1 | 收集并行结果，纯 JSON 数组拼接 |
| 结束 | ≥1 / 0 | 流程出口，输出最终结果 |

## 技术栈

| 层面 | 选型 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 可视化 | AntV X6 v2（SVG 节点渲染 + DOM 键盘快捷键） |
| 状态管理 | Zustand |
| 路由 | React Router v7（SPA） |
| 构建 | Vite 6 |
| 后端 | FastAPI (Python 3.11) |
| 加密 | cryptography (Fernet) |
| LLM | DeepSeek（可扩展） |
| 存储 | 浏览器 LocalStorage |

## 快速开始

### 环境要求

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **Conda**（推荐）

### 1. 后端

```powershell
# 创建并激活虚拟环境
conda create -n masm python=3.11 -y
conda activate masm

# 安装依赖
cd backend
pip install -r requirements.txt

# 启动服务
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

启动后访问 http://127.0.0.1:8000/docs 查看 API 文档。

### 2. 前端

```powershell
cd frontend
npm install
npm run dev
```

启动后访问终端输出的地址（默认 http://127.0.0.1:5173）。

### 3. 使用流程

1. 打开首页，点击 **「新建蓝图」** 进入画布编辑器
2. 从左侧面版 **拖拽节点** 到画布，**鼠标拖拽** 连接节点
3. **点击节点** → 右侧抽屉配置 Agent 任务描述或分支规则
4. 点击 **「保存」** → 点击 **「运行」**
5. 在运行页输入初始文本，点击 **「开始运行」**
6. 实时查看每个节点的 Prompt / LLM 返回 / 结构化输出 / 耗时
7. 运行完成后点击 **「查看日志」** 查看完整执行记录

### 4. API Key 配置

**方式一：页面内配置（推荐）**

1. 在首页或编辑页点击 **⚙ 设置** 按钮
2. 选择 LLM 供应商，输入 API Key，点击保存
3. Key 状态实时显示，支持清除

**方式二：命令行配置**

```bash
curl -X POST http://127.0.0.1:8000/api/config/key \
  -H "Content-Type: application/json" \
  -d '{"api_key": "sk-xxxxxxxxxxxxxxxx"}'
```

Key 经 Fernet 加密后存入服务端临时文件，**重启服务后自动丢失**，需重新设置。

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/config/key` | 设置 API Key |
| GET | `/api/config/key` | 检查 Key 状态 |
| DELETE | `/api/config/key` | 清除 Key |
| POST | `/api/llm/chat` | 调用大模型对话 |
| POST | `/api/prompt/generate` | 生成结构化 Prompt |
| POST | `/api/workflow/analyze` | 主 Agent 分析工作流 DAG，智能生成各节点任务描述 |

## MVP 约束边界

- 仅文本对话 Agent，无工具调用 / 知识库
- 纯零代码，无脚本输入
- 浏览器 LocalStorage 存储，无需账号登录
- 单轮 LLM 调用，无多轮反思
- 总执行时限 120 秒，超时自动终止
- 仅支持 Chrome / Edge 桌面浏览器

## 后续扩展

- [ ] 工具调用节点 / 知识库检索节点 / Webhook 触发节点
- [ ] 账号云端存储 & 蓝图分享
- [ ] Agent 多轮自我反思
- [ ] 蓝图版本管理
- [ ] 关键词分支模式（高性能无 LLM 判断）

## License

MIT
