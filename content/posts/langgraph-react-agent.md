---
title: "LangGraph 实战：构建一个可控的 ReAct Agent"
date: "2024-11-18"
draft: false
tags: ["LangGraph", "Agent", "ReAct", "Python"]
categories: ["AI Agent"]
description: "ReAct 是目前最主流的 Agent 范式。这篇文章用 LangGraph 从零实现一个生产可用的 ReAct Agent，重点讲如何做流程控制和错误处理。"
---

ReAct（Reasoning + Acting）是让 Agent 先思考再行动的范式。这篇文章用 LangGraph 实现一个完整的 ReAct Agent，并加入一些生产环境需要的工程细节。

## ReAct 的执行流程

```
用户输入
  ↓
思考（Thought）：分析问题，决定下一步
  ↓
行动（Action）：选择并调用工具
  ↓
观察（Observation）：获取工具结果
  ↓
循环，直到能给出最终答案
  ↓
最终答案
```

## 用 LangGraph 实现

```python
from typing import TypedDict, Annotated
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
import operator

class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], operator.add]
    iteration: int  # 防止无限循环

# 初始化 LLM（绑定工具）
llm = ChatOpenAI(model="gpt-4o", temperature=0)
llm_with_tools = llm.bind_tools(tools)

def should_continue(state: AgentState) -> str:
    """决定下一步走哪条边"""
    last_message = state["messages"][-1]

    # 超出最大迭代次数，强制结束
    if state["iteration"] >= 10:
        return "end"

    # 最后一条消息没有工具调用，说明已经有最终答案了
    if not hasattr(last_message, "tool_calls") or not last_message.tool_calls:
        return "end"

    return "tools"

def call_llm(state: AgentState) -> AgentState:
    """调用 LLM 节点"""
    response = llm_with_tools.invoke(state["messages"])
    return {
        "messages": [response],
        "iteration": state["iteration"] + 1
    }

def call_tools(state: AgentState) -> AgentState:
    """执行工具调用节点"""
    last_message = state["messages"][-1]
    tool_messages = []

    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]

        try:
            result = tool_registry[tool_name].invoke(tool_args)
            content = str(result)
        except Exception as e:
            content = f"工具调用失败：{str(e)}"  # 错误不崩溃，反馈给模型

        tool_messages.append(ToolMessage(
            content=content,
            tool_call_id=tool_call["id"]
        ))

    return {"messages": tool_messages}

# 构建图
graph = StateGraph(AgentState)
graph.add_node("llm", call_llm)
graph.add_node("tools", call_tools)

graph.set_entry_point("llm")
graph.add_conditional_edges("llm", should_continue, {"tools": "tools", "end": END})
graph.add_edge("tools", "llm")  # 工具执行完，回到 LLM 节点

agent = graph.compile()
```

## 加入 Human-in-the-loop

LangGraph 支持在某些步骤暂停，等待人工确认：

```python
from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()
agent = graph.compile(
    checkpointer=checkpointer,
    interrupt_before=["tools"]  # 每次调用工具前暂停
)

# 第一次运行，在工具调用前暂停
config = {"configurable": {"thread_id": "session-1"}}
result = agent.invoke({"messages": [HumanMessage("帮我删除 /tmp 目录下所有文件")], "iteration": 0}, config)

# 查看 Agent 想做什么
print(result["messages"][-1].tool_calls)
# [{"name": "bash", "args": {"command": "rm -rf /tmp/*"}}]

# 人工确认后继续（或拒绝）
user_confirm = input("确认执行？(y/n): ")
if user_confirm == "y":
    agent.invoke(None, config)  # 传 None 表示从断点继续
```

对于涉及写操作的工具，human-in-the-loop 是生产环境的必要安全措施。

## 流式输出

```python
for event in agent.stream(
    {"messages": [HumanMessage("查询北京今天的天气")], "iteration": 0},
    stream_mode="values"
):
    last_msg = event["messages"][-1]
    if hasattr(last_msg, "content") and last_msg.content:
        print(last_msg.content, end="", flush=True)
```

## 小结

LangGraph 的核心价值在于**把 Agent 的执行流程变成可观测、可控制的图**。`should_continue` 函数是整个 Agent 的决策核心，所有的流程控制（最大迭代、错误处理、人工介入）都在这里实现。这比用黑盒框架要透明得多。
