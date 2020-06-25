---
layout: post
title: 在docker中通过代理为elasticsearch安装插件
tags: docker elasticsearch
---

要为运行中的elasticsearch container安装插件，`docker-compose exec <ealsticsearch_service_name> bin/elasticsearch-plugin install <plugin>`即可。

但是现在得各种服务器，访问github以及其他海外网站都卡出翔，不走代理是不行的。

作为Java程序，配置系统级别的`http_proxy / https_proxy`无法生效，需要对应的Java环境变量才行。


```bash
# 1. 进入容器shell
docker-compose exec -it <ealsticsearch_service_name> bash

# 2. 配置Java网络环境变量
ES_JAVA_OPTS="-Dhttp.proxyHost=proxyhost -Dhttp.proxyPort=proxyport -Dhttps.proxyHost=proxyhost -Dhttps.proxyPort=proxyport"

# 3. 执行插件安装程序
bin/elasticsearch-plugin install <plugin>
```
