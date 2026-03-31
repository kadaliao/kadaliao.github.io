---
title: "泄露的 Claude Code 源代码解析"
date: "2026-03-31"
draft: false
tags: ["Claude Code", "源代码", "Coding Agent", "架构分析", "Anthropic"]
categories: ["AI Agent"]
description: "Claude Code 源代码意外通过 npm registry 的 source map 文件泄露。本文深入解析其核心架构：五层系统结构、40+ 工具生态、编译时特性标志、子 Agent 编排机制，以及那个 5000 行的 REPL 组件。"
---

今天有人在 npm registry 上发现，Anthropic 发布的 Claude Code 包里附带了 `.map` 文件——source map。

这东西本来是给浏览器 debug 用的，附带进生产包是个失误。代价是：原始 TypeScript 源码可以被完整还原出来。

一时间社区里传开了，完整的源代码结构被扒了出来。

本着学习 coding agent 工程实现的目的，深入读一下这份代码，看看 Anthropic 是怎么构建一个生产级 coding agent 的。

---

## 先看项目结构

整个代码库遵循**层级优先**的组织方式——顶层目录对应架构子系统，不是按功能分组的。

```
kadaliao/claude-code (main 分支)
├── main.tsx                   # CLI 入口
├── QueryEngine.ts             # 核心查询编排引擎
├── Tool.ts                    # 工具接口定义与类型
├── Task.ts                    # 后台任务类型定义
├── query.ts                   # 异步生成器查询循环
├── tools.ts                   # 工具注册表 (40+ 内置工具)
├── commands.ts                # 斜杠命令注册表 (80+ 命令)
├── context.ts                 # 系统/用户上下文组装
├── ink.ts                     # 自定义 Ink 渲染引擎封装
│
├── screens/
│   ├── REPL.tsx               # 主交互式 REPL（约 5000 行）
│   ├── Doctor.tsx             # 诊断界面
│   └── ResumeConversation.tsx # 会话恢复界面
│
├── components/                # 100+ React UI 组件
├── hooks/                     # 自定义 React Hooks
├── state/                     # AppState 状态存储
├── services/                  # 后端服务模块
├── tools/                     # 各工具的具体实现
├── commands/                  # 各斜杠命令的实现
├── skills/                    # 动态技能加载系统
├── tasks/                     # 后台 Agent 任务类型
├── entrypoints/               # 初始化与 SDK 入口
├── bridge/                    # 远程连接与移动端桥接
├── coordinator/               # 协调器模式编排
├── assistant/                 # 助手（KAIROS）模式
├── plugins/                   # 插件系统
└── voice/                     # 语音输入集成
```

几个马上能引起注意的点：

- `screens/REPL.tsx` 约 5000 行，是整个 UI 的核心，管理输入、查询生命周期、工具权限对话框、流式输出、通知系统、会话恢复
- `coordinator/`、`assistant/`、`voice/` 这几个目录暗示了不对外公开的构建变体（后面细说）
- `commands.ts` 有 80+ 斜杠命令，比公开文档里展示的多得多

---

## 整体架构：五层

系统分为五个主要层级：

```
CLI 入口层        main.tsx、entrypoints/init.ts
终端 UI 层        ink.ts、screens/REPL.tsx、components/
核心引擎层        QueryEngine.ts、query.ts
工具系统层        tools.ts、Tool.ts、tools/*
MCP 与集成层      services/mcp/*、tasks/
```

核心流程是：用户提交 → CLI 入口 → 终端 UI → QueryEngine → Claude API → 工具执行 → 流式结果渲染回终端。

整个系统的核心是**流式 Agent 循环**：把用户提示词发给 Claude API，实时处理工具调用响应，在本地执行这些工具（或委托给子 Agent），把结果反馈进对话，直到模型停止。

![diagram-1](/images/posts/claude-code-source/mermaid-1.png)

---

## 启动：并行预取减少感知延迟

启动时有个值得注意的细节：`main.tsx` 和 `entrypoints/init.ts` 会**并行**执行多项初始化任务——读取 MDM 配置、预取 macOS 钥匙串、检测 Git 仓库、设置遥测——目的是尽可能减少首次用户交互前的等待时间。

