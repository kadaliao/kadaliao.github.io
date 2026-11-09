# kadaliao.github.io

个人主页。手写的 HTML / CSS / JS，没有框架，没有构建步骤，push 到 `main` 就由 GitHub Actions 直接发布。

```
index.html            主页（hero、应用、插件、最近发布、关于）
404.html              没有页面时
assets/style.css      全站样式（极光、网格、卡片高光）
assets/app.js         逐块浮现、光标光斑、⌘K 面板、GitHub 星标、点击复制
assets/img/           应用截图（从各项目仓库的 docs 里取，压成 WebP）
assets/favicon.svg    图标
```

个人介绍和 GitHub 主页（[kadaliao/kadaliao](https://github.com/kadaliao/kadaliao)）的 About Me 保持一致，改的时候两边一起改。

## 本地预览

```sh
python3 -m http.server 8080
# http://127.0.0.1:8080
```

直接双击 `index.html` 也能看，只是相对路径的 favicon 会失效。

## 改内容

- 文案、卡片都在 `index.html` 里。应用卡片是 `<a class="card app">`：上面 `.shot` 放截图，下面 `.app-body` 放文字；插件卡片是 `<a class="card c-plugin">`。
- 卡片里还要放别的链接时（开心果的三个平台、人生游戏的在线版），卡片改用 `<div class="card app">`，标题写成 `<a class="card-link">`，它会铺满整张卡。
- 卡片右上角的星标和「最近更新」由 `assets/app.js` 从 GitHub API 取，取不到就不显示，不会报错。`data-repo` 可以写多个仓库，星标加起来。
- 新增卡片记得给它一个 `.c-*` 类并在 `style.css` 的 `.bento` 区域分配栅格跨度（12 栏），再在响应式里补上。
- 换截图：放进 `assets/img/`，`cwebp -q 80 -resize 1200 0 in.png -o out.webp`，`<img>` 写上实际的宽高。
- 「最近发布」是手写的，发了新版本记得改。

## 部署

`.github/workflows/deploy.yml`：推 `main` → 上传仓库根目录 → GitHub Pages。
