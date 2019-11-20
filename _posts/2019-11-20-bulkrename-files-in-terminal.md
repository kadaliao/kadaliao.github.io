---
layout: post
title: 在终端中批量重命名文件
tags: ranger vim
---

在终端中批量重命名文件，本质上是执行一些列的`mv`命令。

使用ranger比较方便：

1. 将需要重命名的文件，使用空格键标记起来
2. 输入`:bulkrename`，进入编辑状态，将每行名字替换
3. 保存、确认，退出，即可生效

![bulk rename in ranger](http://st.kada.ink/ranger-bulkrename.gif)

使用vim：
1. 打开一个空buffer
2. 输入`:r !ls`，读取需要重命名的文件列表到缓冲区
3. 批量编辑多行，使得文件名列表变成`mv`命令列表
4. 输入`:w !sh`，将buffer中的命令列表，写入到shell执行

![bulk rename in vim](http://st.kada.ink/vim-bulkrename.gif)
