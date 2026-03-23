---
title: "Python 生成器与迭代器：惰性求值的力量"
date: "2021-06-30"
draft: false
tags: ["Python", "生成器", "迭代器", "内存优化"]
categories: ["Python 工程"]
description: "生成器是 Python 处理大数据集和流式数据的利器。这篇文章讲清楚迭代器协议和生成器的工作原理。"
---

处理大文件或数据流时，把所有数据加载进内存是不现实的。生成器提供了一种"按需生成"的方式，解决了这个问题。

## 迭代器协议

Python 的 `for` 循环本质上是在调用迭代器协议：

```python
# for 循环等价于这段代码
it = iter(my_list)  # 调用 __iter__，返回迭代器
while True:
    try:
        item = next(it)  # 调用 __next__，取下一个元素
        # 执行循环体
    except StopIteration:
        break
```

实现了 `__iter__` 和 `__next__` 的对象就是迭代器。

## 生成器函数

用 `yield` 的函数就是生成器函数，调用它返回一个生成器对象：

```python
def count_up(start, end):
    current = start
    while current <= end:
        yield current   # 暂停，返回 current，等待下次调用
        current += 1

for n in count_up(1, 5):
    print(n)  # 1 2 3 4 5
```

关键在于**暂停和恢复**：每次 `next()` 调用，函数从上次 `yield` 的地方继续执行，直到下一个 `yield`。

## 实际用处：处理大文件

```python
# 不好：一次性加载所有行到内存
def read_all_lines(filename):
    with open(filename) as f:
        return f.readlines()  # 10GB 文件直接 OOM

# 好：逐行生成，内存始终只有一行
def read_lines(filename):
    with open(filename) as f:
        for line in f:
            yield line.strip()

# 使用
for line in read_lines("huge_file.csv"):
    process(line)
```

## 生成器表达式

列表推导式的"惰性版本"：

```python
# 列表推导式：立刻计算，全部存内存
squares_list = [x**2 for x in range(1_000_000)]  # 占用大量内存

# 生成器表达式：按需计算，几乎不占内存
squares_gen = (x**2 for x in range(1_000_000))
```

当你只需要遍历一次，不需要随机访问时，生成器表达式永远比列表推导式更省内存。

## yield from：委托给子生成器

```python
def flatten(nested):
    for item in nested:
        if isinstance(item, list):
            yield from flatten(item)  # 递归委托
        else:
            yield item

data = [1, [2, 3, [4, 5]], 6]
print(list(flatten(data)))  # [1, 2, 3, 4, 5, 6]
```

`yield from` 比手动 `for item in sub_gen: yield item` 更简洁，也更高效。

## send()：双向通信

生成器不只能输出数据，还能接收数据：

```python
def accumulator():
    total = 0
    while True:
        value = yield total  # yield 既输出 total，又等待接收下一个值
        if value is None:
            break
        total += value

acc = accumulator()
next(acc)          # 启动生成器，到达第一个 yield
acc.send(10)       # 发送 10，total = 10
acc.send(20)       # 发送 20，total = 30
acc.send(5)        # 发送 5，total = 35
```

这个特性是协程（asyncio）的基础——async/await 在底层正是用生成器的 send 机制实现的。

## 什么时候用生成器

- 数据集太大，无法全部加载进内存
- 数据是流式产生的（网络流、实时日志）
- 只需要遍历一次，不需要随机访问
- 需要表达无限序列（斐波那契数列、自增 ID）

生成器是 Python 惰性求值的核心工具，理解它也是理解 asyncio 的前置知识。
