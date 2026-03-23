---
title: "Python 类型注解实战：让代码更可维护"
date: "2021-04-08"
draft: false
tags: ["Python", "类型注解", "mypy", "工程化"]
categories: ["Python 工程"]
description: "Python 3.5 引入类型注解，3.9/3.10 进一步完善。这篇文章介绍如何在实际项目中用好类型注解，以及 mypy 静态检查的配置。"
---

Python 是动态语言，但这不意味着不需要类型。类型注解让 IDE 提示更准确、代码意图更清晰、重构更安全。

## 基础语法

```python
# 变量注解
name: str = "Kada"
age: int = 30
scores: list[float] = [9.5, 8.8, 9.2]  # Python 3.9+

# 函数注解
def greet(name: str, times: int = 1) -> str:
    return f"Hello, {name}! " * times

# 返回 None
def log(message: str) -> None:
    print(message)
```

## 常用类型

```python
from typing import Optional, Union, List, Dict, Tuple, Any

# Optional：可以是 None
def find_user(user_id: int) -> Optional[str]:
    ...

# Union：多种类型之一（Python 3.10 可以用 X | Y）
def process(data: Union[str, bytes]) -> str:
    ...
# Python 3.10+
def process(data: str | bytes) -> str:
    ...

# 字典和列表（Python 3.9+ 可以直接用小写）
def get_config() -> dict[str, Any]:
    ...

# Tuple：固定长度和类型
def get_coordinates() -> tuple[float, float]:
    ...
```

## TypedDict：给字典加类型

JSON 数据经常用字典传递，TypedDict 让字典有类型检查：

```python
from typing import TypedDict

class UserInfo(TypedDict):
    id: int
    name: str
    email: str
    age: int | None  # 可选字段

def create_user(info: UserInfo) -> None:
    print(info["name"])  # IDE 有提示，且知道是 str 类型
```

## dataclass：更结构化的数据类

比 TypedDict 更进一步，dataclass 是带类型的数据容器：

```python
from dataclasses import dataclass, field

@dataclass
class Order:
    id: int
    user_id: int
    items: list[str] = field(default_factory=list)
    total: float = 0.0
    status: str = "pending"

order = Order(id=1, user_id=42)
print(order.status)  # "pending"
```

## Protocol：鸭子类型的类型化

Python 的鸭子类型可以用 Protocol 来描述接口：

```python
from typing import Protocol

class Closeable(Protocol):
    def close(self) -> None:
        ...

def cleanup(resource: Closeable) -> None:
    resource.close()

# 任何有 close() 方法的对象都满足 Closeable，不需要显式继承
```

## 配置 mypy

在项目根目录创建 `mypy.ini`：

```ini
[mypy]
python_version = 3.11
warn_return_any = True
warn_unused_configs = True
disallow_untyped_defs = True

# 第三方库没有类型定义时忽略错误
[mypy-requests.*]
ignore_missing_imports = True
```

运行检查：

```bash
mypy src/
```

## 渐进式引入的策略

不建议在老项目里一下子强制全部加注解，推荐渐进式：

1. 先给新写的代码加注解
2. 对改动频繁的模块补注解
3. 在 CI 里对特定目录运行 mypy，逐步扩大覆盖范围

类型注解不是银弹，但在团队协作的大型项目里，它带来的可维护性提升是实实在在的。
