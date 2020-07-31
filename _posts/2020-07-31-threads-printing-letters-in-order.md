---
layout: post
title: 使用多个线程协作顺序打印字母
tags: python
---

需求：

- 开启3个线程，每个线程分别打印字母A、B、C；
- 需要顺序打印ABC10次

```python
#!/usr/bin/env python3
from threading import Condition, Thread

condition = Condition()
current_letter = 'A'


states_mapping = {'A': 'B', 'B': 'C', 'C': 'A'}


class PrintThread_E(Thread):
    def __init__(self, letter):
        super().__init__()
        self.letter = letter

    def should_print(self):
        return current_letter == self.letter

    def run(self):
        global current_letter
        for i in range(1, 11):
            with condition:
                condition.wait_for(self.should_print)
                print(i, self.letter)
                current_letter = states_mapping[current_letter]
                condition.notify_all()


class PrintThread(Thread):
    def __init__(self, letter):
        super().__init__()
        self.letter = letter

    def run(self):
        global current_letter
        for i in range(1, 11):
            with condition:
                while current_letter != self.letter:
                    condition.wait()
                print(i, self.letter)
                current_letter = states_mapping[current_letter]
                condition.notify_all()


if __name__ == "__main__":
    ts = [PrintThread_E(x) for x in 'ABC']
    [t.start() for t in ts]
    [t.join() for t in ts]
```
