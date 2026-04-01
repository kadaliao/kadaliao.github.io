---
title: "Claude Code 风波之后，我认真看了 cc-gateway 的代码"
date: "2026-04-01"
draft: false
tags: ["Claude Code", "cc-gateway", "Agent", "Telemetry", "Reverse Proxy"]
categories: ["AI Agent"]
description: "cc-gateway 并不神秘，本质上是一个放在 Claude Code 与 Anthropic API 之间的反向代理：接管 OAuth、统一 device_id 和环境指纹、改写 prompt 里的 <env> 块。但它也有非常明确的边界和风险。"
---

这两天 Claude Code 的源码风波，把很多平时藏在水面下的工程细节都翻了出来。

社区里最刺激情绪的部分，是各种关于遥测、设备指纹、识别机制、封号机制的讨论。接着就有人基于这些分析，做出了一个“反制”项目：[cc-gateway](https://github.com/motiful/cc-gateway)。

我不想复述传闻，也不想把情绪当结论。最有价值的做法，还是回到代码本身。

我把 `cc-gateway` 的核心代码、配置、脚本和测试都完整看了一遍。先给结论：

> **cc-gateway 不是某种神秘的“解封工具”。它本质上是一个很直接的反向代理。**
>
> 它做的事情可以概括成三件：**接管 OAuth、统一身份、重写指纹。**
>
> 如果你的目标是“让多台 Claude Code 客户端在上游看来更像同一台稳定机器”，它是有效的。
> 如果你的目标是“证明某种封禁策略”或者“彻底匿名化”，那它做不到。

---

## 一句话讲清楚：它到底是什么

`cc-gateway` 放在 **Claude Code 客户端** 和 **Anthropic API** 之间。

客户端不再直接连 `api.anthropic.com`，而是改连你自己的网关。网关收到请求之后，会做三层处理：

1. 验证客户端自己的代理令牌；
2. 把请求体、请求头里会暴露“这是谁、这台机器长什么样”的字段改写成一套统一画像；
3. 用网关自己维护的 OAuth access token 去请求 Anthropic 上游。

所以它不是在改 Claude Code 客户端本身，而是在**HTTP 请求出站之前**做一次集中洗白。

从代码结构上看，它非常简单：

- `src/index.ts`：启动入口，先加载配置，再初始化 OAuth，然后启动代理；
- `src/proxy.ts`：HTTP/HTTPS 服务器，请求转发、鉴权、SSE 透传都在这里；
- `src/rewriter.ts`：核心重写逻辑；
- `src/oauth.ts`：refresh token 换 access token，并定时自动刷新；
- `src/auth.ts`：给每台客户端发一个 Bearer token，只有带这个 token 的请求才允许通过。

整个项目最核心的工程判断，不是“黑”在哪里，而是**把问题收敛到了一个很小的控制面上**。

---

## 它实际改了什么

如果只看 README，很容易觉得它像一个覆盖一切的“反识别系统”。

但看完代码之后，我认为更准确的描述是：

> **它覆盖的是 Claude Code 当前一部分关键出站请求的身份字段和环境字段。**

具体来说，重写逻辑主要集中在两个路径：

### 1. `/v1/messages`

这是正常对话请求。

在这类请求里，它会改几类信息：

- `metadata.user_id` 这个 JSON 字符串里的 `device_id`
- system prompt 里的 `<env>` 环境块
- prompt 文本里的 `Platform`、`Shell`、`OS Version`
- prompt 里出现的 `Working directory`
- prompt 里暴露用户名的家目录路径，如 `/Users/alice/...`、`/home/bob/...`
- `x-anthropic-billing-header` 里的 `cc_version` 指纹

也就是说，它不仅在改 API 字段，还在改**模型实际能看到的系统提示文本**。

这一点很关键。

因为如果 telemetry 里说“你是 macOS + zsh + `/Users/jack/projects`”，但 prompt 里又写着“你当前在 Linux + bash + `/home/bob/app`”，上游完全可以做交叉比对。`cc-gateway` 明显就是在堵这个口子。

### 2. `/api/event_logging/batch`

这是事件上报批量接口。

在这个路径里，它会重写：

- `event_data.device_id`
- `event_data.email`
- `event_data.env`
- `event_data.process`
- `event_data.additional_metadata`

同时删掉几个明显会暴露代理存在的字段：

- `baseUrl`
- `base_url`
- `gateway`

这里最值得注意的不是“改了几个字段”，而是它对 `env` 的处理方式。

它不是局部 patch，而是**直接整块替换成配置里的 canonical env**。也就是你在 `config.yaml` 里手工定义一套“标准机器画像”，然后所有客户端都伪装成它。

README 里说的“40+ environment dimensions”基本就是这个意思。

### 3. `process` 里的硬件与进程指标

这一层处理也比较实用。

它会把一些硬件相关、很容易形成指纹的信息统一掉，比如：

- `constrainedMemory`
- `rss`
- `heapTotal`
- `heapUsed`

其中 `constrainedMemory` 会被固定成配置值，比如 32GB；而 `rss`、`heapTotal`、`heapUsed` 不是写死成一个数，而是在预设区间里随机，尽量让数据看起来更像自然波动。

这个设计说明作者不是只想“伪造”，而是想“伪造得别太机械”。

---

## 它是怎么接管认证的

这个项目另一个非常重要的点，不是重写，而是**OAuth 中心化**。

`src/oauth.ts` 里把逻辑写得很清楚：

- 网关持有一个真实的 `refresh_token`
- 启动时调用 `https://platform.claude.com/v1/oauth/token`
- 换回 `access_token`
- 在 access token 过期前 5 分钟自动刷新

客户端机器不需要再浏览器登录。

配套脚本 `scripts/client-setup.sh` 会在客户端写入四个关键环境变量：

```bash
export ANTHROPIC_BASE_URL="https://gateway.your-domain.com:8443"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
export CLAUDE_CODE_OAUTH_TOKEN="gateway-managed"
export ANTHROPIC_CUSTOM_HEADERS="Proxy-Authorization: Bearer YOUR_TOKEN"
```

这四个变量组合起来，含义很明确：

- 所有主 API 请求都走自建网关；
- 尽量关闭非必要侧路流量；
- 客户端本地不再自己持有可用 OAuth token；
- 客户端只需要知道“怎么进网关”，不需要知道“怎么上 Anthropic”。

这也是为什么我说，`cc-gateway` 的核心其实不是“破解”，而是**把上游身份管理收口到一台中控机器上**。

---

## 工程上最值得记的，是这四个判断

### 1. 它解决的是“一致性问题”，不是“匿名性问题”

这一点一定要讲清楚。

`cc-gateway` 的设计目标，不是让你变成“没有身份”，而是让多台机器在上游看来**共享一套一致身份**。

也就是说，它更像是在做：

- 单一 `device_id`
- 单一 `email`
- 单一环境画像
- 单一版本指纹
- 单一 OAuth 入口

这和匿名化不是一回事。

上游仍然能看到：

- 这是同一个账号体系；
- 这是同一个 refresh token 刷出来的 access token；
- 这些请求最终从同一个网关出口发出；
- 这套身份画像是稳定存在的。

所以它更像“身份收敛”，不是“身份消失”。

### 2. 它并没有证明任何封禁规则

很多讨论里会自然滑向一个结论：既然项目在改这些字段，那就说明平台一定拿这些字段做了某种封禁决策。

这一步在逻辑上其实是跳跃的。

`cc-gateway` 的代码只能证明两件事：

1. 作者相信这些字段值得统一；
2. 作者实现了一套统一这些字段的工程方案。

**它本身不能证明 Anthropic 的真实风控规则，更不能单凭这份代码就推出某种地区性策略。**

最多只能说：从工程防御角度看，这些字段被认为是潜在识别面。

如果写成公众号文章，我觉得这条要守住。否则很容易从“读代码”滑成“传播未经证实的产品结论”。

### 3. 它的覆盖面没有宣传语那么宽

这个项目是有用的，但不是无死角。

几个直接从代码和 README 都能看出来的边界：

- 它重点处理的是 `/v1/messages` 和 `/api/event_logging/batch`
- `metadata.user_id` 里只明确改了 `device_id`，`account_uuid` 和 `session_id` 是保留的
- prompt 改写是基于正则替换，如果 Claude Code 将来改 prompt 模板，这里可能失效
- 它依赖 `ANTHROPIC_BASE_URL` 路由主请求，某些硬编码域名并不会天然跟随
- README 已经明确写了：`mcp-proxy.anthropic.com` 会绕过网关

换句话说，`cc-gateway` 自己其实也承认：**它需要和 Clash 规则一起使用，才算完整防线。**

这也是它 README 里“env vars + Clash + gateway rewriting”三层防御的真实含义。

### 4. 你必须信任网关管理员

这个风险非常现实。

一旦所有 Claude Code 请求都从网关过，网关运营者理论上就能看到：

- 你的 prompt
- 你的代码片段
- 你的工具请求
- 你的返回内容

当前仓库代码没有做持久化窃取，也没有偷偷打点，但**架构位置本身就意味着它拥有完整明文流量可见性**。

所以这个方案天然适合：

- 你自己给自己搭；
- 或者一个你完全信任的小团队内部统一搭。

如果是随便接入别人发出来的公共网关，那安全模型其实是更差的。

---

## 从代码质量看，它属于“短小、直接、够用”

我对这个项目的工程评价其实不低。

原因不是它多复杂，而是它很克制。

它没有做那些容易把系统搞得极其脆弱的花活，而是只做几件事：

- 配置加载
- Bearer 鉴权
- body/header 重写
- OAuth 自动刷新
- SSE 透传
- 少量验证和测试

代码量很小，控制流也很直接。

我把它的测试跑了一遍，仓库当前是 **13 个测试全部通过**。测试覆盖的重点也很务实：

- `metadata.user_id.device_id` 改写
- system prompt 环境信息改写
- billing header 改写
- event logging 的 `env` 替换
- `baseUrl/gateway` 泄露字段剔除
- process 指标改写
- 请求头里的 `authorization`、`proxy-authorization` 清理

这说明作者至少知道自己这套东西最容易在哪些地方失效。

当然，它也不是没有脆弱点。

最大的脆弱点恰恰来自它的定位：**它高度依赖 Claude Code 现有请求格式不发生大变动。**

一旦上游改字段名、改 prompt 模板、改上报路径、加新侧信道，它就得跟着补。

所以这不是“一劳永逸”的方案，而是一个**必须伴随客户端版本持续维护**的小型对抗工程。

---

## 我对 cc-gateway 的最终判断

如果只问一句：“这个项目到底有没有货？”

我的答案是：**有，而且是有明确工程思路的货。**

它不是靠阴谋论撑起来的，也不是 README 写得很吓人、代码却空心的那种项目。它确实落地实现了：

- 身份统一
- 指纹归一
- prompt 环境信息清洗
- OAuth 中控化
- 代理存在痕迹的剔除

但如果再追问一句：“那它是不是已经证明了所有外界传闻？”

我的答案还是：**没有。**

读代码能得出的最稳妥结论是：

> `cc-gateway` 提供了一套让 Claude Code 多客户端在上游看起来更一致的工程方案。

至于这些一致性会不会直接影响风控、影响到什么程度、是否和某些地区策略相关，那是另一个层面的证据链，不能拿这一个仓库直接顶上去。

---

## 最后一句

这件事最有意思的地方，不在“瓜”本身，而在它再次提醒我们：

今天很多所谓 AI 产品能力、权限边界、风控手段，最后都不是抽象概念，而是非常具体的工程实现。

而真正有判断力的人，最好别停在情绪层面。

还是要回到代码。

---

参考：

- 项目仓库：[motiful/cc-gateway](https://github.com/motiful/cc-gateway)
- 重点文件：`src/proxy.ts`、`src/rewriter.ts`、`src/oauth.ts`、`config.example.yaml`、`tests/rewriter.test.ts`
