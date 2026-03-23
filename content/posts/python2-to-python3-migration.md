---
title: "Python 2 到 Python 3 迁移实战：我们是怎么做的"
date: "2019-11-20"
draft: false
tags: ["Python", "Python2", "Python3", "迁移"]
categories: ["Python 工程"]
description: "Python 2 在 2020 年正式停止维护。这篇文章记录我们团队将一个十几万行的 Python 2 项目迁移到 Python 3 的完整过程。"
---

Python 2 的 EOL（End of Life）定在 2020 年 1 月 1 日。我们团队从 2019 年中开始规划迁移，历时约半年完成。这里记录一下整个过程中遇到的问题和解决方案。

## 为什么不能拖

很多团队的心态是"能跑就行，等依赖库停止支持再说"。但现实是：

- 安全补丁不再提供，线上系统面临风险
- 新的第三方库越来越多只支持 Python 3
- 招进来的新人都不熟 Python 2，维护成本越来越高

## 迁移前的准备

### 用 2to3 扫描

Python 官方提供了 `2to3` 工具，可以扫描出大多数需要改动的地方：

```bash
2to3 -l          # 列出所有可用的修复器
2to3 -f all your_project/ --no-diffs  # 只扫描不修改，看有多少问题
```

### 用 pylint 或 pyupgrade 批量处理

```bash
pip install pyupgrade
# 批量转换为 Python 3.6+ 语法
find . -name "*.py" | xargs pyupgrade --py36-plus
```

## 最常见的改动点

### print 语句

```python
# Python 2
print "hello"
print "hello", "world"

# Python 3
print("hello")
print("hello", "world")
```

### integer 除法

```python
# Python 2：整数除整数 = 整数
5 / 2  # 结果是 2

# Python 3：真除法
5 / 2   # 结果是 2.5
5 // 2  # 整除，结果是 2
```

这个坑最隐蔽，2to3 不会自动处理，需要手动审查所有除法运算。

### unicode 与 bytes

Python 2 里 `str` 和 `bytes` 混用，Python 3 严格区分：

```python
# Python 2
s = "hello"       # bytes
u = u"hello"      # unicode

# Python 3
s = "hello"       # str（unicode）
b = b"hello"      # bytes
```

我们项目里最多的问题就是这里——各种地方拼接 str 和 bytes 导致 `TypeError`。

### dict.keys() / .values() / .items()

```python
# Python 2 返回列表
keys = d.keys()  # list
keys[0]          # 可以索引

# Python 3 返回视图对象
keys = d.keys()  # dict_keys，不能索引
keys = list(d.keys())  # 需要显式转换
```

### 异常语法

```python
# Python 2
except Exception, e:
    print e

# Python 3
except Exception as e:
    print(e)
```

## 我们的迁移策略

1. **先让代码同时兼容 2 和 3**（用 `six` 库做兼容层）
2. **补充单元测试覆盖率**（从 30% 提到 70%）
3. **分模块逐步迁移**，每个模块迁完后在 CI 里强制 Python 3 运行
4. **最后一刀切**，删掉所有兼容代码

## 教训

最难的不是语法，是**编码问题**。我们有大量从数据库读出的字节流，在 Python 2 里隐式当字符串用，迁移后全部报错。建议在迁移前先把所有数据库读写的编解码逻辑整理清楚。
