---
title: "Embedding 模型选型：OpenAI vs BGE vs 其他开源方案"
date: "2023-06-12"
draft: false
tags: ["Embedding", "向量化", "RAG", "BGE", "OpenAI"]
categories: ["AI 应用"]
description: "RAG 系统里 Embedding 模型的选择直接影响检索质量。这篇文章对比几个主流方案的效果、成本和部署方式。"
---

在做 RAG 系统时，Embedding 模型的选型是个绕不过去的问题。选错了，后面调再多参数也是事倍功半。

## 什么是 Embedding

Embedding 模型把文本转成高维向量，语义相近的文本在向量空间里距离更近。RAG 的检索质量，本质上取决于 Embedding 模型对语义的理解能力。

## OpenAI text-embedding 系列

```python
from openai import OpenAI
client = OpenAI()

response = client.embeddings.create(
    model="text-embedding-3-small",  # 或 text-embedding-3-large
    input="什么是 RAG 系统？"
)
vector = response.data[0].embedding  # 1536 维向量
```

**text-embedding-3-small**：
- 维度：1536
- 价格：$0.02 / 1M tokens
- 性价比最高，大多数场景足够用

**text-embedding-3-large**：
- 维度：3072
- 价格：$0.13 / 1M tokens
- 效果更好，但贵 6 倍，仅在对检索质量要求极高时考虑

**优点**：接口简单，效果稳定，中英文都好。
**缺点**：按量计费，数据需要发到 OpenAI，有隐私顾虑。

## BGE 系列（智源）

[BGE](https://github.com/FlagAI-Open/FlagEmbedding)（BAAI General Embedding）是智源研究院开源的中文 Embedding 模型，中文效果出色：

```python
from FlagEmbedding import FlagModel

model = FlagModel(
    "BAAI/bge-large-zh-v1.5",
    query_instruction_for_retrieval="为这个句子生成表示以用于检索相关文章：",
    use_fp16=True
)

# 对查询加 instruction（重要！BGE 的查询和文档编码方式不同）
query_embedding = model.encode_queries(["什么是 RAG？"])

# 文档不需要 instruction
doc_embeddings = model.encode(["RAG 是检索增强生成..."])
```

**BGE-large-zh-v1.5**：
- 维度：1024
- 本地部署，零使用成本
- 中文效果优于 OpenAI（在中文基准测试上）

**缺点**：需要 GPU 或高配 CPU，首次部署有门槛；英文效果不如 OpenAI。

## 用 sentence-transformers 的通用方式

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("BAAI/bge-large-zh-v1.5")
embeddings = model.encode(["文本1", "文本2"], normalize_embeddings=True)
```

sentence-transformers 支持大量模型，接口统一，方便切换。

## Jina Embeddings

Jina AI 的 `jina-embeddings-v3` 支持超长文本（8192 tokens），适合文档较长的场景：

```python
from openai import OpenAI  # Jina 兼容 OpenAI API 格式

client = OpenAI(
    api_key="jina-xxx",
    base_url="https://api.jina.ai/v1"
)

response = client.embeddings.create(
    model="jina-embeddings-v3",
    input=["很长的文档..."]
)
```

## 选型建议

| 场景 | 推荐 |
|------|------|
| 快速原型、英文为主 | text-embedding-3-small |
| 中文为主、有隐私要求 | BGE-large-zh-v1.5 |
| 文档很长（>2000 tokens）| Jina v3 |
| 生产环境、中英混合 | text-embedding-3-small（成本可接受时）|

**一个重要提醒**：Embedding 模型一旦选定，向量库里的数据就和这个模型绑定了。换模型意味着要重新向量化所有文档，成本很高。选型要慎重，建议先在小数据集上评测效果再决定。
