/**
 * Created by zhangqi on 16/10/9.
 *
 * 动作
 * 1.发送音频 如果未结束 缓冲6组发送 audiostatu:2 代表未结束 若结束 发送缓冲区数据，发送结尾数据 audiostatu:4代表结束
 * 2.获取结果 停止录音 发送空的 终止音频 发送获取结果的指令
 * 3.会话结束 发送会话结束指令
 *
 * 动作流程
 * 1. 初始化websocket
 * 2. websocket onopen -> 发送session begin 请求
 * 3. 收到应答(cmd = ssb)获取sid,初始化会话，开始采集音频
 * 4. 收集音频 通过websocket上传服务器
 * 5. 到达末端（用户触发 or 本地检测 ）发起音频结束指令，发起获取结果指令
 * 6. 收到结果应答，发送会话结束指令，结束会话
 */
var IFlyIatSession = (function (window, navigator) {
    var setting = {
        "serverUrl": "wss://h5.openspeech.cn/iat.do",
        "recordWorkerPath": "./js/audio/recorderWorker.js",//must be a local path
        "vadWorkerPath": "./js/common/vad.js",
        "speexWorkerPath": "./js/common/speex.js"
    };

    var sessionInfo = {
        id: null,
        synId: 0//音频帧计数
    };
    var recording = false;
    var rec_state = "";
    var audioStream = null;
    var audioCtx = null;
    //init
    (function () {
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
        window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;

    })();
    var recorderWorker = (function (path) {
        var recorderWorker = new Worker(path);
        recorderWorker.onmessage = function (e) {
            //TODO 修改音量回调到主线程，减少卡顿感
            // func_on_volume(e.data.volume);//音量回调
            var buffer = e.data.buffer;
            var data = new Int16Array(buffer);
            vadWorker.sendData(data);
            speexWorker.encodeData(data);
        };
        var init = function (sampleRate) {
            recorderWorker.postMessage({
                command: 'init',
                config: {
                    sampleRate: sampleRate,
                    outputBufferLength: utils.getBufferSize()
                }
            });
        };
        var reset = function () {
            recorderWorker.postMessage({command: 'reset'});
        };
        var sendData = function (data) {
            recorderWorker.postMessage({
                command: 'record',
                buffer: data
            });
        };
        return {
            "init": init,
            "reset": reset,
            "sendData": sendData
        }
    })(setting.recordWorkerPath);

    var speexWorker = (function (path) {
        var speexWorker = new Worker(path);
        speexWorker.onmessage = function (e) {
            if (recording == false) return;
            if (e.data.command == "encode") {
                var buffer = e.data.buffer;
                var result = new Int8Array(buffer);
                audioSender.sendData(result.buffer);
            }
        };
        var init = function () {
            speexWorker.postMessage({command: 'init'});
        };
        var encodeData = function (data) {
            var output = new Int8Array();
            speexWorker.postMessage({
                command: 'encode',
                inData: data,
                inOffset: 0,
                inCount: data.length,
                outData: output,
                outOffset: 0
            });
        };
        return {
            "init": init,
            "encodeData": encodeData
        }
    })(setting.speexWorkerPath);

    var vadWorker = (function (path) {
        var vadWorker = new Worker(path);
        vadWorker.onmessage = function (e) {
            if (e.data.command == "esvad" && e.data.message == 'end') {
                iatEvent.getResult();
            }
        };
        var init = function () {
            vadWorker.postMessage({command: 'init'});
        };
        var sendData = function (data) {
            vadWorker.postMessage({
                command: 'appendData',
                pcmData: data,
                nSamples: data.length
            });
        };
        return {
            "init": init,
            "sendData": sendData
        };
    })(setting.vadWorkerPath);

    var serverParam = "";

    var browser_id = new Fingerprint().get();
    var command = (function () {
        var base = {
            "ver": "1.0",
            "sub": "iat",
            "cmd": "",
            "msg": "request"
        };
        var clone = function (obj) {
            return JSON.parse(JSON.stringify(obj));
        };
        var sessionBegin = function () {
            var msg = clone(base);
            msg.cmd = "ssb";
            msg.data = {"params": serverParam};
            socket.send(msg);
        };

        var audioWrite = function (sessionId, data) {
            var msg = clone(base);
            msg.cmd = "auw";
            msg.sid = sessionId;
            msg.data = data;
            socket.send(msg);
        };
        var getResult = function (sessionId) {
            var msg = clone(base);
            msg.cmd = "grs";
            msg.sid = sessionId;
            socket.send(msg);
        };
        var sessionEnd = function (sessionId) {
            var msg = clone(base);
            msg.cmd = "sse";
            msg.sid = sessionId;
            socket.send(msg);
        };
        return {
            "sessionBegin": sessionBegin,
            "audioWrite": audioWrite,
            "getResult": getResult,
            "sessionEnd": sessionEnd
        }
    })();
    var recorderStatus = {
        "idle": "idle",//空闲
        "sessionBegin": "ssb",//session begin 会话开始
        "audioWrite": "auw",//audio write 写入音频
        "getResult": "grs",//get result 获取结果
        "sessionEnd": "sse"//session end 会话结束
    };

    var callback = {
        "onResult": function (code, re) {
        },
        "onVolume": function () {
        },
        "onError": function () {
        },
        "onProcess": function (status) {
        }
    };

    var socket = (function (url) {
        var instance = null;
        var serverMessageHandler = (function () {
            var iatResult = "";
            return {
                /**
                 * 会话开始请求响应处理
                 * @param obj e.g. {"ver" : "1.0", "sub" : "iat", "cmd" : "ssb", "msg" : "response","ret":0, "data" : { "sid" : "iat@..." }}
                 */
                "onSSB": function (obj) {
                    if (obj.ret == 0) {
                        sessionInfo.id = obj.data.sid;
                        callback.onProcess('started');//启动成功
                    }
                    else {
                        iatEvent.abortSession();
                        callback.onResult(obj.ret, null);
                    }
                },
                /**
                 * 请求结果响应处理
                 * @param obj e.g. {"ver" : "1.0", "sub" : "iat", "cmd" : "grs", "msg" : "response","ret":0, "data" : { "sid" : "iat@..." }}
                 */
                "onGRS": function (obj) {
                    if (rec_state != recorderStatus.getResult) {//on status error
                        utils.log("GET RESULT ERROR.");
                        return;
                    }
                    var ret = obj.ret;


                    if (ret != 0) {// on error
                        iatEvent.abortSession();
                        callback.onResult(ret, null);

                        return;
                    }

                    var resultStatus = obj.data.rss;
                    var result = obj.data.rst;
                    var isEnd = (resultStatus == 5);
                    var append = function (str) {
                        if (str != null && str != undefined) {
                            iatResult += str;
                        }
                    };
                    if (!isEnd) {//success but not end
                        append(result);
                        iatEvent.getResult();
                    } else {// got a final result
                        append(result);
                        callback.onResult(ret, iatResult);
                        iatResult = "";//本次会话结束
                        rec_state = recorderStatus.sessionEnd;
                        iatSessionEnd();
                    }
                },
                /**
                 * 会话结束请求响应处理
                 * @param obj e.g. {"ver" : "1.0", "sub" : "iat", "cmd" : "sse", "msg" : "response", "ret":0,"data" : { "sid" : "iat@..." }}
                 */
                "onSSE": function (obj) {
                    sessionInfo.id = null;
                    callback.onProcess('onEnd');
                }
            }
        })();
        var onclose = function () {
        };
        var onopen = function () {
            command.sessionBegin();
        };
        var onmessage = function (obj) {
            var json = JSON.parse(obj.data);
            var cmd = json.cmd;

            //对应的应答进行对应的逻辑处理
            if (cmd == 'ssb') {
                serverMessageHandler.onSSB(json);
            } else if (cmd == 'grs') {
                serverMessageHandler.onGRS(json);
            } else if (cmd == 'sse') {
                serverMessageHandler.onSSE(json);
            } else {
                var ret = json.ret;
                if (ret == 0) return;
                iatEvent.abortSession();
                callback.onResult(ret, null);

            }
        };
        var onerror = function () {
            alert("连接服务出现错误");
        };
        return {
            "connect": function () {
                if (instance == null || instance.readyState != 1) {
                    instance = new WebSocket(url);
                    instance.onclose = onclose;
                    instance.onopen = onopen;
                    instance.onmessage = onmessage;
                    instance.onerror = onerror;
                } else {//若链接可复用，直接发送sessionBegin指令(否则如上，初始化后再在onopen时发送)
                    command.sessionBegin();
                }
            },
            "send": function (msg) {
                utils.log(msg);
                instance.send(JSON.stringify(msg));
            }
        }
    })(setting.serverUrl);

    var utils = {
        "log": function (message, level) {
            if (level > 0) {
                console.log(message);
            }
        },
        "base64encode": function (str) {
            var base64EncodeChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            var out, i, len;
            var c1, c2, c3;
            len = str.length;
            i = 0;
            out = "";
            while (i < len) {
                c1 = str.charCodeAt(i++) & 0xff;
                if (i == len) {
                    out += base64EncodeChars.charAt(c1 >> 2);
                    out += base64EncodeChars.charAt((c1 & 0x3) << 4);
                    out += "==";
                    break;
                }
                c2 = str.charCodeAt(i++);
                if (i == len) {
                    out += base64EncodeChars.charAt(c1 >> 2);
                    out += base64EncodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
                    out += base64EncodeChars.charAt((c2 & 0xF) << 2);
                    out += "=";
                    break;
                }
                c3 = str.charCodeAt(i++);
                out += base64EncodeChars.charAt(c1 >> 2);
                out += base64EncodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
                out += base64EncodeChars.charAt(((c2 & 0xF) << 2) | ((c3 & 0xC0) >> 6));
                out += base64EncodeChars.charAt(c3 & 0x3F);
            }
            return out;
        },
        "getBufferSize": function () {
            var ua = navigator.userAgent;
            if (/(Win(dows )?NT 6\.2)/.test(ua)) {
                return 1024;  //Windows 8
            } else if (/(Win(dows )?NT 6\.1)/.test(ua)) {
                return 1024;  //Windows 7
            } else if (/(Win(dows )?NT 6\.0)/.test(ua)) {
                return 2048;  //Windows Vista
            } else if (/Win(dows )?(NT 5\.1|XP)/.test(ua)) {
                return 4096;  //Windows XP
            } else if (/Mac|PPC/.test(ua)) {
                return 1024;  //Mac OS X
            } else if (/Linux/.test(ua)) {
                return 8192;  //Linux
            } else if (/iPhone|iPad|iPod/.test(ua)) {
                return 2048;  //iOS
            } else {
                return 16384;  //Otherwise
            }
        },
        "checkIsSupport": function () {
            if (!navigator.getUserMedia) {
                return false;
            }
            if (!window.AudioContext) {
                return false
            }
            if (!window.Worker) {
                return false
            }
            return true
        },
        "extend":function(defaults, options){
            var extended = {};
            var prop;
            for (prop in defaults) {
                if (Object.prototype.hasOwnProperty.call(defaults, prop)) {
                    extended[prop] = defaults[prop];
                }
            }
            for (prop in options) {
                if (Object.prototype.hasOwnProperty.call(options, prop)) {
                    extended[prop] = options[prop];
                }
            }
            return extended;
        }
    };

    var iatEvent = (function () {
        var startRecord = function () {
            /* 写音频接口 或 非首次初始化 则不进行多媒体初始化*/
            if (audioStream == null) {
                initMedia();
                recorderWorker.init();
                return;
            }
            callback.onProcess('onStart');//开始启动录音
            socket.connect();//连接服务

            rec_state = recorderStatus.sessionBegin;

            recording = true;
            recorderWorker.reset();

            vadWorker.init();
            speexWorker.init();

        };
        var getResult = function () {
            stopRecord();//停止录音
            if (rec_state == recorderStatus.audioWrite) {//首次从录音状态 切换到获取结果状态
                audioSender.sendEnd();
                callback.onProcess("onStop");
                rec_state = recorderStatus.getResult;
            }

            if (rec_state == recorderStatus.getResult) {
                command.getResult(sessionInfo.id);
            }
        };
        var stopRecord = function () {
            recording = false;
        };
        var abortSession = function () {
            stopRecord();
            rec_state = recorderStatus.sessionEnd;
            iatSessionEnd();
        };
        return {
            "startRecord": startRecord,
            "getResult": getResult,
            "stopRecord": stopRecord,
            "abortSession": abortSession
        };
    })();

    function iatSessionEnd() {
        if (rec_state == recorderStatus.sessionEnd && sessionInfo.id != 0) {
            command.sessionEnd(sessionInfo.id);
        }
        rec_state = recorderStatus.idle;
    }

    var audioSender = (function () {
        var recorderBuffer = [];
        var frameCount = 0;//缓冲帧计数
        var checkStatus = function () {
            if (rec_state == recorderStatus.getResult) return false;
            if (sessionInfo.id == null) return false;
            return true;
        };
        var addBuffer = function (data) {
            recorderBuffer.push(data);
        };
        var sendData = function () {
            var frameSize = 43;//帧长 43bit
            var audioLength = recorderBuffer.length * frameSize;
            var str = (function () {//从缓冲区获取数据
                var output = recorderBuffer.splice(0, recorderBuffer.length);
                var outputArray = new Int8Array(audioLength);
                var i = 0;
                var view;
                for (i = 0; i < output.length; i++) {
                    view = new Int8Array(output[i]);
                    outputArray.set(view, i * frameSize);
                }
                var str = "";
                for (i = 0; i < audioLength; i++) {
                    str += String.fromCharCode(outputArray[i]);
                }
                return str;
            })();
            sessionInfo.synId++;
            var data = {
                "synid": "" + sessionInfo.synId,
                "audiolen": "" + audioLength,
                "audiostatu": "2",// 2 代表未完成
                "audio": utils.base64encode(str)
            };
            command.audioWrite(sessionInfo.id, data);
            frameCount = 0;//计数清空
        };
        var sendEnd = function () {
            var data = {
                "synid": "" + sessionInfo.synId,
                "audiolen": "0",
                "audiostatu": "4",// 4 代表达到末尾
                "audio": ""
            };
            command.audioWrite(sessionInfo.id, data);
            sessionInfo.synId = 0;// 会话帧计数清空
        };
        return {
            "sendData": function (data) {
                if (!checkStatus()) return;
                rec_state = recorderStatus.audioWrite;
                if (frameCount < 6) {//缓冲6帧再发送
                    addBuffer(data);
                    frameCount++;
                    return;
                }
                sendData();
            },
            "sendEnd": function () {
                if (!checkStatus()) return;
                sendData();//清空缓冲数据
                sendEnd();//发送结尾标记
            }
        }
    })();
    var gotStream = function (stream) {
        audioStream = stream;
        var inputPoint = audioCtx.createGain();
        var realAudioInput = audioCtx.createMediaStreamSource(stream);
        var audioInput = realAudioInput;
        audioInput.connect(inputPoint);
        var analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 2048;
        inputPoint.connect(analyserNode);
        (function (source) {
            var context = source.context;
            var node = context.createScriptProcessor(utils.getBufferSize(), 1, 1);
            source.connect(node);
            node.connect(context.destination);
            recorderWorker.init(context.sampleRate);
            node.onaudioprocess = function (e) {
                if (!recording) return;
                recorderWorker.sendData(e.inputBuffer.getChannelData(0));
            }
        })(inputPoint);
        iatEvent.startRecord();
    };
    var initMedia = function () {
        navigator.getUserMedia({audio: true}, gotStream, function (e) {
            alert("getUserMedia error " + e.type);
        });
        audioCtx = new window.AudioContext();
    };
    return function (setting) {
        callback = utils.extend(callback,setting);
        this.start = function (iat_params_obj) {
            serverParam = iat_params_obj.params + ", rse = utf8, browser_id=" + browser_id + ",host=" + window.document.domain;
            iatEvent.startRecord();
        };
        /*
         * stop record or write audio
         */
        this.stop = function () {
            iatEvent.getResult();
        };
        /*
         * cancel recognition
         */
        this.cancel = function () {
            iatEvent.abortSession();
        };
        this.isSupport = function () {
            return utils.checkIsSupport();
        };
        this.kill = function () {
            if (audioStream != null) {
                audioStream.getAudioTracks().forEach(function (track) {
                    track.stop();
                });
                audioStream = null;
            }
            if (audioCtx != null) {
                audioCtx.close();
                audioCtx = null;
            }

        }
    }
})(window, navigator);