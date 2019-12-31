---
layout: post
title: 批量更新git提交者信息
tags: git
---

需要变更git的历史提交者信息，一种办法是：

- `git rebase -i <target-commit>`，将需要变更的commit标记`e`
- 依次`git commit --amend --author "name <name@email.com>"`, `git rebase --continue`

另一种办法：

github官方提供了一个脚本，可以批量变更提交者信息；将脚本中对应变量设置后执行即可。

```sh
#!/bin/sh

git filter-branch --env-filter '

OLD_EMAIL="your-old-email@example.com"
CORRECT_NAME="Your Correct Name"
CORRECT_EMAIL="your-correct-email@example.com"

if [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL" ]
then
    export GIT_COMMITTER_NAME="$CORRECT_NAME"
    export GIT_COMMITTER_EMAIL="$CORRECT_EMAIL"
fi
if [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL" ]
then
    export GIT_AUTHOR_NAME="$CORRECT_NAME"
    export GIT_AUTHOR_EMAIL="$CORRECT_EMAIL"
fi
' --tag-name-filter cat -- --branches --tags
```

不管哪种办法，最后都要强行推到仓库。

`git push --force --tags origin 'refs/heads/*'`
