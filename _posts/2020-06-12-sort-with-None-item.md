---
layout: post
title: sorted函数处理None值参与的情况
tags: python
---

内建的Sorted函数定义如下：

```
sorted(iterable, *, key=None, reverse=False)
    Return a new sorted list from the items in iterable.

    Has two optional arguments which must be specified as keyword arguments.

    key specifies a function of one argument that is used to extract a comparison key from each element in iterable (for example, key=str.lower). The default value is None (compare the elements directly).

    reverse is a boolean value. If set to True, then the list elements are sorted as if each comparison were reversed.

    Use functools.cmp_to_key() to convert an old-style cmp function to a key function.

    The built-in sorted() function is guaranteed to be stable. A sort is stable if it guarantees not to change the relative order of elements that compare equal — this is helpful for sorting in multiple passes (for example, sort by department, then by salary grade).``sh
```

当用于排序的序列有空值时，要注意是否适用于比较，以int序列举例：


```python
In [1]: a = [1,3,2,9,4,None]

In [2]: sorted(a)
---------------------------------------------------------------------------
TypeError                                 Traceback (most recent call last)
<ipython-input-2-ca63776b8466> in <module>
----> 1 sorted(a)

TypeError: '<' not supported between instances of 'NoneType' and 'int'
```


#### 解决办法

```python
In [6]: a
Out[6]: [1, 3, 2, 9, 4, None]

In [7]: sorted(a, key=lambda x: (x is None, x))
Out[7]: [1, 2, 3, 4, 9, None]
```

ref:

- https://stackoverflow.com/questions/18411560/python-sort-list-with-none-at-the-end
