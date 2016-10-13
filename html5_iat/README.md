#h5 iat
====

usage
----
- 引入文件
    + 引入 iat.all.min.js
    + 或 将 audio/* common/* iat.js 引入与对应页面同一个域（worker不能跨域）
- 初始化

```javascript
var session = new IFlyIatSession({
    callback:{
       "onResult": function (err, result) {

       },
       "onVolume": function () {
           //待实现
       },
       "onError":function(){

       },
       "onProcess":function(status){
           switch (status){
               case 'onStart':
                   break;
               case 'started':
                   break;
               case 'onStop':
                   break;
               case 'onEnd':
                   break;
           }
       }

    }
}});
```

- 开始会话

```javascript
//ssb_param 文档待补充
session.start(ssb_param)
```

- 手工结束会话（获取结果）

```javascript
session.stop();
```

- 结束麦克风调用（释放硬件占用）

```
session.kill();
```

建议使用方法，在页面不可见时进行该处理

```
document.addEventListener("visibilitychange",function(){
    if(document.hidden == true){
        session.kill();
    }
});

```