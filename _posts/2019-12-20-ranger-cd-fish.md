---
layout: post
title: 切换至ranger中最后浏览的目录
tags: ranger fish
---


使用ranger在终端中浏览文件目录结构非常方便，很多时候你需要在找到目标目录之后，将shell的当前路径切换过去。

ranger本身体提供了一个快捷键`S`，将会新开启一个shell，打开当前路径。退出这个新shell之后，会回到ranger中。

这还不够好，如何实现自动切换呢？

可以通过脚本得到当前路径，退出ranger时候调用shell执行cd过去。

```sh
function ranger-cd                                                               
  set tempfile '/tmp/chosendir'                                                  
  /usr/bin/ranger --choosedir=$tempfile (pwd)                                    

  if test -f $tempfile                                                           
      if [ (cat $tempfile) != (pwd) ]                                            
        cd (cat $tempfile)                                                       
      end                                                                        
  end                                                                            

  rm -f $tempfile                                                                

end                                                                              

function fish_user_key_bindings                                                  
    bind \co 'ranger-cd ; fish_prompt'                                           
end
```
