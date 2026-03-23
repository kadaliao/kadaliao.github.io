---
title: "向量数据库横评：Chroma vs Pinecone vs Weaviate vs Milvus"
date: "2023-10-30"
draft: false
tags: ["向量数据库", "Chroma", "Pinecone", "Milvus", "RAG"]
categories: ["AI 应用"]
description: "向量数据库是 RAG 系统的核心存储组件。这篇文章从工程角度对比几个主流选项，帮你选出适合的方案。"
---

做 RAG 系统绕不开向量数据库的选型。这篇文章从工程角度做个横评。

## 核心功能对比

| | Chroma | Pinecone | Weaviate | Milvus |
|---|---|---|---|---|
| 部署方式 | 本地/云 | 纯云服务 | 本地/云 | 本地/云 |
| 开源 | ✓ | ✗ | ✓ | ✓ |
| Python SDK | ✓ | ✓ | ✓ | ✓ |
| 混合检索 | 部分 | ✓ | ✓ | ✓ |
| 适合规模 | 小-中 | 中-大 | 中-大 | 大 |

## Chroma：本地开发首选

```python
import chromadb

client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_or_create_collection(
    name="my_docs",
    metadata={"hnsw:space": "cosine"}
)

# 添加文档
collection.add(
    documents=["RAG 是检索增强生成", "向量数据库存储高维向量"],
    ids=["doc1", "doc2"]
)

# 查询
results = collection.query(
    query_texts=["什么是检索增强？"],
    n_results=3
)
```

**适合场景**：本地开发、原型验证、数据量 < 100 万条。

**优点**：零配置启动，和 LangChain 深度集成。
**缺点**：性能和功能不适合大规模生产。

## Pinecone：托管云服务

```python
from pinecone import Pinecone, ServerlessSpec

pc = Pinecone(api_key="your-key")
pc.create_index(
    name="my-index",
    dimension=1536,
    metric="cosine",
    spec=ServerlessSpec(cloud="aws", region="us-east-1")
)

index = pc.Index("my-index")

# 插入向量
index.upsert(vectors=[
    ("id1", [0.1, 0.2, ...], {"text": "原始文本", "source": "doc.pdf"}),
])

# 查询
results = index.query(
    vector=[0.1, 0.2, ...],
    top_k=5,
    filter={"source": "doc.pdf"},  # 元数据过滤
    include_metadata=True
)
```

**适合场景**：不想运维、快速上线、预算充足。

**优点**：全托管，运维成本为零，性能有保障。
**缺点**：按用量收费，数据存在第三方，有隐私顾虑。

## Milvus：大规模生产首选

```python
from pymilvus import connections, Collection, FieldSchema, CollectionSchema, DataType

connections.connect(host="localhost", port="19530")

# 定义 schema
fields = [
    FieldSchema(name="id", dtype=DataType.INT64, is_primary=True),
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=1536),
    FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=65535),
]
schema = CollectionSchema(fields=fields)
collection = Collection("my_docs", schema=schema)

# 建索引
collection.create_index(
    field_name="embedding",
    index_params={"metric_type": "COSINE", "index_type": "HNSW", "params": {"M": 8, "efConstruction": 64}}
)

# 查询
collection.load()
results = collection.search(
    data=[query_vector],
    anns_field="embedding",
    param={"metric_type": "COSINE", "params": {"ef": 64}},
    limit=10,
    output_fields=["text"]
)
```

**适合场景**：亿级向量、需要自部署、高性能要求。

**优点**：开源、高性能、功能完整（支持混合检索、多向量等）。
**缺点**：部署和运维复杂，需要 Kubernetes 或专门的运维能力。

## 我的选型建议

```
开发阶段      →  Chroma（零成本，快速验证）
小型生产      →  Pinecone（托管省心）或 Weaviate（开源，功能强）
大规模生产    →  Milvus（自部署，成本可控）
有数据隐私要求 →  Milvus 或 Weaviate（私有部署）
```

**一个常见误区**：很多人在原型阶段用 Chroma，上线时直接迁到 Pinecone，结果发现元数据结构、过滤语法都不一样，改动不小。建议从一开始就根据最终目标选型，或者用 LangChain 的抽象层来隔离底层差异。
