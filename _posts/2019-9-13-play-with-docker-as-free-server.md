---
layout: post
title: 免费、简便的linux server获取妙招
---

今天看到一篇介绍网络协议发展史的文章，其中关于**HTTP 0.9**版本，我需要做一些实验。

## HTTP 0.9

> 历史上第一个有记载的 HTTP 版本是 0.9([The HTTP Protocol As Implemented In W3](https://link.zhihu.com/?target=https%3A//www.w3.org/Protocols/HTTP/AsImplemented.html))，它诞生在 1991 年。这个协议被设计用于从服务器获取 HTML 文档。
>
> 整个协议的请求只有1行：`GET` 加文档路径。`GET` 无需多解释，是 HTTP 至今都一直保留的 "method"，是 HTTP 的动词。1991 年的 HTTP 仅支持 `GET` 这唯一的动词。之后的路径是文档在服务器的位置（逻辑位置），即实际要获取的内容。请求以换行结束。服务器收到请求之后，就会返回对应的 HTML 文档内容。输出完毕后，关闭连接。
>
> 当时的 HTTP 协议是一个非常简单的文本协议。直到今天，我们熟悉的 memcached 和 redis 还是使用类似风格的协议。

据说谷歌到现在都是支持HTTP 0.9的，我决定用`telnet`工具来连接www.google.com的80端口，发起请求试试。

当我打开命令行，输入`telnet www.google.com 80`，得到的确是这样的结果：


然鹅我本机的代理只支持http和socks，只能寻求一台部署在海外的主机才能继续尝试。

可以使用阿里云、腾讯云等云计算厂商的海外节点，或者AWS、DigitalOcean等。但是选择实例配置、设置安全组、密码、安装系统等一堆操作下来，太费事。我只是想做个简单的网络访问实验而已！

有什么更便捷、更临时的办法吗？

## Play with Docker

> 一个Docker的演练场，它可以让用户在几秒钟内运行Docker命令。用户可以在浏览器中体验免费的Alpine Linux虚拟机，在这里用户可以构建、运行Docker容器，甚至可以在Docker Swarm模式下创建集群。除了演练场之外，PWD还包含了一个由大量Docker labs实例和测试组成的培训网站。

访问[Play with Docker](https://labs.play-with-docker.com)，登录之后，便会获得4个小时的session。此时添加instance，`docker run whatever you want`就好啦，GFW不再是阻隔。

![pwd](https://tva1.sinaimg.cn/large/006y8mN6gy1g6ycv6h5pfj31c00u0tbb.jpg)

