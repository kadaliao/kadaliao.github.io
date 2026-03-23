---
title: "LangChain 入门：用 Python 构建你的第一个 LLM 应用"
date: "2023-03-20"
draft: false
tags: ["LangChain", "LLM", "Python"]
categories: ["AI 应用"]
description: "LangChain 是目前最流行的 LLM 应用开发框架，这篇文章介绍它的核心概念和基础用法。"
---

2023 年初，LangChain 在 GitHub 上的星数以惊人的速度增长，一夜之间成为 LLM 应用开发的标配。这篇文章梳理一下它的核心设计和基础用法。

## 为什么需要 LangChain

直接调用 OpenAI API 能做很多事，但当应用变复杂时，你会发现需要反复造轮子：

- 多轮对话的历史管理
- Prompt 模板化
- 链式调用多个 LLM 步骤
- 连接外部数据源

LangChain 把这些封装成了可组合的组件。

## 核心概念

### Chain

Chain 是 LangChain 的核心抽象，把多个操作串联起来：

```python
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-3.5-turbo")

prompt = PromptTemplate(
    input_variables=["topic"],
    template="用 3 句话解释{topic}，面向初学者"
)

chain = LLMChain(llm=llm, prompt=prompt)
result = chain.invoke({"topic": "向量数据库"})
print(result["text"])
```

### Memory

Memory 组件负责维护对话历史：

```python
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationChain

memory = ConversationBufferMemory()
conversation = ConversationChain(llm=llm, memory=memory)

conversation.predict(input="我叫 Kada")
conversation.predict(input="你还记得我叫什么吗？")  # 能记住
```

### Document Loaders

加载外部文档，是构建 RAG 的基础：

```python
from langchain_community.document_loaders import TextLoader, PyPDFLoader

# 加载文本文件
loader = TextLoader("./doc.txt", encoding="utf-8")
docs = loader.load()

# 加载 PDF
pdf_loader = PyPDFLoader("./report.pdf")
pages = pdf_loader.load_and_split()
```

## LCEL：新的链式语法

LangChain 0.1 之后推荐用 LCEL（LangChain Expression Language）写链：

```python
from langchain_core.output_parsers import StrOutputParser

chain = prompt | llm | StrOutputParser()
result = chain.invoke({"topic": "向量数据库"})
```

`|` 管道符把组件串起来，比旧的 `LLMChain` 更直观。

## 一点感受

LangChain 的抽象层次有时候太重了，简单任务反而不如直接调 API。但在构建复杂流程（尤其是 RAG）时，它提供的脚手架确实能节省大量时间。
