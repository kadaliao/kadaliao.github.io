---
title: "Function Calling 实战：让 LLM 学会调用工具"
date: "2024-02-20"
draft: false
tags: ["Function Calling", "OpenAI", "Agent", "Python"]
categories: ["AI Agent"]
description: "Function Calling 是构建 AI Agent 的基础能力。这篇文章通过实例讲清楚它的工作原理和工程实现。"
---

Function Calling（现在 OpenAI 叫 Tool Use）是让 LLM 从"聊天机器人"变成"能干活的 Agent"的关键能力。

## 核心原理

Function Calling 的本质是：你告诉模型"你可以调用这些函数"，模型在需要时会输出一个结构化的"我要调用 X 函数，参数是 Y"，然后**由你的代码**真正去执行这个函数，把结果再传给模型。

模型本身不执行任何代码，它只负责"决策"。

## 最简示例

```python
from openai import OpenAI
import json

client = OpenAI()

# 定义工具
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的天气",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称，如：北京、上海"
                    }
                },
                "required": ["city"]
            }
        }
    }
]

# 实际的工具函数
def get_weather(city: str) -> str:
    # 这里接真实天气 API
    return f"{city}今天晴，25°C"

messages = [{"role": "user", "content": "北京今天天气怎么样？"}]

response = client.chat.completions.create(
    model="gpt-4o",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

# 判断是否要调用工具
message = response.choices[0].message
if message.tool_calls:
    tool_call = message.tool_calls[0]
    args = json.loads(tool_call.function.arguments)

    # 执行工具
    result = get_weather(**args)

    # 把结果传回给模型
    messages.append(message)
    messages.append({
        "role": "tool",
        "tool_call_id": tool_call.id,
        "content": result
    })

    final_response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages
    )
    print(final_response.choices[0].message.content)
```

## 多工具调度

模型可以在一次回复里调用多个工具（parallel tool calling）：

```python
# gpt-4o 支持并行调用多个工具
# response.choices[0].message.tool_calls 可能有多个元素
for tool_call in message.tool_calls:
    func_name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)
    result = tool_registry[func_name](**args)
    # 每个调用都需要对应一条 tool 消息
```

## 工程注意事项

**工具描述要写好**：模型根据 `description` 决定调用哪个工具、何时调用。描述越清晰，决策越准。

**参数校验**：`json.loads()` 可能失败，模型输出的参数不一定完全符合 schema，要做好异常处理。

**工具数量**：工具太多会稀释模型的注意力，影响调用准确率。建议单次请求工具数量控制在 10 个以内。

**`tool_choice` 参数**：
- `"auto"`：模型自主决定是否调用
- `"required"`：强制调用至少一个工具
- `{"type": "function", "function": {"name": "xxx"}}`：强制调用指定工具

## 小结

Function Calling 是 Agent 的基础能力。理解它的工作流程（模型决策 → 代码执行 → 结果回传），是构建更复杂 Agent 系统的前提。