配置分两层加载：`~/.claude/`（全局）和 `.claude/`（项目级，可覆盖全局）。`enableConfigs()` 负责把这两层合并起来。

![diagram-2](/images/posts/claude-code-source/mermaid-2.png)

---

## QueryEngine：Agent 循环的核心

`QueryEngine.ts` 是整个系统的心脏，`query.ts` 是它的执行体。

关键设计是 `query.ts` 用的是**异步生成器**（`async generator`）——不是 Promise，而是 `async function*`。这样可以边产出 token 边处理，实现真正的流式响应，同时保持对整个循环的控制权。

流程：

```
handlePromptSubmit（验证 + 前置 hooks）
  → QueryEngine（消息队列、状态管理）
  → query.ts（异步生成器循环）
  → Claude API（流式响应）
  → 解析 tool_use 块
  → 工具执行
  → 把结果作为 tool_result 塞回对话
  → 继续下一轮，直到 stop_reason = "end_turn"
```

`context.ts` 负责在每次 API 调用前组装系统提示词——包括当前 Git 状态、`CLAUDE.md` 内容、用户记忆文件、工具列表。这是 Claude "知道"当前项目上下文的原因。

![diagram-3](/images/posts/claude-code-source/mermaid-3.png)

---

## 工具系统：40+ 内置工具

`tools.ts` 是工具注册表，`Tool.ts` 定义工具接口。完整的工具清单：

| 类别       | 工具                                                                                    |
| ---------- | --------------------------------------------------------------------------------------- |
| 文件操作   | FileEditTool、FileReadTool、FileWriteTool、GlobTool、GrepTool                           |
| Shell 执行 | BashTool、PowerShellTool                                                                |
| Web 访问   | WebFetchTool、WebSearchTool                                                             |
| 代码智能   | LSPTool、NotebookEditTool                                                               |
| Agent 编排 | AgentTool、SkillTool                                                                    |
| 任务管理   | TaskCreateTool、TaskGetTool、TaskUpdateTool、TaskListTool、TaskOutputTool、TaskStopTool |
| 规划       | EnterPlanModeTool、ExitPlanModeV2Tool                                                   |
| MCP 桥接   | ListMcpResourcesTool、ReadMcpResourceTool                                               |
| 配置       | ConfigTool、ToolSearchTool                                                              |

权限控制由 `hooks/useCanUseTool.tsx` 负责——每个工具调用都要过这里，根据用户配置的权限模式（auto / manual）决定是静默执行还是弹出确认框。

另一个值得注意的是 `utils/toolResultStorage.ts`：当工具输出很大时（比如读了几千行的文件），不会把完整内容塞进对话历史，而是存到本地，历史里只保留引用。这是控制 token 消耗的关键机制。

![diagram-4](/images/posts/claude-code-source/mermaid-4.png)

---

## 特性标志：你用的不是完整版

这是这次源码里最有意思的发现之一。

`tools.ts` 第 16–134 行有大量这样的模式：

```typescript
feature("COORDINATOR_MODE") ? require("./tools/CoordinatorTool") : null;
```

`feature()` 来自 `bun:bundle`，是**编译时**的死代码消除指令——不是运行时判断，是构建时直接把整个 `require()` 分支从包里剔掉。

这意味着同一份代码库会编译出多个不同的构建变体：

| 特性标志           | 用途                              |
| ------------------ | --------------------------------- |
| `COORDINATOR_MODE` | 多 Agent 协调器编排               |
| `KAIROS`           | 助手/主动自主模式                 |
| `PROACTIVE`        | 主动 Agent 触发（周期性自我驱动） |
| `VOICE_MODE`       | 语音输入集成                      |
| `BRIDGE_MODE`      | 移动端/远程桥接连接               |
| `AGENT_TRIGGERS`   | 基于 Cron 的定时任务执行          |
| `BG_SESSIONS`      | 后台会话管理（tmux 集成）         |
| `WEB_BROWSER_TOOL` | 嵌入式 Web 浏览器面板             |

你每天用的 Claude Code 是关掉了大部分这些标志的版本。`KAIROS`（主动自主模式）和 `COORDINATOR_MODE`（多 Agent 协调）已经在代码里了，只是没有对外开放。

---

## 子 Agent：Fork 是贯穿全局的模式

Claude Code 里有三个地方用到了 fork 子进程：

