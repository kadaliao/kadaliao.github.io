---
layout: post
title: PIP安装的包Shebang行指定了错误的Python版本
tags: git
---

使用`venv/bin/pip`安装的第三方包文件，如果环境变量中存在使用`__PYVENV_LAUNCHER__`变量，则安装后的文件Shebang行，有可能将固定为此环境变量对应的Python Interpreter路径。


解决办法就是执行`venv/bin/pip install`命令之前，移除此环境变量。

```python
os.environ.pop('__PYVENV_LAUNCHER__', None)
```


```sh
unset __PYVENV_LAUNCHER__
```

Ref:
- [Python 22490](https://bugs.python.org/issue22490)
- [What's the meaning of __PYVENV_LAUNCHER__](https://stackoverflow.com/questions/26323852/whats-the-meaning-of-pyvenv-launcher-environment-variable)
- [bpo-22490](https://github.com/python/cpython/pull/9516)
