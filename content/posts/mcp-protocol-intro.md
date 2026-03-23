---
title: "MCP 协议入门：给 AI Agent 装上标准化工具接口"
date: "2025-04-15"
draft: false
tags: ["MCP", "Agent", "Claude", "工具调用"]
categories: ["AI Agent"]
description: "Anthropic 推出的 MCP（Model Context Protocol）协议正在成为 AI Agent 工具集成的新标准。这篇文章介绍它解决了什么问题以及如何上手。"
---

2024 年底，Anthropic 开源了 MCP（Model Context Protocol），一个让 AI 模型与外部工具、数据源交互的标准化协议。2025 年以来，越来越多的工具和平台开始支持 MCP。

## MCP 解决了什么问题

在 MCP 之前，每个 AI 应用都要自己实现工具集成：

```
应用 A → 自己写 Google Drive 集成
应用 B → 自己写 Google Drive 集成
应用 C → 自己写 Google Drive 集成
```

有了 MCP：

```
Google Drive MCP Server（写一次）
    ↓
应用 A、B、C 都能直接接
```

MCP 是一个**客户端-服务端协议**，AI 应用是客户端，工具提供方实现 MCP Server。

## 核心概念

MCP Server 可以暴露三种东西：

- **Tools**：模型可以调用的函数（类似 Function Calling）
- **Resources**：模型可以读取的数据（文件、数据库等）
- **Prompts**：预定义的 Prompt 模板

## 用 Python 写一个最简 MCP Server

```python
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

app = Server("my-tools")

@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="get_time",
            description="获取当前时间",
            inputSchema={
                "type": "object",
                "properties": {
                    "timezone": {
                        "type": "string",
                        "description": "时区，如 Asia/Shanghai"
                    }
                }
            }
        )
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "get_time":
        from datetime import datetime
        import pytz
        tz = pytz.timezone(arguments.get("timezone", "Asia/Shanghai"))
        now = datetime.now(tz)
        return [types.TextContent(type="text", text=now.strftime("%Y-%m-%d %H:%M:%S %Z"))]

async def main():
    async with stdio_server() as streams:
        await app.run(*streams, app.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

## 在 Claude Desktop 里使用

在 `~/Library/Application Support/Claude/claude_desktop_config.json` 里配置：

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "uv",
      "args": ["run", "python", "/path/to/your/server.py"]
    }
  }
}
```

重启 Claude Desktop，就能看到你的工具出现在工具列表里。

## MCP vs Function Calling

| | Function Calling | MCP |
|---|---|---|
| 工具定义位置 | 在 API 请求里 | 独立的 Server 进程 |
| 复用性 | 每个应用自己维护 | 一个 Server 多个应用共用 |
| 传输协议 | HTTP | stdio / SSE |
| 生态 | 各家不同 | 标准化，跨模型、跨应用 |

## 小结

MCP 的价值在于标准化。如果你在维护自己的工具集，值得考虑包装成 MCP Server，这样它就能被所有支持 MCP 的客户端复用。
