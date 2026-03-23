---
title: "FastAPI 入门：用 Python 快速构建现代 Web API"
date: "2022-03-28"
draft: false
tags: ["FastAPI", "Python", "API", "后端"]
categories: ["后端工程"]
description: "FastAPI 是目前 Python 生态里最好用的 API 框架。这篇文章介绍核心用法和它让我喜欢的几个设计。"
---

Django REST Framework 太重，Flask 太裸。FastAPI 在这两者之间找到了一个很好的平衡点。

## 为什么是 FastAPI

- **快**：基于 Starlette，性能接近 Node.js
- **自动文档**：自动生成 Swagger UI 和 ReDoc
- **类型驱动**：用 Pydantic 做数据校验，写一次模型，校验和文档都有了
- **原生异步**：完整支持 async/await

## 5 分钟上手

```bash
uv pip install fastapi uvicorn
```

```python
# main.py
from fastapi import FastAPI

app = FastAPI(title="我的 API", version="1.0.0")

@app.get("/")
def read_root():
    return {"message": "Hello, World!"}

@app.get("/users/{user_id}")
def get_user(user_id: int, include_orders: bool = False):
    return {"user_id": user_id, "include_orders": include_orders}
```

```bash
uvicorn main:app --reload
# 访问 http://localhost:8000/docs 看自动生成的文档
```

## Pydantic 模型：请求/响应的核心

```python
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime

class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    email: EmailStr
    age: int = Field(..., ge=0, le=150)

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True  # 支持从 ORM 对象创建

@app.post("/users", response_model=UserResponse, status_code=201)
def create_user(user: UserCreate):
    # FastAPI 自动解析请求体、校验字段、返回时过滤多余字段
    db_user = save_to_db(user)
    return db_user
```

Pydantic 的 `Field` 支持的校验相当丰富：字符串长度、数字范围、正则表达式……不需要手写校验逻辑。

## 依赖注入

FastAPI 的依赖注入系统是它最优雅的设计之一：

```python
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    user = verify_token(token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user

@app.get("/me")
def read_profile(current_user: User = Depends(get_current_user)):
    return current_user
```

数据库连接、认证、权限控制都可以用 `Depends` 组合，逻辑清晰且可复用。

## 异步路由

```python
import httpx

@app.get("/external-data")
async def fetch_external():
    async with httpx.AsyncClient() as client:
        response = await client.get("https://api.example.com/data")
        return response.json()
```

需要异步的路由加 `async def`，不需要的用普通 `def`，FastAPI 会自动在线程池里运行同步路由，不阻塞事件循环。

## 错误处理

```python
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from fastapi.requests import Request

# 自定义异常
class OrderNotFoundError(Exception):
    def __init__(self, order_id: int):
        self.order_id = order_id

@app.exception_handler(OrderNotFoundError)
async def order_not_found_handler(request: Request, exc: OrderNotFoundError):
    return JSONResponse(
        status_code=404,
        content={"error": {"code": "ORDER_NOT_FOUND", "message": f"订单 {exc.order_id} 不存在"}}
    )
```

## 和 Flask 的对比感受

从 Flask 迁过来之后，最大的感受是：**不用写那么多样板代码了**。参数解析、类型转换、校验报错、文档生成，以前需要自己写或者靠各种插件，FastAPI 都内置了。如果在新项目里选框架，我现在会毫不犹豫选 FastAPI。
