---
title: "Claude Code 是如何狙杀中国用户的"
date: "2026-04-01"
draft: false
tags: ["Claude Code", "cc-gateway", "Telemetry", "Agent", "工程实践"]
categories: ["AI Agent"]
description: "研究 Claude Code 源码，看看 Claude Code 到底怎么精准定位中国用户然后封号的"
---

继昨天 Claude Code 源码泄露之后，全网已经狂欢了一整天。

除了学习它的 agent 架构、prompt 组织方式，对很多又爱又恨 Claude Code 的中国用户来说，还可以研究下怎么"道高一尺、魔高一丈！"

我们来对比泄露的代码和 `@anthropic-ai/claude-code` 当前 npm 包里的 `cli.js`，研究下 Claude Code 是如何精准定位用户的！

![Claude Code 追踪链路总览](/images/posts/claude-code-tracking-and-cc-gateway/cover.png)
<!-- 配图提示词: A clean technical diagram showing Claude Code's multi-layer data collection architecture. Three parallel vertical lanes labeled "System Prompt", "Event Reporting", and "Side Traffic". Each lane lists data fields flowing downward (arrows) into a central "Anthropic Server" node at the bottom. Dark background, monospace font, cyan/blue accent colors, minimal flat design. No photos, pure diagram. -->

---

## 一、Claude Code 到底在送什么

### 1. system prompt 里就带着环境信息

很多人会本能地觉得，"追踪"无非就是打点埋点，把那一路关了就行。

但 Claude Code 自己发给模型的 system prompt 里，本来就有一段环境信息。当前 npm 包里的 `cli.js` 可以直接搜到：

- `Working directory`
- `Platform`
- `Shell`
- `OS Version`
- 是否是 git repo

你每次发起对话请求，模型侧就能看到你当前的工作目录和平台环境。就算把事件上报那一路关了，只要主请求还在，环境信息也没真的"没出去"。

---

### 2. 事件上报里有一整块环境指纹

![环境指纹字段结构](/images/posts/claude-code-tracking-and-cc-gateway/env-fingerprint.png)
<!-- 配图提示词: A structured infographic showing a JSON-like tree of environment fingerprint fields grouped into categories: "Platform" (platform, arch, node_version, terminal), "Runtime" (package_managers, runtimes, is_running_with_bun), "Context" (is_ci, is_claude_ai_auth, deployment_environment, vcs), "Process" (rss, heapTotal, heapUsed, cpuUsage). Each group in a distinct colored card. Dark theme, monospace font, flat design. No photos. -->

从当前 npm 包里能翻到的事件结构，`env` 字段相当细：

- `platform` / `platform_raw` / `arch`
- `node_version`
- `terminal`
- `package_managers` / `runtimes` / `is_running_with_bun`
- `is_ci` / `is_claude_ai_auth`
- `version` / `build_time` / `deployment_environment`
- `vcs`

以及一批和远程环境、GitHub Actions、容器、远程会话有关的字段。

服务端看到的不是"这是个 macOS 用户"，而是 arm64 还是 x64、用的是 zsh 还是 bash、装没装 bun、是不是 CI、是不是远程会话。如果你在多台机器之间切来切去，这些字段比很多人想象得更像设备指纹。

---

### 3. 进程层面的机器特征

事件数据里还会带一份 `process` 信息：

- `rss` / `heapTotal` / `heapUsed`
- `constrainedMemory`
- `cpuUsage` / `uptime`

物理内存约束值、堆大小区间这类数据，单独看未必说明什么，和前面的环境字段拼在一起，画像味就出来了。

---

### 4. 主请求之外还有额外流量

![Claude Code 出站流量分布](/images/posts/claude-code-tracking-and-cc-gateway/traffic-routes.png)
<!-- 配图提示词: A network flow diagram showing outbound traffic from "Claude Code Client" splitting into four routes: (1) Main API → api.anthropic.com, (2) Logs/Metrics → Datadog, (3) Feature flags → GrowthBook, (4) MCP tools → mcp-proxy.anthropic.com. Each route is a colored arrow. A dashed box around routes 2–4 labeled "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC controls these". Dark background, flat icon style, no photos. -->

打包产物里能搜到两类域名：Datadog 和 GrowthBook，同时还有这个环境变量：

```
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC
```

如果这个变量打开，流量模式从默认切到 `essential-traffic`。也就是说，除了主 API 请求，Claude Code 自己也承认还有一部分"非必要流量"——日志、实验、配置、诊断，各走各的路。

---

### 5. 你改过 API 出口，这件事本身也可能被带出去

打包的 cli.js 里有一段逻辑，会把环境覆盖信息打进事件数据，其中包括 `ANTHROPIC_BASE_URL` 和通过环境变量覆盖的模型配置。

所以你用了哪家转发站，官方也了解的一清二楚。

---

### 6. MCP 是单独的一条线

打包产物里可以直接看到：

```
MCP_PROXY_URL: "https://mcp-proxy.anthropic.com"
```

