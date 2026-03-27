---
title: "微信官方小龙虾插件协议拆解"
date: "2026-03-22"
draft: false
tags: ["Agent", "微信", "OpenClaw", "协议分析", "工程实践"]
categories: ["AI Agent"]
description: "微信发布官方龙虾插件，支持 OpenClaw 接入个人微信。本文深入源代码，拆解其完整协议实现：登录链路、消息收发、媒体协议、输入态。"
---

今天微信发布了官方龙虾插件 [微信ClawBot](https://mp.weixin.qq.com/s/WUvOXV-XQcPv6SJjEEnOaQ)，支持 OpenClaw 接入个人微信。

第一时间尝试之后，深入源代码，分析其协议实现。废话不多说，直接开始。

---

## 一张图先看全局

整套协议的结构其实非常规整：控制面走 Bot 网关，��据面走 CDN，插件本地负责把两者接起来。

![](https://files.mdnice.com/user/180844/4b2b190f-5cd8-441b-8e40-d4a0c3404012.png)

控制面接口主要有 5 个：

- `getupdates`
- `sendmessage`
- `getuploadurl`
- `getconfig`
- `sendtyping`

数据面则只有一件事：**媒体文件通过 CDN 上传/下载，本地做 AES-128-ECB 加解密。**

这就是理解整套协议的入口。

---

## 1. 登录链路：二维码授权 -> `bot_token`

先看登录。

插件登录阶段只依赖两个接口：

- `GET /ilink/bot/get_bot_qrcode?bot_type=3`
- `GET /ilink/bot/get_qrcode_status?qrcode=...`

第一步拿二维码，第二步轮询二维码状态。它的状态机大致如下：

![](https://files.mdnice.com/user/180844/0fbe4b61-8b1b-4cbd-af3d-e5ca26737f51.png)

确认授权后，服务端会返回：

```json
{
  "status": "confirmed",
  "bot_token": "<bot_token>",
  "ilink_bot_id": "xxxxxxxx@im.bot",
  "ilink_user_id": "xxxxxxxx@im.wechat",
  "baseurl": "https://ilinkai.weixin.qq.com"
}
```

这里真正关键的是 4 个字段：

- `bot_token`：后续所有业务请求的 Bearer 凭证
- `ilink_bot_id`：Bot 身份
- `ilink_user_id`：绑定的微信用户
- `baseurl`：服务端下发的 API 基址

插件会把这些值保存到本地账号文件，后续 gateway 启动时直接复用。

一句话概括登录阶段：**二维码只是授权入口，真正建立会话能力的是 `bot_token`。**

---

## 2. 统一请求头：协议外壳非常稳定

除了扫码登录用 GET 之外，后续业务接口基本都是 JSON POST。统一请求头如下：

```http
Content-Type: application/json
AuthorizationType: ilink_bot_token
Authorization: Bearer <bot_token>
X-WECHAT-UIN: <base64(random uint32 decimal string)>
SKRouteTag: <optional>
```

这里可以顺手记住 3 个实现细节。

### 2.1 `AuthorizationType`

固定值是：

```http
AuthorizationType: ilink_bot_token
```

这说明鉴权模型很明确，就是 Bot Token 模式。

### 2.2 `X-WECHAT-UIN`

插件不是用固定设备号，而是每次请求生成一个随机 uint32，再转十进制字符串做 base64。

也就是说，这个字段更像协议兼容字段，而不是稳定设备身份。

### 2.3 `base_info`

插件还会在请求体里自动附加：

```json
{
  "base_info": {
    "channel_version": "1.0.2"
  }
}
```

它不是业务字段，更像渠道版本上报。

---

## 3. 收消息：`getupdates` 长轮询 + `get_updates_buf`

收消息完全依赖这个接口：

```http
POST /ilink/bot/getupdates
```

最小请求体如下：

```json
{
  "get_updates_buf": "",
  "base_info": {
    "channel_version": "1.0.2"
  }
}
```

一个典型返回体会长这样：

```json
{
  "ret": 0,
  "msgs": [
    {
      "from_user_id": "user@im.wechat",
      "to_user_id": "bot@im.bot",
      "message_type": 1,
      "message_state": 0,
      "context_token": "opaque-context-token",
      "item_list": [
        {
          "type": 1,
          "text_item": {
            "text": "你好"
          }
        }
      ]
    }
  ],
  "get_updates_buf": "opaque-next-buf",
  "longpolling_timeout_ms": 35000
}
```

这里最值得注意的是 `get_updates_buf`。

从语义上看，它就是"下次继续拉消息"的同步游标；
但从本机真实样本看，它不是简单 offset，也不是普通 seq，而是一个带状态的 opaque blob。

所以客户端实现最稳妥的方式只有一种：

- 收到什么，原样保存
- 下次请求，原样回传
- 不要试图自己解析或构造它

此外，`longpolling_timeout_ms` 是服务端给出的下一轮轮询超时建议，插件会直接采用它，动态调整后续长轮询节奏。

如果把这一节总结成一句话，就是：**`getupdates` 是整条入站链路的入口，而 `get_updates_buf` 是整条入站链路的状态锚点。**

---

## 4. 消息结构：核心不是文本，而是 `item_list`

协议里的统一消息结构是 `WeixinMessage`。核心字段包括：

- `from_user_id`
- `to_user_id`
- `message_type`
- `message_state`
- `context_token`
- `item_list`

其中真正承载内容的是 `item_list`，支持这些类型：

- `1` TEXT
- `2` IMAGE
- `3` VOICE
- `4` FILE
- `5` VIDEO

也就是说，这套协议从一开始就不是"文本优先"的，它是一个统一消息容器模型。

插件把入站消息转换成 OpenClaw 内部上下文时，处理规则也很直接：

- 文本：取 `text_item.text`
- 语音：如果已经带识别文本，则优先直接用识别结果
- 图片/文件/视频/语音附件：先从 CDN 下载并解密，再交给上层处理

这一层做的事情，本质上就是把"协议消息结构"转换成"Agent 可消费的上下文对象"。

---

## 5. `context_token`：回复链路的硬约束

如果整套协议只挑一个最关键字段，那就是 `context_token`。

它出现在每条入站消息里，插件收到之后会缓存到：

- `accountId + userId`

对应的内存键中。

后续回复用户时，插件会强制要求把这个 token 原样带回去。没有它，直接拒绝发送。

这意味着：

- 发送消息不能只知道 `to_user_id`
- `context_token` 是会话绑定字段
- 这套协议天然偏"会话型回复"，而不是"任意对象主动推送"

这一点非常重要，因为它决定了整个发送模型。

从工程视角看，`context_token` 的存在把"谁是接收方"和"这条回复属于哪个上下文"这两件事拆开了。只知道接收方不够，**还必须知道它属于哪条对话上下文。**

---

## 6. 文本发送：`sendmessage`

文本发送接口是：

```http
POST /ilink/bot/sendmessage
```

最小请求体如下：

```json
{
  "msg": {
    "to_user_id": "user@im.wechat",
    "client_id": "client-msg-id",
    "message_type": 2,
    "message_state": 2,
    "context_token": "opaque-context-token",
    "item_list": [
      {
        "type": 1,
        "text_item": {
          "text": "hello"
        }
      }
    ]
  },
  "base_info": {
    "channel_version": "1.0.2"
  }
}
```

这里有 4 个固定约束：

- `message_type = 2`：BOT
- `message_state = 2`：FINISH
- `context_token`：必须带
- `client_id`：客户端本地生成的消息 ID

插件还有一个实现策略很值得记：

如果同时发文字和媒体，它不是一次性构造复杂 `item_list`，而是拆成多次发送：

- 先发文本
- 再发媒体项

这是一种很保守的处理方式，但工程上通常更稳，更容易和网关兼容。

---

## 7. 媒体协议：`getuploadurl -> 本地加密 -> CDN -> 消息引用`

媒体链路是整套协议最值得单独拆的部分。

![](https://files.mdnice.com/user/180844/cc56d16a-59a3-4baa-ade6-41d6a73ff2c7.png)

整条链路可以拆成 4 步。

### 7.1 先拿上传参数

```http
POST /ilink/bot/getuploadurl
```

请求体里的关键字段包括：

- `rawsize`：明文大小
- `rawfilemd5`：明文 MD5
- `filesize`：加密后的密文大小
- `aeskey`：16 字节 AES key 的 hex 字符串
- `media_type`：媒体类型

### 7.2 本地加密

插件源码里明确使用：

```ts
createCipheriv("aes-128-ecb", key, null)
```

也就是：

- 算法：AES-128-ECB
- padding：PKCS7

### 7.3 上传 CDN

```http
POST /c2c/upload?encrypted_query_param=<upload_param>&filekey=<filekey>
Content-Type: application/octet-stream
```

上传成功后，关键结果不在 body，而在响应头：

```http
x-encrypted-param: <download-encrypted-param>
```

### 7.4 发送媒体引用

最终发给 `sendmessage` 的不是文件本体，而是媒体引用：

```json
{
  "type": 2,
  "image_item": {
    "media": {
      "encrypt_query_param": "<download-encrypted-param>",
      "aes_key": "<base64-aes-key>",
      "encrypt_type": 1
    },
    "mid_size": 12352
  }
}
```

这一点非常关键：**消息层只传引用，不传文件本体。**

这也是为什么媒体链路天然分成"控制面"和"数据面"两部分。

---

## 8. 媒体下载：CDN + AES 解密

入站媒体消息的处理方向与发送相反：

1. 从消息里拿到 `encrypt_query_param`
2. 拼出 CDN 下载 URL
3. 拉回密文文件
4. 用 `aes_key` 解密
5. 保存为本地媒体文件

图片、文件、视频都走这条链路。语音还有一步额外处理：

- 如果是 SILK，则尝试转 WAV
- 转码失败再保留原始 SILK

这里还有一个兼容性细节必须注意：`aes_key` 存在两类编码格式。

### 格式 1：`base64(raw 16 bytes)`

常见于图片。

### 格式 2：`base64(hex string)`

也就是先 hex，再 base64。插件下载时会先判断是哪一种，再还原为真正的 16 字节密钥。

如果自己实现客户端，这里必须做兼容处理。

---

## 9. 输入态：`getconfig` + `sendtyping`

输入中状态不是插件本地模拟，而是协议的一部分。

### 9.1 先拿 `typing_ticket`

```http
POST /ilink/bot/getconfig
```

请求体：

```json
{
  "ilink_user_id": "user@im.wechat",
  "context_token": "opaque-context-token",
  "base_info": {
    "channel_version": "1.0.2"
  }
}
```

返回：

```json
{
  "ret": 0,
  "typing_ticket": "<base64-ticket>"
}
```

### 9.2 再发 `sendtyping`

```http
POST /ilink/bot/sendtyping
```

请求体：

```json
{
  "ilink_user_id": "user@im.wechat",
  "typing_ticket": "<typing_ticket>",
  "status": 1,
  "base_info": {
    "channel_version": "1.0.2"
  }
}
```

其中：

- `status = 1`：正在输入
- `status = 2`：取消输入

插件在 AI 生成回复期间会周期性发送 `status = 1`，结束后再发送 `status = 2`。

---

## 10. 最小复现：兼容客户端至少需要哪些请求

如果只看最小闭环，核心就是下面几组调用。

### 登录

```bash
curl 'https://ilinkai.weixin.qq.com/ilink/bot/get_bot_qrcode?bot_type=3'
```

```bash
curl 'https://ilinkai.weixin.qq.com/ilink/bot/get_qrcode_status?qrcode=<qrcode>' \
  -H 'iLink-App-ClientVersion: 1'
```

### 拉消息

```bash
curl 'https://ilinkai.weixin.qq.com/ilink/bot/getupdates' \
  -H 'Content-Type: application/json' \
  -H 'AuthorizationType: ilink_bot_token' \
  -H 'Authorization: Bearer <bot_token>' \
  -H 'X-WECHAT-UIN: <uin>' \
  --data-raw '{
    "get_updates_buf": "",
    "base_info": { "channel_version": "1.0.2" }
  }'
```

### 发文本

```bash
curl 'https://ilinkai.weixin.qq.com/ilink/bot/sendmessage' \
  -H 'Content-Type: application/json' \
  -H 'AuthorizationType: ilink_bot_token' \
  -H 'Authorization: Bearer <bot_token>' \
  -H 'X-WECHAT-UIN: <uin>' \
  --data-raw '{
    "msg": {
      "to_user_id": "user@im.wechat",
      "client_id": "client-msg-id",
      "message_type": 2,
      "message_state": 2,
      "context_token": "opaque-context-token",
      "item_list": [
        { "type": 1, "text_item": { "text": "hello" } }
      ]
    },
    "base_info": { "channel_version": "1.0.2" }
  }'
```

### 发媒体

先 `getuploadurl`，再上传 CDN，最后用媒体引用调用 `sendmessage`。这三步缺一不可。

### 输入态

```bash
curl 'https://ilinkai.weixin.qq.com/ilink/bot/getconfig' ...
curl 'https://ilinkai.weixin.qq.com/ilink/bot/sendtyping' ...
```

---

## 11. 最容易踩的 4 个坑

最后把最常见的实现坑总结一下。

### 坑 1：把 `get_updates_buf` 当 offset

不要这么做。它应该被当成 opaque state blob。

### 坑 2：回复时漏掉 `context_token`

这是最容易出错的一点。只知道 `to_user_id` 不够。

### 坑 3：媒体直接发给 `sendmessage`

不行。必须先 `getuploadurl`，再本地加密上传 CDN，最后发媒体引用。

### 坑 4：忽略 `aes_key` 的两种编码格式

下载解密时必须兼容：

- `base64(raw bytes)`
- `base64(hex string)`

---

## 结尾

把这套协议拆开之后，整个实现其实非常规整：

- 登录：二维码授权拿 `bot_token`
- 收消息：`getupdates` 长轮询 + `get_updates_buf`
- 回复：`sendmessage`，并且强依赖 `context_token`
- 媒体：`getuploadurl` + AES-128-ECB + CDN 引用
- 输入态：`getconfig` + `sendtyping`

理解这套协议之后，你就能实现一个兼容微信ClawBot 的客户端。

> 如果这类 Agent 基础设施和协议拆解内容对你有帮助，欢迎关注「Agent工程手记」。
