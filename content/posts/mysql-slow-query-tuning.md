---
title: "MySQL 慢查询排查：从发现到解决"
date: "2022-04-10"
draft: false
tags: ["MySQL", "慢查询", "性能优化", "数据库"]
categories: ["后端工程"]
description: "慢查询是后端性能问题的高发区。这篇文章介绍慢查询日志的配置、分析工具的使用，以及常见的优化手段。"
---

线上接口突然变慢，大概率是数据库查询出了问题。这篇文章梳理一下排查慢查询的完整流程。

## 开启慢查询日志

```sql
-- 查看当前配置
SHOW VARIABLES LIKE 'slow_query%';
SHOW VARIABLES LIKE 'long_query_time';

-- 临时开启（重启失效）
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 1;   -- 超过 1 秒的查询记录
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';

-- 永久配置（写入 my.cnf）
[mysqld]
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 1
log_queries_not_using_indexes = 1  # 记录未使用索引的查询
```

## 用 pt-query-digest 分析

手动看慢查询日志很费时，`pt-query-digest`（Percona Toolkit）可以聚合分析：

```bash
pt-query-digest /var/log/mysql/slow.log | head -100
```

输出会按响应时间降序列出各类查询，告诉你哪些查询最值得优化：

```
# Query 1: 0.50 QPS, 2.50x concurrency, ID 0xABC123
# This item is included in the report because it matches --limit.
#              pct   total     min     max     avg     95%  stddev  median
# Count         15    1000
# Exec time     80%    200s     0.1s     5s    0.2s    0.5s   0.3s   0.15s
# Rows sent      5%    500       0      10       0       1       1       0
# Rows examine  90%    900k    100     5000    900    2000    800     600
```

重点关注 `Rows examine`（扫描行数）和 `Exec time`（执行时间）。

## EXPLAIN 分析单条查询

找到慢查询后，用 `EXPLAIN` 看执行计划：

```sql
EXPLAIN SELECT u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id\G
```

关键字段：

```
id: 1
select_type: SIMPLE
table: u
type: range          -- range 是走了索引的范围扫描，还不错
key: idx_created_at  -- 使用了这个索引
rows: 5000           -- 预估扫描 5000 行
Extra: Using where; Using temporary; Using filesort
--           ↑ 有临时表和文件排序，这是性能瓶颈
```

看到 `Using filesort` 或 `Using temporary`，通常意味着需要加合适的索引或调整 GROUP BY/ORDER BY。

## 常见慢查询场景及优化

### 场景 1：JOIN 字段没有索引

```sql
-- 慢：orders.user_id 没有索引，每次都要全表扫描
SELECT * FROM users u JOIN orders o ON u.id = o.user_id;

-- 加索引
ALTER TABLE orders ADD INDEX idx_user_id (user_id);
```

### 场景 2：SELECT *

```sql
-- 慢：传输大量不需要的数据，且无法用覆盖索引
SELECT * FROM products WHERE category_id = 5;

-- 快：只取需要的字段
SELECT id, name, price FROM products WHERE category_id = 5;
```

### 场景 3：深分页

```sql
-- 慢：需要扫描并丢弃前 100000 条数据
SELECT * FROM logs ORDER BY id LIMIT 100000, 20;

-- 快：用游标分页（记录上一页最后一条的 id）
SELECT * FROM logs WHERE id > 100000 ORDER BY id LIMIT 20;
```

### 场景 4：IN 子查询

```sql
-- 慢：子查询可能导致全表扫描
SELECT * FROM orders WHERE user_id IN (
    SELECT id FROM users WHERE vip_level > 3
);

-- 快：改写为 JOIN
SELECT o.* FROM orders o
JOIN users u ON o.user_id = u.id
WHERE u.vip_level > 3;
```

## 监控建议

- 配置 Prometheus + MySQL Exporter，监控 `mysql_global_status_slow_queries` 指标
- 设置告警阈值，慢查询数量突增时及时收到通知
- 每周跑一次 `pt-query-digest`，主动发现新出现的慢查询

性能优化是持续的过程，不是一次性的工作。
