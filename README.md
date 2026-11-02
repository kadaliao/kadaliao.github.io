# kadaliao.github.io

个人主页。手写的 HTML / CSS / JS，没有框架，没有构建步骤，push 到 `main` 就由 GitHub Actions 直接发布。

```
index.html            主页（hero、项目 bento、现在、关于）
404.html              没有页面时
assets/style.css      全站样式（极光、网格、卡片高光）
assets/app.js         逐块浮现、光标光斑、⌘K 面板、GitHub 星标
assets/favicon.svg    图标
```

## 本地预览

```sh
python3 -m http.server 8080
# http://127.0.0.1:8080
```

直接双击 `index.html` 也能看，只是相对路径的 favicon 会失效。

## 改内容

- 文案、项目卡片都在 `index.html` 里，一张卡片一个 `<a class="card">`。
- 卡片右上角的星标和「最近更新」由 `assets/app.js` 从 GitHub API 取，取不到就不显示，不会报错。
- 新增卡片记得给它一个 `.c-*` 类并在 `style.css` 的 `.bento` 区域分配栅格跨度（12 栏）。

## 部署

`.github/workflows/deploy.yml`：推 `main` → 上传仓库根目录 → GitHub Pages。
