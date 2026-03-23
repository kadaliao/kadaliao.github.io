---
title: "MySQL 事务、锁与死锁排查"
date: "2020-10-25"
draft: false
tags: ["MySQL", "事务", "锁", "死锁", "数据库"]
categories: ["后端工程"]
description: "事务和锁是 MySQL 并发控制的核心机制，也是线上问题的高发区。这篇文章梳理事务隔离级别、锁的类型，以及死锁的排查思路。"
---

事务和锁是 MySQL 里最复杂也最容易出问题的部分。这篇文章从实际问题出发，梳理核心概念和排查思路。

## 事务隔离级别

MySQL 有四种隔离级别，对应不同的并发问题：

| 隔离级别 | 脏读 | 不可重复读 | 幻读 |
|---------|------|---------|------|
| READ UNCOMMITTED | ✓ 可能 | ✓ 可能 | ✓ 可能 |
| READ COMMITTED | ✗ 不会 | ✓ 可能 | ✓ 可能 |
| REPEATABLE READ（默认）| ✗ 不会 | ✗ 不会 | 部分解决 |
| SERIALIZABLE | ✗ 不会 | ✗ 不会 | ✗ 不会 |

**InnoDB 默认是 REPEATABLE READ**，并且通过 MVCC + Gap Lock 解决了大部分幻读问题。

## InnoDB 的锁类型

**行锁**（最常用）：
- 共享锁（S 锁）：`SELECT ... LOCK IN SHARE MODE`，允许多个事务同时读
- 排他锁（X 锁）：`SELECT ... FOR UPDATE` 或增删改，同一时间只有一个事务能持有

**意向锁**：表级别的锁，表示"我将要对某些行加行锁"，用于快速判断表级操作是否冲突。

**Gap Lock（间隙锁）**：锁定索引记录之间的间隙，防止插入新记录，解决幻读。

**Next-Key Lock**：行锁 + Gap Lock 的组合，InnoDB 在 REPEATABLE READ 下默认使用。

## 常见的锁等待场景

```sql
-- 事务 A
BEGIN;
UPDATE orders SET status = 'paid' WHERE id = 100;
-- 持有 id=100 的 X 锁，还没提交

-- 事务 B（在 A 提交前执行）
BEGIN;
UPDATE orders SET status = 'shipped' WHERE id = 100;
-- 等待 A 释放锁
```

查看当前锁等待情况：

```sql
-- MySQL 8.0
SELECT * FROM performance_schema.data_lock_waits\G

-- 查看持有锁的事务
SELECT * FROM information_schema.INNODB_TRX\G
```

## 死锁

死锁发生在两个事务互相等待对方释放锁：

```
事务 A 持有 id=1 的锁，等待 id=2
事务 B 持有 id=2 的锁，等待 id=1
```

InnoDB 会自动检测死锁，选择代价较小的事务回滚，另一个事务继续执行。

查看最近一次死锁信息：

```sql
SHOW ENGINE INNODB STATUS\G
-- 看 LATEST DETECTED DEADLOCK 部分
```

## 如何避免死锁

**1. 保持一致的加锁顺序**

```python
# 不好：A 先锁用户再锁订单，B 先锁订单再锁用户，可能死锁
# 好：所有事务都按 用户 → 订单 的顺序加锁
```

**2. 减少事务持有锁的时间**

```python
# 不好：事务里做 HTTP 请求（耗时不可控）
with db.transaction():
    order = db.query("SELECT ... FOR UPDATE")
    result = requests.post("https://payment-api/pay")  # 可能很慢
    db.update(order)

# 好：HTTP 请求放在事务外
result = requests.post("https://payment-api/pay")
with db.transaction():
    order = db.query("SELECT ... FOR UPDATE")
    db.update(order)
```

**3. 合理使用索引**

没有索引的 UPDATE/DELETE 会锁全表，大大增加锁冲突概率。

## 实践建议

- 线上发现锁等待超时，先查 `information_schema.INNODB_TRX`，看有没有长事务
- 对于高并发的场景，优先考虑乐观锁（version 字段 + CAS 更新）而不是悲观锁
- 定期检查慢查询日志，全表扫描是锁冲突的重灾区
