---
layout: post
title: MySQL导入大量数据报错
tags: mysql
---

使用MySQL执行SQL文件以导入大量数据时，会报错2006: MySQL server has gone away。

原因是`max_allowed_packet`配置默认值为4M，限制了服务端能接受的数据包大小。

解决办法：增大参数

```
mysql> show global variables like 'max_allowed_packet';
+--------------------+---------+
| Variable_name      | Value   |
+--------------------+---------+
| max_allowed_packet | 4194304 |
+--------------------+---------+

mysql> set global max_allowed_packet=67108864;
Query OK, 0 rows affected (0.00 sec)
 
mysql> show global variables like 'max_allowed_packet';
+--------------------+-----------+
| Variable_name      | Value     |
+--------------------+-----------+
| max_allowed_packet | 67108864 |
+--------------------+-----------+
1 row in set (0.00 sec)
```

使用命令行设置参数只对当前有效，重启mysql服务后会恢复为默认设置；如果需要持久化设置，可修改my.cnf文件，在`[mysqld]`段增加`max_allowed_packet=64M`。


