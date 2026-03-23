---
title: "RESTful API 设计规范：我总结的一些原则"
date: "2021-07-14"
draft: false
tags: ["API", "RESTful", "后端", "设计"]
categories: ["后端工程"]
description: "RESTful API 设计没有绝对的标准，但有一些广泛认可的实践。这篇文章总结了我在设计和评审 API 时积累的原则。"
---

在做了几年后端开发之后，我发现 API 设计的好坏对前后端协作效率影响很大。这篇文章把我总结的一些原则写下来。

## URL 设计

**用名词，不用动词**

```
# 不好
GET /getUser
POST /createOrder
DELETE /deleteProduct?id=1

# 好
GET /users/{id}
POST /orders
DELETE /products/{id}
```

**层级关系用路径表达**

```
GET /users/{userId}/orders          # 某个用户的所有订单
GET /users/{userId}/orders/{id}     # 某个用户的某个订单
```

**用复数名词**

```
GET /users      # 不是 /user
GET /products   # 不是 /product
```

## HTTP 方法的语义

| 方法 | 语义 | 幂等 |
|------|------|------|
| GET | 读取资源 | 是 |
| POST | 创建资源 | 否 |
| PUT | 全量替换资源 | 是 |
| PATCH | 部分更新资源 | 否 |
| DELETE | 删除资源 | 是 |

**幂等**意味着重复调用和调用一次效果相同，这对网络重试很重要。

## 状态码要用对

```
200 OK          - 成功
201 Created     - 创建成功（POST 之后返回）
204 No Content  - 成功但无响应体（DELETE 常用）
400 Bad Request - 客户端参数错误
401 Unauthorized - 未认证（没登录）
403 Forbidden   - 无权限（登录了但没权限）
404 Not Found   - 资源不存在
409 Conflict    - 资源冲突（如重复创建）
422 Unprocessable Entity - 参数格式正确但业务校验失败
500 Internal Server Error - 服务器内部错误
```

**最常见的错误**：把所有错误都返回 200，在响应体里用 `code` 区分。这让客户端必须解析响应体才能判断是否成功，无法用 HTTP 层面的工具（代理、监控）做处理。

## 统一的响应格式

```json
// 成功
{
    "data": { "id": 1, "name": "Kada" }
}

// 分页列表
{
    "data": [...],
    "pagination": {
        "page": 1,
        "page_size": 20,
        "total": 100
    }
}

// 错误
{
    "error": {
        "code": "USER_NOT_FOUND",
        "message": "用户不存在",
        "detail": "id=999 的用户未找到"
    }
}
```

**不要**在成功响应里加 `"code": 0, "msg": "success"` 这种包装，这是 RPC 思维，不是 REST 思维。

## 版本管理

```
# URL 里加版本号（最常用）
/api/v1/users
/api/v2/users

# Header 里指定版本（更 RESTful，但客户端不直观）
Accept: application/vnd.myapi.v1+json
```

## 过滤、排序、分页

```
GET /products?category=phone&min_price=1000&max_price=5000
GET /products?sort=price&order=asc
GET /products?page=2&page_size=20
```

用 query string 传过滤和分页参数，保持 URL 路径干净。

## 一个容易忽视的点：幂等性设计

对于 POST 创建资源，客户端重试可能导致重复创建。解决方案是**幂等键**：

```
POST /orders
Idempotency-Key: uuid-xxxxx

// 服务端记录这个 key，相同 key 的请求只处理一次
```

Stripe 的 API 就是这么设计的，是个值得借鉴的实践。
