---
title: "Python 虚拟环境管理：从 venv 到 uv"
date: "2021-10-05"
draft: false
tags: ["Python", "虚拟环境", "uv", "工程化", "包管理"]
categories: ["Python 工程"]
description: "Python 的包管理一直是槽点。这篇文章梳理从 virtualenv 到 uv 的演变，以及我现在推荐的工作流。"
---

Python 的包管理历史是一部混乱史。这篇文章梳理一下各种工具的演变，以及我现在的实践选择。

## 为什么需要虚拟环境

不同项目依赖不同版本的库。不用虚拟环境，所有包都装在系统 Python 里，版本冲突是迟早的事：

```
项目 A：需要 Django 3.2
项目 B：需要 Django 4.2
→ 只能装一个，两个项目不能同时开发
```

虚拟环境为每个项目创建独立的 Python 环境，依赖互不干扰。

## 各种工具的演变

### venv（Python 3.3+ 内置）

```bash
python -m venv .venv
source .venv/bin/activate   # macOS/Linux
.venv\Scripts\activate      # Windows

pip install requests
pip freeze > requirements.txt
```

最基础，不需要额外安装，但功能简单，`requirements.txt` 不区分开发依赖和生产依赖。

### virtualenv + pip-tools

```bash
pip install pip-tools

# requirements.in（只写直接依赖）
requests>=2.28
flask>=2.0

# 生成锁定版本的 requirements.txt
pip-compile requirements.in

# 安装
pip-sync requirements.txt
```

`pip-compile` 解决了依赖锁定的问题，是很长一段时间内的最佳实践。

### Poetry

```bash
poetry new my-project
poetry add requests
poetry add pytest --group dev
poetry install

# pyproject.toml 管理所有配置
```

Poetry 把依赖管理、打包、发布整合在一起，`pyproject.toml` 是单一配置文件。问题是速度慢，解析依赖时间长。

### uv（当前推荐）

[uv](https://github.com/astral-sh/uv) 是 Astral（Ruff 的团队）用 Rust 写的，速度快了 10-100 倍：

```bash
# 安装
curl -LsSf https://astral.sh/uv/install.sh | sh

# 创建虚拟环境
uv venv

# 安装包
uv pip install requests

# 运行脚本（自动激活虚拟环境）
uv run python main.py

# 初始化项目（用 pyproject.toml）
uv init my-project
cd my-project
uv add requests
uv add pytest --dev
```

**速度对比**（安装 50 个包）：
- pip：~30s
- poetry：~45s
- uv：~3s

## 我现在的工作流

```bash
# 新项目
uv init my-project
cd my-project

# 添加依赖
uv add fastapi uvicorn
uv add pytest httpx --dev

# 运行
uv run python main.py
uv run pytest

# 同步环境（从 pyproject.toml 安装所有依赖）
uv sync
```

`uv.lock` 文件锁定了所有依赖的精确版本，提交到 git 里，保证所有人环境一致。

## 一个建议

不管用什么工具，**一定要用虚拟环境，一定要锁定依赖版本**。"在我机器上能跑"是最常见的协作问题根源之一。
