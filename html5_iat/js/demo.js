/**
 * Created by zhangqi on 16/10/12.
 */

var iat_result = document.getElementById('iat_result');
var tip = document.getElementById('a');
var oldText = tip.innerHTML;
/* 标识麦克风按钮状态，按下状态值为true，否则为false */
var mic_pressed = false;


/***********************************************local Variables**********************************************************/

/**
 * 初始化Session会话
 */
var session = new IFlyIatSession({
    "callback":{
        "onResult": function (err, result) {
            /* 若回调的err为空或错误码为0，则会话成功，可提取识别结果进行显示*/
            if (err == null || err == undefined || err == 0) {
                if (result == '' || result == null)
                    iat_result.innerHTML = "没有获取到识别结果";
                else
                    iat_result.innerHTML = result;
                /* 若回调的err不为空且错误码不为0，则会话失败，可提取错误码 */
            } else {
                iat_result.innerHTML = 'error code : ' + err + ", error description : " + result;
            }
            mic_pressed = false;
        },
        "onVolume": function () {
            //待实现
        },
        "onError":function(){

        },
        "onProcess":function(status){
            switch (status){
                case 'onStart':
                    tip.innerHTML = "服务初始化...";
                    break;
                case 'started':
                    tip.innerHTML = "倾听中...";
                    break;
                case 'onStop':
                    tip.innerHTML = "等待结果...";
                    break;
                case 'onEnd':
                    tip.innerHTML = oldText;
            }
        }
    }
});


function play() {
    if (!mic_pressed) {
        var ssb_param = {
            "grammar_list": null,
            "params": "appid=577ca2ac,appidkey=6c175cb6c60bc27b, lang = sms, acous = anhui, aue=speex-wb;-1, usr = mkchen, ssm = 1, sub = iat, net_type = wifi, rse = utf8, ent =sms16k, rst = plain, auf  = audio/L16;rate=16000, vad_enable = 1, vad_timeout = 5000, vad_speech_tail = 500, compress = igzip"
        };
        iat_result.innerHTML = '   ';
        /* 调用开始录音接口，通过function(volume)和function(err, obj)回调音量和识别结果 */
        session.start(ssb_param);
        mic_pressed = true;
    }
    else {
        //停止麦克风录音，仍会返回已传录音的识别结果.
        session.stop();
    }
}

/**
 * 取消本次会话识别
 */
function cancel() {
    session.cancel();
}
//页面不可见，断开麦克风调用
document.addEventListener("visibilitychange",function(){
    if(document.hidden == true){
        session.kill();
    }
});

