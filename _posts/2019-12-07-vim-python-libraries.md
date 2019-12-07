---
layout: post
title: 在Python的隔离环境中正常使用Vim的插件
tags: vim
---

Vim用得6，少不了各种好用的插件。这些插件以外部命令运行，并返回结果的方式工作。

例如Python开发为例，关于代码解析和自动补全的系列插件`ncm`, `jedi`等等，都需用安装对应的包，来使用这些命令`pip install neovim jedi`。

但实际开发中，每个项目都应当有自己的隔离环境，以免Python的第三方安装包互相干扰。

### 问题

1、如果在系统环境下启动Vim，则项目隔离环境中包的代码，不会得到解析。

![vim-with-sys](https://tva1.sinaimg.cn/large/006tNbRwly1g9oe1nkbdej317c0u0q4r.jpg)

2、如果在隔离环境下启动Vim，则会报错`Job dead: 依赖的这些vim插件对应的命令不存在`

![start-vim-in-virtualenv](https://tva1.sinaimg.cn/large/006tNbRwly1g9oe311spsj31860u0gmk.jpg)

![vim-error-in-virtualenv](https://tva1.sinaimg.cn/large/006tNbRwly1g9oe3yn6skj31860u0afb.jpg)


### 解决办法

#### 方法1：

在每个隔离环境中单独安装对应的库`.venv/bin/pip install neovim jedi`，这种方式非常麻烦。

#### 方法2：

通过`g:python3_host_prog=/usr/local/bin/python`，指定使用系统的Python Interpreter。


#### 另外：

如果想将vim相关的python包，也安装到特定的隔离环境中，并在在vim启动之时，检查这些包是否存在，可以使用以下代码：

```vim
" Install neovim in specified virtualenv
if empty(glob('~/.cache/vim/venv/neovim3/bin/python'))
  !virtualenv ~/.cache/vim/venv/neovim3
  !~/.cache/vim/venv/neovim3/bin/pip install neovim jedi
endif

" Python host for neovim
let g:python3_host_prog = '~/.cache/vim/venv/neovim3/bin/python'
" let g:python3_host_prog = '/usr/local/bin/python3'
```

