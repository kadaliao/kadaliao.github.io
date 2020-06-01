---
layout: post
title: Git仓库中忽略引用的子模块更新
tags: git
---

Git提供了方便的模块化管理功能，可以方便的将其他git仓库代码引入到当前仓库使用。

##### 以 [dotdrop](https://github.com/deadc0de6/dotdrop) 为例

1、添加子项目

```
git submodule add https://github.com/deadc0de6/dotdrop.git
```

2、当前目录将会出现`.gitmodules`文件

```
[submodule "dotdrop"]
  path = dotdrop
  url = https://github.com/deadc0de6/dotdrop.git
```

3、但是之后每次引入的项目有更新，其对应的commit信息将出现在我们自己的项目变更信息中，这不是我们想要的。

```
$ git status
位于分支 test
尚未暂存以备提交的变更：
  （使用 "git add <文件>..." 更新要提交的内容）
  （使用 "git restore <文件>..." 丢弃工作区的改动）
        修改：     dotdrop (新提交)

修改尚未加入提交（使用 "git add" 和/或 "git commit -a"）
```

4、修改`.gitmodules`文件，设置忽略之

```
[submodule "dotdrop"]
  path = dotdrop
  url = https://github.com/deadc0de6/dotdrop.git
  ignore = all
```

注意：ignore=dirty，只会忽略暂未添加到仓库的文件，ignore=all才会忽略掉所有的更新


参照[stackoverflow](https://stackoverflow.com/questions/3240881/git-can-i-suppress-listing-of-modified-content-dirty-submodule-entries-in-sta/#12527608)
