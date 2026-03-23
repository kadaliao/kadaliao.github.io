---
title: "Agent 框架横评：LangGraph vs AutoGen vs CrewAI"
date: "2024-09-10"
draft: false
tags: ["Agent", "LangGraph", "AutoGen", "CrewAI", "框架对比"]
categories: ["AI Agent"]
description: "2024 年 Agent 框架百花齐放，LangGraph、AutoGen、CrewAI 各有侧重。这篇文章从工程角度做一个横评。"
---

2024 年，Agent 框架的竞争进入白热化阶段。我在几个项目里分别用过 LangGraph、AutoGen 和 CrewAI，这篇文章做一个工程视角的横评。

## 三者定位

| 框架 | 核心定位 | 适合场景 |
|------|---------|---------|
| LangGraph | 有状态的图执行引擎 | 需要精确控制流程的复杂 Agent |
| AutoGen | Multi-Agent 对话框架 | 多个 Agent 协作解决问题 |
| CrewAI | 角色扮演式 Multi-Agent | 任务分工明确的团队协作场景 |

## LangGraph

LangGraph 是 LangChain 团队推出的，把 Agent 的执行流程建模成一个**有向图**。

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict

class AgentState(TypedDict):
    messages: list
    next_step: str

def agent_node(state: AgentState):
    # 调用 LLM 决策下一步
    ...
    return {"next_step": "tool" if needs_tool else "end"}

def tool_node(state: AgentState):
    # 执行工具
    ...
    return {"messages": [...]}

graph = StateGraph(AgentState)
graph.add_node("agent", agent_node)
graph.add_node("tool", tool_node)
graph.add_edge("tool", "agent")
graph.add_conditional_edges("agent", lambda s: s["next_step"])
```

**优点**：流程完全可控，支持循环、分支、人工介入（human-in-the-loop），适合生产环境。

**缺点**：上手成本高，要理解图的概念；代码相对冗长。

## AutoGen

AutoGen 是微软出的，核心是让多个 Agent 通过**对话**协作：

```python
from autogen import AssistantAgent, UserProxyAgent

assistant = AssistantAgent(
    name="助手",
    llm_config={"model": "gpt-4o"}
)

user_proxy = UserProxyAgent(
    name="用户",
    human_input_mode="NEVER",  # 全自动
    code_execution_config={"work_dir": "workspace"}
)

user_proxy.initiate_chat(
    assistant,
    message="帮我写一个爬虫，抓取 Hacker News 首页"
)
```

**优点**：能自动执行代码，适合需要写代码解决问题的场景。

**缺点**：对话流程不可控，生产环境风险高；AutoGen 2.0 改动较大，生态还在重建。

## CrewAI

CrewAI 的抽象是"角色"和"任务"，更贴近人类团队协作的思维模型：

```python
from crewai import Agent, Task, Crew

researcher = Agent(
    role="研究员",
    goal="深入研究给定主题",
    backstory="你是一个擅长信息收集的研究专家",
    tools=[search_tool]
)

writer = Agent(
    role="写作者",
    goal="把研究结果写成清晰的文章",
    backstory="你是一个技术写作专家"
)

research_task = Task(description="研究 RAG 最新进展", agent=researcher)
write_task = Task(description="根据研究结果写一篇博客", agent=writer)

crew = Crew(agents=[researcher, writer], tasks=[research_task, write_task])
result = crew.kickoff()
```

**优点**：上手最快，代码最简洁，适合快速原型。

**缺点**：底层控制弱，调试困难，复杂流程难以实现。

## 选型建议

- **生产环境、复杂流程**：LangGraph，可控性最强
- **代码执行、研究型任务**：AutoGen
- **快速验证想法**：CrewAI

我个人现在在生产项目里主要用 LangGraph，原型阶段用 CrewAI 快速验证。
