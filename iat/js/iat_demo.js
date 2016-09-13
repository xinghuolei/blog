/*
 author:cyhu(viskey.hu@gmail.com) 2014.6.26

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 1. Redistributions of source code must retain the above copyright notice,
 this list of conditions and the following disclaimer.

 2. Redistributions in binary form must reproduce the above copyright
 notice, this list of conditions and the following disclaimer in
 the documentation and/or other materials provided with the distribution.

 3. The names of the authors may not be used to endorse or promote products
 derived from this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
 INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
 INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
 INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
 OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
var iat_result = document.getElementById('iat_result');

//swfobject.registerObject("myId", "9.0.0", "../js/audio/recorder.swf");

/**
  * 初始化Session会话
  * url                 连接的服务器地址（可选）
  * reconnection        客户端是否支持断开重连
  * reconnectionDelay   重连支持的延迟时间   
  */
var session = new IFlyIatSession({
									 'url'				  : 'ws://h5.xf-yun.com/iat.do',
                                     'reconnection'       : true,
									 'reconnectionDelay'  : 30000,
									 'compress'           : 'speex'
						        });
						 
/* 标识麦克风按钮状态，按下状态值为true，否则为false */
var mic_pressed = false;
/* 音量动画渲染对象 */
var w = $('#a').wav();
/***********************************************local Variables**********************************************************/

function play()
{
    if(!mic_pressed)
	{
	
		var ssb_param = {"grammar_list" : null, "params" : "aue=speex-wb;-1, usr = mkchen, ssm = 1, sub = iat, net_type = wifi, rse = utf8, ent =sms16k, rst = plain, auf  = audio/L16;rate=16000, vad_enable = 1, vad_timeout = 5000, vad_speech_tail = 500, compress = igzip, caller.appid = 50287829", "signature" : "TEST SIGNATURE"};		
	    iat_result.innerHTML = '   ';
		/* 调用开始录音接口，通过function(volume)和function(err, obj)回调音量和识别结果 */
		session.start(ssb_param , function (volume)
		{		
			if(volume < 6 && volume > 0)
				w.waveChange(volume);
			/* 若volume返回负值，说明麦克风启动失败*/
			if(volume < 0)
				console.log("麦克风启动失败");
		}, function (err, result)
		{
				/* 若回调的err为空或错误码为0，则会话成功，可提取识别结果进行显示*/
				if(err == null || err == undefined || err == 0)
				{
					if(result == '' || result == null)
						iat_result.innerHTML = "没有获取到识别结果";
					else
						iat_result.innerHTML = result;
					/* 若回调的err不为空且错误码不为0，则会话失败，可提取错误码 */
				} else
				{
					iat_result.innerHTML = 'error code : ' + err + ", error description : " + result;
				}
				mic_pressed = false;
		}, function(message)
        {
			if(message == 'onStop')
			{
				console.log("录音停止");
			} else if(message == 'onEnd')
			{
				console.log("会话结束");
			}
        });
	 	mic_pressed = true;
	}
	else
	{
	    //停止麦克风录音，仍会返回已传录音的识别结果.
		session.stop( null );
	}
}

/**
 * 取消本次会话识别
 */
function cancel()
{
	session.cancel();
}

