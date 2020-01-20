---
layout: post
title: Python的__getitem__方法研究
tags: python
---

如果一个类实现了`__len__`方法和`__getitem__`，可以视作一个immutable sequence。

有了`__getitem__`方法的类的实例`x`，我们可以做下标访问`x[i]`，`a in x`， `for item in in x`等操作。

* 虽然没有实现`__contains__`，Python会用迭代遍历`__getitem__`，找到元素就返回`True`
* 虽然没有实现`__iter__`方法，但是Python会使用`__getitem__`配合`IndexError`来做迭代行为。

如果`__getitem__`内部在直接操作一个sequnce，比如`list`，天然支持`slice`（切片）操作。否则就需要实现，针对切片情况的处理。

#### 关于slice

```python
In [6]: class C:
   ...:     def __getitem__(self, k):
   ...:         return k
   ...:

In [7]: c = C()

In [8]: c[3:9:-1]
Out[8]: slice(3, 9, -1)

In [9]: s = c[-2:15:2]

In [10]: s.indices(9) # 假设容器元素数量为9
Out[10]: (7, 9, 2)

In [11]: range(9)[7:9:2] == range(9)[-2:15:2]
Out[11]: True
```


#### 实现一个大写字母集合的类

要求：可以用下标顺序访问字母元素，支持切片操作


```python
class Alphabet:
    """
    Aplhabet collection for uppercase letters.

    >>> a = Alphabet()
    >>> a[0]
    'A'
    >>> a[1]
    'B'
    >>> a[-1]
    'Z'
    >>> a[-2]
    'Y'
    >>> a[1:3]
    ['B', 'C']
    >>> a[-3:]
    ['X', 'Y', 'Z']
    >>> 'A' in a
    True
    >>> 'a' in a
    False
    >>> for x in a: # doctest:+ELLIPSIS
    ...     print(x)
    A
    B
    C
    ...
    X
    Y
    Z
    """
    def __init__(self):
        self.kv = {k: chr(65 + k) for k in range(26)}

    def __len__(self):
        return len(self.kv)

    def __getitem__(self, pos):
        if isinstance(pos, slice):
            return [self[i] for i in range(*pos.indices(len(self)))]
        elif isinstance(pos, int):
            if pos < 0:
                pos += len(self)
            if pos < 0 or pos >= len(self):
                raise IndexError(f'The index ({pos}) is out of range')
            return self.kv[pos]
        else:
            raise TypeError('Invalid argument type')

    def __repr__(self):
        return str(self.kv)


def main():
    import doctest
    doctest.testmod()


if __name__ == "__main__":
    main()
```

