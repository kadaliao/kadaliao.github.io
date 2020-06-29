---
layout: post
title: Python中均等的切分一个Iterator
tags: python
---

将一个Python的可迭代对象，按照每n个切分一组：

```python
from itertools import islice, takewhile, repeat

def split_every(n, iterable):
    """
    Slice an iterable into chunks of n elements
    :type n: int
    :type iterable: Iterable
    :rtype: Iterator
    """
    iterator = iter(iterable)
    return takewhile(bool, (list(islice(iterator, n)) for _ in repeat(None)))
```

