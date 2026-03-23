---
title: "Python ORM 选型：SQLAlchemy vs Tortoise-ORM vs Peewee"
date: "2022-07-19"
draft: false
tags: ["Python", "ORM", "SQLAlchemy", "数据库"]
categories: ["后端工程"]
description: "Python 生态里有多个成熟的 ORM，选哪个取决于你的场景。这篇文章对比三个主流选择。"
---

Python 的 ORM 生态比较分散，没有像 Rails ActiveRecord 那样一统天下的选择。这篇文章对比一下我用过的几个。

## SQLAlchemy：工业级首选

SQLAlchemy 是 Python 生态里最成熟、功能最强的 ORM，分两层：

- **Core**：SQL 表达式语言，接近裸 SQL
- **ORM**：高级对象映射层

```python
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey
from sqlalchemy.orm import DeclarativeBase, relationship, Session

engine = create_engine("mysql+pymysql://user:pass@localhost/mydb")

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    email = Column(String(100), unique=True)
    orders = relationship("Order", back_populates="user")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    total = Column(Integer)
    user = relationship("User", back_populates="orders")

# 查询
with Session(engine) as session:
    users = session.query(User).filter(User.name.like("K%")).all()

    # 预加载关联数据（避免 N+1 问题）
    from sqlalchemy.orm import selectinload
    users = session.query(User).options(selectinload(User.orders)).all()
```

**SQLAlchemy 2.0 新语法**（推荐）：

```python
from sqlalchemy import select

with Session(engine) as session:
    stmt = select(User).where(User.name.like("K%"))
    users = session.execute(stmt).scalars().all()
```

**优点**：功能极强，支持复杂查询，文档完善，生态成熟。
**缺点**：学习曲线陡，概念多（Session、Unit of Work、lazy loading……）。

## Tortoise-ORM：异步场景的选择

专为 asyncio 设计，和 FastAPI 配合很顺手：

```python
from tortoise import fields
from tortoise.models import Model

class User(Model):
    id = fields.IntField(pk=True)
    name = fields.CharField(max_length=50)
    email = fields.CharField(max_length=100, unique=True)

    class Meta:
        table = "users"

# 异步查询
users = await User.filter(name__startswith="K").all()
user = await User.get(id=1)
await User.create(name="Kada", email="kada@example.com")

# 预取关联
users = await User.all().prefetch_related("orders")
```

**优点**：原生异步，API 简洁，和 Django ORM 风格类似。
**缺点**：生态不如 SQLAlchemy 成熟，复杂查询表达能力弱一些。

## Peewee：轻量场景

适合小项目或脚本，API 极简：

```python
from peewee import *

db = MySQLDatabase("mydb", host="localhost", user="root", password="xxx")

class User(Model):
    name = CharField()
    email = CharField(unique=True)

    class Meta:
        database = db

db.connect()
db.create_tables([User])

User.create(name="Kada", email="kada@example.com")
users = User.select().where(User.name.startswith("K"))
```

**优点**：上手极快，代码量少，适合小工具和脚本。
**缺点**：不支持异步，大项目扩展性有限。

## 选型建议

| 场景 | 推荐 |
|------|------|
| 同步 Web 应用（Django/Flask） | SQLAlchemy |
| 异步 Web 应用（FastAPI） | Tortoise-ORM 或 SQLAlchemy（async 模式）|
| 小脚本、数据处理 | Peewee |
| 需要复杂 SQL | SQLAlchemy Core |

我现在的项目基本都是 FastAPI + SQLAlchemy（用异步引擎），两者配合得不错，也不需要为不同场景切换工具。
