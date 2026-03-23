---
title: "RAG 系统从零搭建：检索增强生成的原理与实践"
date: "2023-08-15"
draft: false
tags: ["RAG", "向量数据库", "LLM", "Python"]
categories: ["AI 应用"]
description: "RAG 是目前解决 LLM 知识局限性最主流的方案。这篇文章从原理出发，完整实现一个最小可用的 RAG 系统。"
---

LLM 有两个核心局限：知识有截止日期、无法访问私有数据。RAG（Retrieval-Augmented Generation）是目前解决这两个问题最主流的方案。

## RAG 的基本流程

```
文档 → 切块 → Embedding → 存入向量库
                                ↓
用户问题 → Embedding → 向量检索 → 召回相关块 → 组合 Prompt → LLM → 回答
```

四个核心步骤：**文档处理**、**向量化**、**检索**、**生成**。

## 文档切块

文档太长无法直接塞给模型，需要切成小块：

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,  # 相邻块有重叠，避免信息割裂
    separators=["\n\n", "\n", "。", "，", " "]
)

chunks = splitter.split_documents(docs)
```

`chunk_overlap` 是个容易忽略的参数——它让相邻的块有内容重叠，避免一句话被硬切断导致语义丢失。

## Embedding 与向量存储

```python
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# 将文档块向量化并存入 Chroma
vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    persist_directory="./chroma_db"
)
```

向量数据库本质是做高维空间的近邻搜索。Chroma 适合本地开发，生产环境可以考虑 Pinecone、Weaviate 或自建 Milvus。

## 检索与生成

```python
from langchain.chains import RetrievalQA

retriever = vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 4}  # 召回最相关的 4 个块
)

qa_chain = RetrievalQA.from_chain_type(
    llm=ChatOpenAI(model="gpt-3.5-turbo"),
    retriever=retriever,
    return_source_documents=True
)

result = qa_chain.invoke({"query": "公司的请假政策是什么？"})
print(result["result"])
```

## 几个影响效果的关键点

**切块策略**：`chunk_size` 太小，单块缺乏上下文；太大，引入噪声。通常 300-600 tokens 是个比较合适的范围。

**Embedding 模型选择**：`text-embedding-3-small` 性价比高，中文场景也可以考虑 BGE 系列开源模型。

**召回数量 k**：k 越大召回越全但噪声越多。可以先召回多一点，再用 reranker 重排序。

**Prompt 设计**：明确告诉模型"只根据以下材料回答，材料中没有的不要编造"，能显著减少幻觉。

## 小结

RAG 的上限在于检索质量。生成的问题好解决，检索的问题才是核心挑战。后续文章会深入讲检索优化的各种技巧。
