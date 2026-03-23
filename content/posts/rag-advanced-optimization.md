---
title: "RAG 进阶优化：提升检索质量的七个方向"
date: "2024-05-22"
draft: false
tags: ["RAG", "检索优化", "Reranker", "HyDE", "LLM"]
categories: ["AI 应用"]
description: "基础 RAG 搭起来不难，但要做到检索质量高、回答准确，需要在多个环节下功夫。这篇文章梳理七个常见的优化方向。"
---

[上一篇文章](/posts/rag-from-scratch/)介绍了基础 RAG 的搭建。基础 RAG 跑起来之后，你会发现效果差强人意——召回的内容不够准、回答有时候答非所问。这篇文章梳理提升 RAG 效果的常见优化方向。

## 方向 1：切块策略优化

基础的固定大小切块太粗糙，几个更好的策略：

**按语义切块（Semantic Chunking）**：

```python
from langchain_experimental.text_splitter import SemanticChunker
from langchain_openai import OpenAIEmbeddings

splitter = SemanticChunker(
    OpenAIEmbeddings(),
    breakpoint_threshold_type="percentile"
)
chunks = splitter.split_text(document)
```

语义切块基于 Embedding 相似度判断段落边界，比按字符数切更合理。

**父子文档（Parent-Child）**：小块用于检索，大块用于生成：

```python
from langchain.retrievers import ParentDocumentRetriever

retriever = ParentDocumentRetriever(
    vectorstore=vectorstore,
    docstore=InMemoryStore(),
    child_splitter=RecursiveCharacterTextSplitter(chunk_size=200),
    parent_splitter=RecursiveCharacterTextSplitter(chunk_size=2000),
)
```

小块召回精准，但上下文不足；大块提供足够上下文，但噪声多。父子文档两全其美。

## 方向 2：Query 改写

用户的提问往往不是最优的检索 query：

```python
async def rewrite_query(query: str) -> list[str]:
    prompt = f"""
    生成 3 个不同角度的检索查询，帮助从文档库中找到回答以下问题的信息。
    原始问题：{query}
    输出格式：每行一个查询
    """
    response = await llm.ainvoke(prompt)
    queries = response.content.strip().split("\n")
    return [query] + queries  # 原始查询 + 改写的查询
```

用多个 query 检索，再合并去重，召回率显著提升。

## 方向 3：HyDE（假设文档嵌入）

让模型先生成一个"假设的答案文档"，用它来检索：

```python
async def hyde_retrieve(query: str) -> list[Document]:
    # 让模型生成一个假设的答案
    hypothetical_doc = await llm.ainvoke(
        f"写一段简短的文章，回答以下问题（即使你不确定）：{query}"
    )

    # 用假设答案的向量来检索，而不是用问题的向量
    docs = vectorstore.similarity_search(hypothetical_doc.content, k=4)
    return docs
```

假设答案的 Embedding 比问题的 Embedding 更接近文档的分布，检索效果往往更好。

## 方向 4：Reranker 重排序

向量检索召回的结果不一定按相关性排好序，用 Reranker 做二次排序：

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("BAAI/bge-reranker-large")

def rerank(query: str, docs: list[Document], top_k: int = 3) -> list[Document]:
    pairs = [(query, doc.page_content) for doc in docs]
    scores = reranker.predict(pairs)

    ranked = sorted(zip(scores, docs), key=lambda x: x[0], reverse=True)
    return [doc for _, doc in ranked[:top_k]]

# 先召回多一些，再 rerank 取 top k
candidates = vectorstore.similarity_search(query, k=20)
final_docs = rerank(query, candidates, top_k=4)
```

Reranker 是 Cross-Encoder，比向量检索（Bi-Encoder）精度高，但速度慢，所以用在召回之后。

## 方向 5：混合检索（Hybrid Search）

纯向量检索对精确关键词匹配效果差（比如产品型号、人名），结合 BM25：

```python
from langchain.retrievers import EnsembleRetriever
from langchain_community.retrievers import BM25Retriever

bm25_retriever = BM25Retriever.from_documents(docs, k=4)
vector_retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

hybrid_retriever = EnsembleRetriever(
    retrievers=[bm25_retriever, vector_retriever],
    weights=[0.4, 0.6]  # BM25 占 40%，向量检索占 60%
)
```

## 方向 6：上下文压缩

召回的文档可能包含大量和问题无关的内容，用 LLM 压缩：

```python
from langchain.retrievers.document_compressors import LLMChainExtractor
from langchain.retrievers import ContextualCompressionRetriever

compressor = LLMChainExtractor.from_llm(llm)
compression_retriever = ContextualCompressionRetriever(
    base_compressor=compressor,
    base_retriever=retriever
)
# 返回的文档只保留和问题相关的部分
```

## 方向 7：评估体系

优化要有数据支撑，推荐用 RAGAS 评估框架：

```python
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision

result = evaluate(
    dataset=eval_dataset,  # 包含 question, answer, contexts, ground_truth
    metrics=[faithfulness, answer_relevancy, context_precision]
)
print(result)
# faithfulness: 0.85（回答是否基于上下文）
# answer_relevancy: 0.78（回答是否切题）
# context_precision: 0.72（召回的上下文是否精准）
```

有了评估指标，才能知道每次优化是否真的有效。

## 优化优先级建议

根据我的经验，投入产出比从高到低大概是：
1. Reranker（效果提升明显，实现简单）
2. 混合检索（对关键词敏感的场景立竿见影）
3. Query 改写（召回率提升显著）
4. 切块策略（需要针对具体文档类型调整）
5. HyDE（在某些场景效果好，不是万能的）
