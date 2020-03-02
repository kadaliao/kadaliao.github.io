---
layout: post
title: 把VIM当做16进制编辑器使用
tags: vim
---

UltraEdit软件很好用，但不是免费的。

VIM其实本身就可以作为16进制编辑器，需要依赖Linux下的`xxd`工具，可以做16进制的导入和导出。

### xxd 的使用

```bash
$ man xxd

XXD(1)                                                                XXD(1)

NAME
       xxd - make a hexdump or do the reverse.

SYNOPSIS
       xxd -h[elp]
       xxd [options] [infile [outfile]]
       xxd -r[evert] [options] [infile [outfile]]

DESCRIPTION
       xxd  creates  a  hex  dump of a given file or standard input.  It can
       also convert a hex dump back to its original binary form.  Like uuen-
       code(1)  and uudecode(1) it allows the transmission of binary data in
       a `mail-safe' ASCII representation, but has the advantage of decoding
       to  standard output.  Moreover, it can be used to perform binary file
       patching.

...

```

做个简单的测试，将字符串hello world转换为16进制，再转换回来。

```bash
$ echo hello world |xxd
00000000: 6865 6c6c 6f20 776f 726c 640a            hello world.

$ echo hello world |xxd | xxd -r
hello world
```

### 将VIM当做16进制编辑器

1. 使用`vim -b file`二进制模式打开文件
2. 执行命令`:%!xxd`，将缓冲区内容使用`xxd`工具转换为16进制
3. 可以使用`:%!xxd -r`转换回来

![xxd](https://tva1.sinaimg.cn/large/00831rSTly1gcfgue61r4g30hs0jme81.gif)
