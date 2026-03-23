---
title: "LangChain 踩坑合集：那些让我头疼的问题"
date: "2023-11-08"
draft: false
tags: ["LangChain", "踩坑", "Python"]
categories: ["AI 应用"]
description: "用 LangChain 搭了几个项目之后，积累了一些坑。这篇文章做个整理，希望能帮你少走弯路。"
---

LangChain 的迭代速度极快，API 经常变，文档跟不上代码。这篇文章记录我踩过的一些有代表性的坑。

## 坑 1：版本兼容性

LangChain 把包拆分了，以前的 `langchain` 现在分成了：

- `langchain-core`：核心抽象
- `langchain`：主包
- `langchain-community`：第三方集成
- `langchain-openai`、`langchain-anthropic` 等：各家模型的独立包

很多旧教程的 import 路径在新版本里已经不对了：

```python
# 旧写法（可能报 ImportError）
from langchain.chat_models import ChatOpenAI

# 新写法
from langchain_openai import ChatOpenAI
```

**解决办法**：固定版本，或者直接看报错信息里的迁移提示。

## 坑 2：ConversationBufferMemory 在 LCEL 里不能直接用

从旧版 Chain API 迁移到 LCEL 时，发现旧的 Memory 类不能直接套用：

```python
# LCEL 里需要手动管理历史
from langchain_core.messages import HumanMessage, AIMessage

history = []

def chat(user_input: str) -> str:
    history.append(HumanMessage(content=user_input))
    response = chain.invoke({"messages": history})
    history.append(AIMessage(content=response))
    return response
```

LCEL 更偏向函数式，状态管理需要自己来。

## 坑 3：Chroma 持久化

```python
# 错误：每次都重建 vectorstore，已有的数据被覆盖
vectorstore = Chroma.from_documents(docs, embeddings, persist_directory="./db")

# 正确：已有数据库直接加载
import os
if os.path.exists("./db"):
    vectorstore = Chroma(persist_directory="./db", embedding_function=embeddings)
else:
    vectorstore = Chroma.from_documents(docs, embeddings, persist_directory="./db")
```

## 坑 4：输出解析器的错误处理

LLM 偶尔会输出格式不符合预期的内容，导致解析器报错：

```python
from langchain.output_parsers import PydanticOutputParser
from langchain_core.output_parsers import StrOutputParser

# 加上 with_fallbacks，解析失败时回退到字符串输出
parser = PydanticOutputParser(pydantic_object=MyModel)
safe_parser = parser.with_fallbacks([StrOutputParser()])
```

## 坑 5：异步调用的坑

```python
# 在 Jupyter 里，event loop 已经在跑，不能用 asyncio.run()
# 改用 await 或者 nest_asyncio

import nest_asyncio
nest_asyncio.apply()

result = asyncio.run(chain.ainvoke({"input": "test"}))
```

## 总结

LangChain 的问题核心是**抽象太多、变化太快**。我现在的策略是：简单场景直接调 SDK，复杂场景才引入 LangChain，而且只用它的底层组件（LCEL + Retriever），尽量避免用高层的 Chain 封装。
