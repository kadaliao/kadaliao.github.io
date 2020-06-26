---
layout: post
title: 添加了public_key却无法登录 
tags: ssh linux
---

如果在~/.ssh/authorized_keys中添加了公钥文件，却依然无法自动登录。有可能是因为.ssh目录、.ssh/authorized_keys文件的权限比sshd服务本身放得更开造成的，参照如下设置即可解决：

```sh
chmod 700 $HOME/.ssh
chmod 600 $HOME/.ssh/authorized_keys
chown `whoami` $HOME/.ssh/authorized_keys
```
