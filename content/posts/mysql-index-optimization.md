---
title: "MySQL 索引原理与优化实战"
date: "2020-06-18"
draft: false
tags: ["MySQL", "索引", "性能优化", "数据库"]
categories: ["后端工程"]
description: "索引是 MySQL 性能优化的核心。这篇文章从 B+ 树原理出发，讲清楚索引的工作机制，以及常见的失效场景。"
---

面试必考，工作必用。索引这个话题说简单也简单，说复杂也复杂。这篇文章尝试把最实用的部分说清楚。

## B+ 树索引的工作原理

MySQL InnoDB 的索引底层是 **B+ 树**。B+ 树的特点：

- 所有数据存在叶子节点
- 叶子节点之间用链表相连（支持范围查询）
- 非叶子节点只存键值，不存数据（让每层能存更多节点）

这意味着一次查询最多只需要走 **树高** 次 IO。对于千万级的表，B+ 树高度通常只有 3-4 层，也就是 3-4 次 IO 就能找到数据。

## 聚簇索引 vs 二级索引

**聚簇索引**（主键索引）：叶子节点直接存行数据。

**二级索引**（普通索引）：叶子节点存的是主键值，查到后还需要回表（再走一次聚簇索引）。

```sql
-- 走二级索引，需要回表
SELECT * FROM users WHERE name = 'Kada';

-- 覆盖索引，不需要回表（索引包含了所有需要的字段）
SELECT id, name FROM users WHERE name = 'Kada';
```

**覆盖索引**是避免回表的常用技巧，查询的字段都在索引里，就不用回表了。

## 联合索引的最左前缀原则

```sql
-- 建了联合索引 (a, b, c)
CREATE INDEX idx_abc ON t (a, b, c);

-- 能用到索引
WHERE a = 1
WHERE a = 1 AND b = 2
WHERE a = 1 AND b = 2 AND c = 3

-- 不能用到索引（跳过了 a）
WHERE b = 2
WHERE c = 3
WHERE b = 2 AND c = 3
```

联合索引按最左前缀匹配，中间不能断。

## 索引失效的常见场景

```sql
-- 1. 对索引列做函数操作
WHERE YEAR(create_time) = 2024       -- 失效
WHERE create_time >= '2024-01-01'    -- 有效

-- 2. 隐式类型转换（phone 是 varchar，传了 int）
WHERE phone = 13812345678            -- 失效（触发类型转换）
WHERE phone = '13812345678'          -- 有效

-- 3. like 以通配符开头
WHERE name LIKE '%Kada'              -- 失效
WHERE name LIKE 'Kada%'              -- 有效

-- 4. OR 条件（其中一个字段没索引）
WHERE a = 1 OR b = 2                 -- 如果 b 没索引，整个查询不走索引

-- 5. NOT IN / NOT EXISTS
WHERE id NOT IN (1, 2, 3)           -- 通常不走索引
```

## EXPLAIN 读懂执行计划

```sql
EXPLAIN SELECT * FROM users WHERE name = 'Kada';
```

重点看几个字段：

- `type`：`const` > `ref` > `range` > `index` > `ALL`（ALL 是全表扫描，要避免）
- `key`：实际使用的索引
- `rows`：估计扫描的行数，越小越好
- `Extra`：`Using index`（覆盖索引）、`Using filesort`（文件排序，需要优化）

## 一些实践原则

- 区分度低的字段不要建索引（比如性别，只有两个值）
- 频繁更新的字段慎重建索引（维护索引有成本）
- 不要建太多索引，一般单表不超过 5-6 个
- 大表加索引要在低峰期做，用 `pt-online-schema-change` 或 MySQL 8.0 的在线 DDL
