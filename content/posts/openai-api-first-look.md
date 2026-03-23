---
title: "OpenAI API 初体验：ChatGPT 背后的接口是什么样的"
date: "2022-12-10"
draft: false
tags: ["OpenAI", "LLM", "API"]
categories: ["AI 应用"]
description: "ChatGPT 发布后，很多工程师开始关注 OpenAI API。这篇文章记录我第一次接入 OpenAI API 的过程和一些基础认知。"
---

2022 年 11 月底，ChatGPT 上线，刷屏了所有技术圈的朋友圈。作为工程师，第一反应自然是——这东西能怎么用在项目里？

## 基础概念

OpenAI 的核心接口是 **Chat Completions API**，接受一个消息列表，返回模型的回复。

```python
from openai import OpenAI

client = OpenAI(api_key="your-api-key")

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "system", "content": "你是一个 Python 专家"},
        {"role": "user", "content": "解释一下 Python 的 GIL"}
    ]
)

print(response.choices[0].message.content)
```

消息列表里有三种角色：

- `system`：给模型设定人格和行为准则
- `user`：用户输入
- `assistant`：模型历史回复（多轮对话时需要带上）

## Token 是什么

模型按 **token** 计费，而不是按字符。英文大约 4 个字符 = 1 token，中文大约 1-2 个字符 = 1 token。

```python
# 用 tiktoken 计算 token 数
import tiktoken

enc = tiktoken.encoding_for_model("gpt-3.5-turbo")
tokens = enc.encode("Hello, world!")
print(len(tokens))  # 4
```

`max_tokens` 控制回复的最大长度，`temperature` 控制随机性（0 最确定，2 最随机）。

## 多轮对话的实现

模型本身是无状态的，多轮对话需要客户端维护历史消息：

```python
history = []

def chat(user_input):
    history.append({"role": "user", "content": user_input})

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=history
    )

    reply = response.choices[0].message.content
    history.append({"role": "assistant", "content": reply})
    return reply
```

历史越长，消耗的 token 越多，成本越高。实际项目里需要做历史截断或摘要。

## 初步感受

和传统 NLP 模型相比，LLM 最大的不同是**泛化能力极强**，同一个接口可以做问答、总结、翻译、代码生成……这让应用层的开发逻辑发生了根本变化。
