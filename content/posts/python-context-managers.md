---
title: "Python with 语句与上下文管理器"
date: "2021-01-22"
draft: false
tags: ["Python", "上下文管理器", "contextmanager"]
categories: ["Python 工程"]
description: "with 语句是 Python 里优雅处理资源管理的方式。这篇文章讲清楚上下文管理器的原理，以及如何自己实现一个。"
---

`with` 语句在 Python 里随处可见，但很多人只会用，不了解它的工作原理。这篇文章把上下文管理器讲清楚。

## with 解决了什么问题

最典型的场景是文件操作：

```python
# 没有 with：如果中间报错，文件不会被关闭
f = open("data.txt")
data = f.read()
f.close()

# 有 with：无论是否报错，退出 with 块时一定会关闭文件
with open("data.txt") as f:
    data = f.read()
```

`with` 保证了"进入时执行某些操作，退出时一定执行另一些操作"，无论退出是正常还是异常。

## 底层原理：__enter__ 和 __exit__

实现了 `__enter__` 和 `__exit__` 的对象就是上下文管理器：

```python
class ManagedFile:
    def __init__(self, filename):
        self.filename = filename

    def __enter__(self):
        self.file = open(self.filename)
        return self.file  # as 后面的变量就是这个返回值

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.file.close()
        # 返回 True 表示吞掉异常，False 或 None 表示继续传播异常
        return False

with ManagedFile("data.txt") as f:
    data = f.read()
```

`__exit__` 接收三个参数：异常类型、异常值、traceback。如果没有异常，三者都是 `None`。

## 更简单的写法：contextmanager 装饰器

用类实现太繁琐，`contextlib.contextmanager` 让你用生成器函数实现上下文管理器：

```python
from contextlib import contextmanager

@contextmanager
def managed_file(filename):
    f = open(filename)
    try:
        yield f        # yield 之前是 __enter__，yield 的值是 as 后面的变量
    finally:
        f.close()      # yield 之后是 __exit__，finally 保证一定执行

with managed_file("data.txt") as f:
    data = f.read()
```

`yield` 把函数分成两半：之前是进入逻辑，之后是退出逻辑。

## 实际项目里的用法

**数据库事务**：

```python
@contextmanager
def transaction(db):
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise

with transaction(db) as conn:
    conn.execute("UPDATE ...")
    conn.execute("INSERT ...")
# 正常结束自动 commit，异常自动 rollback
```

**计时器**：

```python
@contextmanager
def timer(label=""):
    start = time.perf_counter()
    yield
    elapsed = time.perf_counter() - start
    print(f"{label}: {elapsed:.3f}s")

with timer("数据库查询"):
    results = db.query("SELECT ...")
```

**临时修改环境变量**：

```python
@contextmanager
def env_override(**kwargs):
    old = {k: os.environ.get(k) for k in kwargs}
    os.environ.update(kwargs)
    try:
        yield
    finally:
        for k, v in old.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

with env_override(DATABASE_URL="sqlite:///test.db"):
    run_tests()
```

## 嵌套 with

Python 3.10+ 支持括号语法，多个上下文管理器更好写：

```python
# Python 3.10+
with (
    open("input.txt") as fin,
    open("output.txt", "w") as fout
):
    fout.write(fin.read())
```

上下文管理器是"资源获取即初始化"（RAII）模式在 Python 里的实现，掌握它能写出更健壮、更清晰的代码。