1. **子 Agent 执行**：`utils/forkedAgent.ts` 启动独立子进程跑 AgentTool
2. **自动上下文压缩**：超过 token 阈值时，fork 一个子进程做历史摘要，不阻塞主会话
3. **会话记忆提取**：每次 AI 响应后，fork 子进程提取关键信息写入 `.claude/session_memory.md`

这个模式的逻辑很清楚：主会话不能被阻塞，所以所有重型后台操作都扔给子进程。

子 Agent 的任务类型分 `local_agent` 和 `remote_agent` 两种，由 `AppState` 全局跟踪所有活动任务。自定义代理定义文件放在 `.claude/agents/`，格式是 JSON。

![diagram-5](/images/posts/claude-code-source/mermaid-5.png)

---

## 自动上下文压缩

长对话必然面临 context window 的限制。Claude Code 的解法是自动压缩（Auto Compact）。

`services/compact/autoCompact.ts` 在每次查询结束后检查 token 用量，超过阈值时触发压缩。压缩不是简单截断，而是 fork 一个独立子代理，让它对当前对话历史做摘要，生成一条"压缩边界消息"替换掉原来的历史。

Fork 子进程而不是在主进程里做压缩，好处是不阻塞主会话，用户感知不到。

![diagram-6](/images/posts/claude-code-source/mermaid-6.png)

---

## 会话记忆系统

这是一个后台服务，自动提取和维护对话的关键信息。

工作机制：每次 AI 响应后，注册的 `postSamplingHook` 触发，fork 一个独立代理提取关键信息，写入 `.claude/session_memory.md`。下次对话开始时，`memdir/memdir.ts` 读取这个文件，注入到系统提示里。

注意这个功能有 GrowthBook feature flag 门控，不一定对所有用户开放。

![diagram-7](/images/posts/claude-code-source/mermaid-7.png)

---

## 状态管理：一个 5000 行的组件

状态管理用的是类 Zustand 模式：`state/AppStateStore.ts` 维护单一不可变状态树，通过 `useAppState()` 和 `useSetAppState()` 两个 Hook 访问。

关键状态切片：

- `toolPermissionContext` — 控制模型可以使用哪些工具
- `mcp` — MCP 服务器连接与工具列表
- `tasks` — 所有后台 Agent 的状态
- `settings` — 用户偏好

`screens/REPL.tsx` 约 5000 行，是消费这个状态的核心组件，同时管理：用户输入、查询生命周期、工具权限对话框、流式输出、通知系统、会话恢复、桥接/远程连接。

把这么多逻辑放在一个文件里，在工程上是个权衡——它是整个 UI 的协调中心，拆散了反而难以维护。

---

## MCP 集成

`services/mcp/MCPConnectionManager.tsx` 管理 MCP 服务器的完整生命周期。连接建立后，通过 `listTools`、`listResources`、`listPrompts` 三个 RPC 调用发现服务器能力，缓存下来，然后通过 `tools/MCPTool/MCPTool.ts` 包装成和内置工具一样的接口。

对 Claude 来说，MCP 工具和内置工具是无差别的——统一走 `tools.ts` 注册表，统一走工具执行链路。

![diagram-8](/images/posts/claude-code-source/mermaid-8.png)

---

## 几个整体观察

读完这份代码，有几点值得记下来：

**这不是一个简单的 AI 聊天 + 工具调用**。完整的会话持久化、跨会话恢复、多 Agent 编排、编译时特性标志——工程复杂度和一个中等规模的生产系统差不多。

**Fork 子进程是核心设计决策**。主会话不能被任何后台操作阻塞，所以压缩、记忆提取、子 Agent 全部异步 fork。这个选择让系统的响应性得到了保证，但也引入了进程间通信的复杂度。

**有大量未对外开放的功能**。`KAIROS`（主动自主模式）、`COORDINATOR_MODE`（多 Agent 协调）、`BG_SESSIONS`（后台会话）、`AGENT_TRIGGERS`（定时任务）……这些代码都在里面，只是被编译时标志关掉了。

**工具系统是 first-class citizen**。权限检查、结果持久化、编排逻辑，每个环节都有专门模块处理，不是随手加上去的。

---

对想学习 Coding Agent 实现的人来说，这是一份宝藏啊！