就算你把主 API 请求通过 `ANTHROPIC_BASE_URL` 改走了，MCP 相关流量也未必跟着一起改。所以"设置了 `ANTHROPIC_BASE_URL`，并不代表 所有流量都经过自己代理了"，MCP 是单独处理的。

---

## 二、为什么这些东西会让用户更容易触发风控

![多维度画像交叉验证](/images/posts/claude-code-tracking-and-cc-gateway/fingerprint-cross-check.png)
<!-- 配图提示词: A Venn-diagram-style illustration showing overlapping circles for: "System Prompt env" (working dir, platform, shell), "Event env fields" (arch, node, terminal, baseUrl), "Process metrics" (rss, heap, cpu), "Request headers" (User-Agent, billing header). The overlapping center area is labeled "Account Risk Score ↑" in red. Dark background, soft glow on circles, flat design. No photos. -->

单个字段未必致命，麻烦在于它们会互相交叉验证。

比如：prompt 里说你在 `/Users/alice/work` 下工作，事件里又说你是 `linux + bash + x64`，这次请求的 `baseUrl` 还变了，过几个小时，同一个账号又从另一套完全不同的环境字段发来请求——服务端看到的就不只是"一个人在用"，而是"这个账号背后的客户端画像非常不稳定"。

虽然没法凭代码断言 Anthropic 的具体封号规则。但从直觉上说，下面这些行为确实会让你的画像变得更乱：

- 多台差异很大的机器混着用
- 经常切出口地址
- 主请求和事件上报里的环境信息彼此对不上
- 客户端版本、入口、运行环境变化过于频繁

"减轻追踪"光靠"上代理"还不够，至少要分三层来处理。

**第一层：把侧路先关掉**

```bash
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
```

把非必要流量先压掉。解决不了一切，但先把"不是核心对话链路的那些流量"关掉。

**第二层：把主请求出口统一**

```bash
export ANTHROPIC_BASE_URL="https://your-gateway.example.com"
```

这一步的意义不是匿名，而是把出站路径收口。但只改出口不够，因为客户端还可能把"我正在使用自定义 base URL"这件事再打回事件数据里。

**第三层：把多台机器的画像收敛**

真正麻烦的是办公室一台、家里一台、云上再挂一台，macOS 和 Linux 混着用，终端、Node 版本、内存配置都不一样。这种时候即便账号还是一个，设备画像也会非常散。

有效的思路不是"藏起来"，而是收敛：统一 device identity、统一环境字段、统一版本指纹、统一主请求出口、统一 OAuth 刷新来源。让上游看到的是"同一台稳定机器"。

---

## 三、有人连夜做了个 cc-gateway

![cc-gateway 架构示意](/images/posts/claude-code-tracking-and-cc-gateway/cc-gateway-arch.png)
<!-- 配图提示词: A system architecture diagram. Left side: two client machines (MacBook and Linux server icons) labeled "Machine A" and "Machine B". Center: a box labeled "cc-gateway" containing three processing steps: "① OAuth token relay", "② Rewrite /v1/messages (env, device_id, home path)", "③ Rewrite /api/event_logging (env, process metrics)". Right side: "Anthropic API" cloud icon. Arrows flow left→center→right. One dashed arrow bypasses gateway labeled "MCP (not intercepted)". Dark theme, flat design. -->

思路很直接：在 Claude Code 和 Anthropic API 中间放一个反向代理，专门处理前面说过的那几类暴露。

**接管 OAuth**

网关自己拿着 `refresh_token` 负责刷新 `access_token`，客户端不再各自保留一份可直接使用的 token。多台机器不用重复登录，请求从同一个身份入口出去。

**改主请求里的身份和提示词环境**

对 `/v1/messages` 这类请求，它会改：

- `metadata.user_id` 里的 `device_id`
- system prompt 里的 `<env>` 环境块
- prompt 文本中的 `Working directory`、`Platform`、`Shell`、`OS Version`
- 暴露用户名的 home 路径

**改事件上报里的环境和进程画像**

对 `/api/event_logging/batch`：

- `device_id` 和 `email` 改掉
- `env` 整块替换成预设画像
- `process` 改成统一后的指标
- `baseUrl` 删掉

有个细节做得不错：`rss`、`heapTotal`、`heapUsed` 没有写成死值，而是在合理区间里随机——不能只要"改了"就行，还得别改得太假。

**改 header**

包括 `User-Agent` 和 `x-anthropic-billing-header`。后者带着 `cc_version`、`cc_entrypoint`、`cc_workload` 这类 attribution 信息，服务端不只是通过 body 看你是谁。

---

## 四、几点注意

**它做的是"收敛画像"，不是"彻底匿名"。** 你还是那个账号，底层 refresh token 没变，中心身份也没变。它减少的是"这几台机器差异太大"带来的额外暴露。

**它没有覆盖所有链路。** MCP 那条线就不在它的改写面里，所以它自己 README 里强调还要配合网络层规则一起用。

**你必须信任网关本身。** 一旦所有请求都先过网关，网关理论上就能看到你的 prompt、代码、工具调用、模型返回。这个东西只适合自己给自己搭，或者非常小、非常可信的团队内部用。

