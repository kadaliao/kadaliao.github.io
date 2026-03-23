---
title: "Python asyncio 实战：从入门到踩坑"
date: "2022-09-15"
draft: false
tags: ["Python", "asyncio", "并发"]
categories: ["Python 工程"]
description: "asyncio 是 Python 并发编程的核心，但真正用好它并不容易。本文梳理了实际项目中常见的坑和解决思路。"
---

Python 3.5 引入 `asyncio` 之后，异步编程逐渐成为 Python 工程师的必备技能。但从"跑通 demo"到"在生产项目里用好它"，中间有一段不短的距离。

## event loop 的生命周期

很多人第一次写 asyncio 代码是这样的：

```python
import asyncio

async def main():
    await asyncio.sleep(1)
    print("done")

asyncio.run(main())
```

`asyncio.run()` 是 Python 3.7 引入的，它做了三件事：

1. 创建一个新的 event loop
2. 运行传入的协程直到完成
3. 关闭 event loop 并清理资源

**注意**：不要在已经运行的 event loop 里调用 `asyncio.run()`，这会抛出 `RuntimeError`。

## 常见坑：忘记 await

```python
async def fetch_data():
    return await some_async_operation()

# 错误写法——fetch_data() 返回的是协程对象，不是结果
result = fetch_data()

# 正确写法
result = await fetch_data()
```

协程对象不会自动执行，必须被 `await`、`asyncio.create_task()` 或 `asyncio.gather()` 驱动。

## 并发执行多个任务

```python
import asyncio

async def fetch(url):
    # 模拟 IO 操作
    await asyncio.sleep(0.1)
    return f"result from {url}"

async def main():
    urls = ["url1", "url2", "url3"]
    # 并发执行，总耗时约 0.1s 而不是 0.3s
    results = await asyncio.gather(*[fetch(url) for url in urls])
    print(results)

asyncio.run(main())
```

`asyncio.gather()` 并发调度多个协程，是最常用的并发原语。

## 混用同步和异步代码

实际项目里经常需要在 async 函数里调用同步的阻塞操作（比如读文件、调用旧库）。直接调用会阻塞整个 event loop：

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor()

async def run_sync(func, *args):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, func, *args)

async def main():
    # 把阻塞操作放到线程池里跑
    result = await run_sync(some_blocking_function, arg1, arg2)
```

`run_in_executor` 是处理这类问题的标准做法。

## 小结

asyncio 的核心理念是**协作式调度**：每个协程在 `await` 处主动让出控制权。理解这一点，大多数坑都会迎刃而解。
