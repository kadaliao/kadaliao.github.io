---
title: "Python 装饰器深入理解：从语法糖到元编程"
date: "2020-03-12"
draft: false
tags: ["Python", "装饰器", "元编程"]
categories: ["Python 工程"]
description: "装饰器是 Python 最优雅的特性之一。这篇文章从原理出发，讲清楚装饰器的实现机制和实际应用场景。"
---

装饰器是 Python 里我最喜欢的特性之一——它让你能在不修改函数本身的情况下，给它增加行为。这篇文章从头梳理一下装饰器的原理和用法。

## 从闭包说起

装饰器本质上是闭包。理解闭包是理解装饰器的前提：

```python
def outer(x):
    def inner():
        print(x)  # inner 捕获了外层的 x
    return inner

f = outer(42)
f()  # 输出 42，即使 outer 已经返回
```

`inner` 函数"记住"了它定义时所在的环境（`x = 42`），这就是闭包。

## 装饰器的基本形态

装饰器就是一个接受函数、返回函数的函数：

```python
def my_decorator(func):
    def wrapper(*args, **kwargs):
        print("函数执行前")
        result = func(*args, **kwargs)
        print("函数执行后")
        return result
    return wrapper

@my_decorator
def say_hello(name):
    print(f"Hello, {name}!")

# 等价于：say_hello = my_decorator(say_hello)
say_hello("Kada")
```

`@my_decorator` 只是语法糖，等价于 `say_hello = my_decorator(say_hello)`。

## functools.wraps：保留函数元信息

用装饰器之后，函数的 `__name__`、`__doc__` 会被替换成 wrapper 的：

```python
print(say_hello.__name__)  # 输出 "wrapper"，而不是 "say_hello"
```

用 `functools.wraps` 解决：

```python
import functools

def my_decorator(func):
    @functools.wraps(func)  # 把原函数的元信息复制过来
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper
```

**这是写装饰器的最佳实践，几乎任何时候都应该加上。**

## 带参数的装饰器

装饰器本身也可以接受参数，这时候需要多套一层：

```python
def retry(max_times=3, delay=1):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for i in range(max_times):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if i == max_times - 1:
                        raise
                    time.sleep(delay)
        return wrapper
    return decorator

@retry(max_times=5, delay=2)
def unstable_api_call():
    ...
```

## 类装饰器

用类也可以实现装饰器，适合需要维护状态的场景：

```python
class CallCounter:
    def __init__(self, func):
        functools.update_wrapper(self, func)
        self.func = func
        self.count = 0

    def __call__(self, *args, **kwargs):
        self.count += 1
        print(f"第 {self.count} 次调用")
        return self.func(*args, **kwargs)

@CallCounter
def my_func():
    pass

my_func()  # 第 1 次调用
my_func()  # 第 2 次调用
print(my_func.count)  # 2
```

## 实际项目里的用法

**缓存**：`functools.lru_cache` 就是装饰器

```python
from functools import lru_cache

@lru_cache(maxsize=128)
def fib(n):
    if n < 2:
        return n
    return fib(n-1) + fib(n-2)
```

**权限控制**（Web 框架常见模式）：

```python
def login_required(func):
    @functools.wraps(func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('/login/')
        return func(request, *args, **kwargs)
    return wrapper

@login_required
def profile_view(request):
    ...
```

**计时**：

```python
def timer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        end = time.perf_counter()
        print(f"{func.__name__} 耗时 {end - start:.4f}s")
        return result
    return wrapper
```

装饰器的本质是对函数行为的横切关注点（cross-cutting concerns）进行抽象，避免在业务逻辑里到处写重复的样板代码。
