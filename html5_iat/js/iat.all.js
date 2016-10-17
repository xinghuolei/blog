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
    var recordWorkerCode = function(){
        return window.URL.createObjectURL(new Blob(['var sampleRate,outputBufferLength;var recBuffers=[];onmessage=function(a){switch(a.data.command){case"init":init(a.data.config);break;case"record":record(a.data.buffer);break;case"reset":reset();break}};function init(a){sampleRate=a.sampleRate;outputBufferLength=a.outputBufferLength}function reset(){recBuffers=[]}function record(f){var h=new Resampler(sampleRate,16000,1,outputBufferLength,true);var d;var j=[];for(d=0;d<f.length;d++){j.push(f[d])}var b=h.resampler(j);var a=new Float32Array(b);for(d=0;d<b;d++){a[d]=h.outputBuffer[d]}var c=floatTo16BitPCM(a);for(d=0;d<c.length;d++){recBuffers.push(c[d])}while(recBuffers.length>320){var g=recBuffers.splice(0,320);var k=new Int16Array(g);var e=getVolume(k);this.postMessage({"volume":e,"buffer":k})}}var getVolume=function(d){var b=[329,421,543,694,895,1146,1476,1890,2433,3118,4011,5142,6612,8478,10900,13982,17968,23054,29620,38014,48828,62654,80491,103294,132686,170366,218728,280830];var a=function(e){var f=30;b.every(function(h,g){if(e<h){f=g;return false}return true});return f};var c=function(g){if(g==null||g.byteLength<=2){return 0}var h=0;var e;for(e=0;e<g.length;e++){h+=g[e]}h/=g.length;var f=0;for(e=0;e<g.length;e++){f+=parseInt(Math.pow(g[e]-h,2))>>9}f/=g.length;return parseInt(f)};return a(c(d))};function floatTo16BitPCM(b){var a=new Int16Array(b.length);for(var c=0;c<b.length;c++){var d=Math.max(-1,Math.min(1,b[c]));if(d<0){a[c]=d*32768}else{a[c]=d*32767}}return a}function Resampler(c,e,b,d,a){this.fromSampleRate=c;this.toSampleRate=e;this.channels=b|0;this.outputBufferSize=d;this.noReturn=!!a;this.initialize()}Resampler.prototype.initialize=function(){if(this.fromSampleRate>0&&this.toSampleRate>0&&this.channels>0){if(this.fromSampleRate==this.toSampleRate){this.resampler=this.bypassResampler;this.ratioWeight=1}else{if(this.fromSampleRate<this.toSampleRate){this.lastWeight=1;this.resampler=this.compileLinearInterpolation}else{this.tailExists=false;this.lastWeight=0;this.resampler=this.compileMultiTap}this.ratioWeight=this.fromSampleRate/this.toSampleRate;this.initializeBuffers()}}else{throw (new Error("Invalid settings specified for the resampler."))}};Resampler.prototype.compileLinearInterpolation=function(g){var a=g.length;var f=this.outputBufferSize;if((a%this.channels)==0){if(a>0){var e=this.ratioWeight;var h=this.lastWeight;var j=0;var d=0;var c=0;var b=this.outputBuffer;var i;for(;h<1;h+=e){d=h%1;j=1-d;for(i=0;i<this.channels;++i){b[c++]=(this.lastOutput[i]*j)+(g[i]*d)}}h--;for(a-=this.channels,sourceOffset=Math.floor(h)*this.channels;c<f&&sourceOffset<a;){d=h%1;j=1-d;for(i=0;i<this.channels;++i){b[c++]=(g[sourceOffset+i]*j)+(g[sourceOffset+this.channels+i]*d)}h+=e;sourceOffset=Math.floor(h)*this.channels}for(i=0;i<this.channels;++i){this.lastOutput[i]=g[sourceOffset++]}this.lastWeight=h%1;return this.bufferSlice(c)}else{return(this.noReturn)?0:[]}}else{throw (new Error("Buffer was of incorrect sample length."))}};Resampler.prototype.compileMultiTap=function(i){var e=[];var a=i.length;var h=this.outputBufferSize;if((a%this.channels)==0){if(a>0){var g=this.ratioWeight;var j=0;for(var k=0;k<this.channels;++k){e[k]=0}var l=0;var m=0;var d=!this.tailExists;this.tailExists=false;var c=this.outputBuffer;var b=0;var f=0;do{if(d){j=g;for(k=0;k<this.channels;++k){e[k]=0}}else{j=this.lastWeight;for(k=0;k<this.channels;++k){e[k]+=this.lastOutput[k]}d=true}while(j>0&&l<a){m=1+l-f;if(j>=m){for(k=0;k<this.channels;++k){e[k]+=i[l++]*m}f=l;j-=m}else{for(k=0;k<this.channels;++k){e[k]+=i[l+k]*j}f+=j;j=0;break}}if(j==0){for(k=0;k<this.channels;++k){c[b++]=e[k]/g}}else{this.lastWeight=j;for(k=0;k<this.channels;++k){this.lastOutput[k]=e[k]}this.tailExists=true;break}}while(l<a&&b<h);return this.bufferSlice(b)}else{return(this.noReturn)?0:[]}}else{throw (new Error("Buffer was of incorrect sample length."))}};Resampler.prototype.bypassResampler=function(a){if(this.noReturn){this.outputBuffer=a;return a.length}else{return a}};Resampler.prototype.bufferSlice=function(a){if(this.noReturn){return a}else{try{return this.outputBuffer.subarray(0,a)}catch(b){try{this.outputBuffer.length=a;return this.outputBuffer}catch(b){return this.outputBuffer.slice(0,a)}}}};Resampler.prototype.initializeBuffers=function(){try{this.outputBuffer=new Float32Array(this.outputBufferSize);this.lastOutput=new Float32Array(this.channels)}catch(a){this.outputBuffer=[];this.lastOutput=[]}};'],
            {type: "text/javascript"}));
    };
    var vadWorkerCode = function(){
        return window.URL.createObjectURL(new Blob(['onmessage=function(a){log(a.data);switch(a.data.command){case"init":Vad();break;case"appendData":AppendData(a.data.pcmData,a.data.nSamples);break}};function log(a){postMessage({type:"debug",message:a})}var ESVadStatus={"ESVAD_SILENCE":0,"ESVAD_CHECK_BEGIN":1,"ESVAD_ACTIVE":2,"ESVAD_CHECK_END":3,"ESVAD_INACTIVE":4};var ESVAD_DISABLE=0;var ES_CMN_UPDATE_RATE=46;var ES_CMN_UPDATE_RATE_C0=12;var ESR_PCMBUFFER_SIZE=160*1024;var ESR_FRAME_SIZE=200;var ESR_FRAME_STEP=80;var ESR_BACK_FRAMES=129;var ESR_MAX_RESULT=16;var RECORD_SAMPLESPERFRAME_DEF=200;var ESIL_CHKBG_FRAMENUM=3;var ELOW_CHKBG_FRAMENUM=20;var EHIGH_CHKBG_FRAMENUM=20;var EHIGH_CHKEND_FRAMENUM_SHORT=200;var EHIGH_CHKEND_FRAMENUM_LONG=80;var ELOW_CHKEND_FRAMENUM=60;var ESR_FRAME_MAXNUM=ESR_BACK_FRAMES;var ESR_MFCCFRAME_MAXNUM=9;var MINIMUM_SPEECH_FRAMENUM=18;var ELOW_VALIDREQ_THRESH=5;var EHIGH_VALIDREQ_THRESH=4;var EHIGH_ENDVALID_THRESH=3;var ELOW_ENDVALID_THRESH=10;var SPEECH_BEGIN_MARGIN=25;var SPEECH_END_MARGIN=40;var ESR_MAX_EHIGH_COEFF=256;var TRANSFORM_PREEMCOEF_DEF=31785;var TRANSFORM_CHANSNUM_DEF=24;var TRANSFORM_CEPSNUM_DEF=11;var TRANSFORM_STEP_DEF=1;var FEATURE_DIMNESION=36;var TRANSFROM_CEPLIFTER_DEF=22;var TRANSFORM_FFTNUM_DEF=512;var TRANSFORM_HALFFFTNUM_DEF=256;var ESR_FEATURE_MEMSIZE=2*FEATURE_DIMNESION;var ESR_SKIP_FRAME=8;var ESR_MATH_LN2=2907270;var ESR_MATH_10LN2=29072700;var g_s16SimpleLnTable=[0,32,64,96,128,160,191,223,255,287,318,350,382,413,445,477,508,540,571,602,634,665,697,728,759,790,822,853,884,915,946,977,1008,1039,1070,1101,1132,1163,1194,1225,1256,1286,1317,1348,1379,1409,1440,1471,1501,1532,1562,1593,1623,1654,1684,1714,1745,1775,1805,1836,1866,1896,1926,1956,1987,2017,2047,2077,2107,2137,2167,2197,2227,2256,2286,2316,2346,2376,2406,2435,2465,2495,2524,2554,2583,2613,2643,2672,2702,2731,2760,2790,2819,2849,2878,2907,2936,2966,2995,3024,3053,3082,3111,3141,3170,3199,3228,3257,3286,3315,3343,3372,3401,3430,3459,3488,3516,3545,3574,3603,3631,3660,3688,3717,3746,3774,3803,3831,3860,3888,3916,3945,3973,4001,4030,4058,4086,4115,4143,4171,4199,4227,4255,4283,4311,4340,4368,4396,4424,4451,4479,4507,4535,4563,4591,4619,4646,4674,4702,4730,4757,4785,4813,4840,4868,4895,4923,4950,4978,5005,5033,5060,5088,5115,5143,5170,5197,5224,5252,5279,5306,5333,5361,5388,5415,5442,5469,5496,5523,5550,5577,5604,5631,5658,5685,5712,5739,5766,5792,5819,5846,5873,5900,5926,5953,5980,6006,6033,6060,6086,6113,6139,6166,6192,6219,6245,6272,6298,6324,6351,6377,6403,6430,6456,6482,6509,6535,6561,6587,6613,6640,6666,6692,6718,6744,6770,6796,6822,6848,6874,6900,6926,6952,6977,7003,7029,7055,7081,7107,7132,7158,7184,7209,7235,7261,7286,7312,7338,7363,7389,7414,7440,7465,7491,7516,7542,7567,7592,7618,7643,7668,7694,7719,7744,7770,7795,7820,7845,7870,7896,7921,7946,7971,7996,8021,8046,8071,8096,8121,8146,8171,8196,8221,8246,8271,8295,8320,8345,8370,8395,8419,8444,8469,8494,8518,8543,8568,8592,8617,8641,8666,8691,8715,8740,8764,8789,8813,8837,8862,8886,8911,8935,8959,8984,9008,9032,9057,9081,9105,9129,9154,9178,9202,9226,9250,9274,9299,9323,9347,9371,9395,9419,9443,9467,9491,9515,9539,9562,9586,9610,9634,9658,9682,9706,9729,9753,9777,9801,9824,9848,9872,9895,9919,9943,9966,9990,10013,10037,10061,10084,10108,10131,10155,10178,10202,10225,10248,10272,10295,10319,10342,10365,10389,10412,10435,10458,10482,10505,10528,10551,10574,10598,10621,10644,10667,10690,10713,10736,10759,10782,10805,10828,10851,10874,10897,10920,10943,10966,10989,11012,11035,11058,11080,11103,11126,11149,11171,11194,11217,11240,11262,11285,11308,11330,11353,11376,11398,11421,11443,11466,11489,11511,11534,11556,11579,11601,11623,11646,11668,11691,11713,11735,11758,11780,11803,11825,11847,11869,11892,11914,11936,11958,11981,12003,12025,12047,12069,12091,12114,12136,12158,12180,12202,12224,12246,12268,12290,12312,12334,12356,12378,12400,12422,12444,12465,12487,12509,12531,12553,12575,12596,12618,12640,12662,12683,12705,12727,12749,12770,12792,12814,12835,12857,12878,12900,12922,12943,12965,12986,13008,13029,13051,13072,13094,13115,13137,13158,13179,13201,13222,13244,13265,13286,13308,13329,13350,13372,13393,13414,13435,13457,13478,13499,13520,13541,13562,13584,13605,13626,13647,13668,13689,13710,13731,13752,13773,13794,13815,13836,13857,13878,13899,13920,13941,13962,13983,14004,14025,14045,14066,14087,14108,14129,14149,14170,14191,14212,14232,14253,14274,14295,14315,14336,14357,14377,14398,14418,14439,14460,14480,14501,14521,14542,14562,14583,14603,14624,14644,14665,14685,14706,14726,14747,14767,14787,14808,14828,14848,14869,14889,14909,14930,14950,14970,14991,15011,15031,15051,15071,15092,15112,15132,15152,15172,15192,15213,15233,15253,15273,15293,15313,15333,15353,15373,15393,15413,15433,15453,15473,15493,15513,15533,15553,15573,15593,15612,15632,15652,15672,15692,15712,15731,15751,15771,15791,15811,15830,15850,15870,15889,15909,15929,15948,15968,15988,16007,16027,16047,16066,16086,16105,16125,16145,16164,16184,16203,16223,16242,16262,16281,16301,16320,16340,16359,16378,16398,16417,16437,16456,16475,16495,16514,16533,16553,16572,16591,16610,16630,16649,16668,16687,16707,16726,16745,16764,16784,16803,16822,16841,16860,16879,16898,16917,16937,16956,16975,16994,17013,17032,17051,17070,17089,17108,17127,17146,17165,17184,17203,17222,17240,17259,17278,17297,17316,17335,17354,17373,17391,17410,17429,17448,17467,17485,17504,17523,17542,17560,17579,17598,17616,17635,17654,17673,17691,17710,17728,17747,17766,17784,17803,17821,17840,17859,17877,17896,17914,17933,17951,17970,17988,18007,18025,18044,18062,18080,18099,18117,18136,18154,18173,18191,18209,18228,18246,18264,18283,18301,18319,18337,18356,18374,18392,18411,18429,18447,18465,18483,18502,18520,18538,18556,18574,18592,18611,18629,18647,18665,18683,18701,18719,18737,18755,18773,18791,18810,18828,18846,18864,18882,18900,18917,18935,18953,18971,18989,19007,19025,19043,19061,19079,19097,19114,19132,19150,19168,19186,19204,19221,19239,19257,19275,19293,19310,19328,19346,19364,19381,19399,19417,19434,19452,19470,19487,19505,19523,19540,19558,19576,19593,19611,19628,19646,19663,19681,19699,19716,19734,19751,19769,19786,19804,19821,19839,19856,19873,19891,19908,19926,19943,19961,19978,19995,20013,20030,20048,20065,20082,20100,20117,20134,20151,20169,20186,20203,20221,20238,20255,20272,20290,20307,20324,20341,20358,20376,20393,20410,20427,20444,20461,20479,20496,20513,20530,20547,20564,20581,20598,20615,20632,20649,20666,20683,20700,20717,20734,20751,20768,20785,20802,20819,20836,20853,20870,20887,20904,20921,20938,20955,20972,20988,21005,21022,21039,21056,21073,21089,21106,21123,21140,21157,21173,21190,21207,21224,21240,21257,21274,21291,21307,21324,21341,21357,21374,21391,21407,21424,21441,21457,21474,21491,21507,21524,21540,21557,21573,21590,21607,21623,21640,21656,21673,21689,21706,21722,21739,21755,21772,21788,21805,21821,21837,21854,21870,21887,21903,21920,21936,21952,21969,21985,22001,22018,22034,22050,22067,22083,22099,22116,22132,22148,22164,22181,22197,22213,22229,22246,22262,22278,22294,22311,22327,22343,22359,22375,22391,22408,22424,22440,22456,22472,22488,22504,22520,22537,22553,22569,22585,22601,22617,22633,22649,22665,22681,22697];var m_iVADState;var m_s32ESil;var m_s32ELow;var m_s32EHigh;var m_s32EMax;var m_latestVolume;var m_pPCMBuffer;var m_iPCMStart;var m_iPCMEnd;var m_pPCMFrame;var m_ppPCM;var m_iFrameEnd;var m_pFrameEnergy;var m_iFrameHead;var m_iFrameCheck;var m_iSpeechBegin;var m_iSpeechEnd;var m_iSpeechEnd2;var m_iFrameCurrent;var enableVoiceDataCache=true;var outAudioList=new Array();var m_nCheckEndFrame;var speechStart=false;var speechEnd=false;function VadState(){return m_iVADState}function Volume(){return m_latestVolume}function SpeechStart(){return speechStart}function SpeechEnd(){return speechEnd}function Vad(){log("vad init");m_pPCMBuffer=new Array();m_pPCMFrame=new Array();m_pFrameEnergy=new Array();m_ppPCM=new Array();Reset()}function Reset(){m_iFrameEnd=0;m_iFrameHead=0;m_iSpeechBegin=0;m_s32ESil=0;m_iVADState=ESVadStatus.ESVAD_SILENCE;m_iFrameCurrent=parseInt(ESR_SKIP_FRAME);m_iSpeechEnd=0;m_iPCMEnd=0;m_iPCMStart=0}function BlockCopy(f,a,g,d,e){var c=0;var b=0;while(c<e){m_ppPCM[d+c]=f[a+c];c++}}function AppendData(c,f){var h;var e;log("call AppendData function, pcmDataLength : "+f+", pcmData[0] : "+c[0]);if(1==f){var k=m_iPCMEnd;m_pPCMBuffer[k]=c[0];++k;if(k>=ESR_PCMBUFFER_SIZE){k-=ESR_PCMBUFFER_SIZE}if(k==m_iPCMStart){return 7}m_iPCMEnd=k;return 0}h=parseInt(m_iPCMEnd-m_iPCMStart);if(h<0){h+=ESR_PCMBUFFER_SIZE}h+=f;if(h>ESR_PCMBUFFER_SIZE-1){return 7}if(m_iPCMEnd+f<ESR_PCMBUFFER_SIZE){for(e=0;e<f;e++){m_pPCMBuffer[m_iPCMEnd+e]=c[e]}m_iPCMEnd+=f}else{var b=ESR_PCMBUFFER_SIZE-m_iPCMEnd;b=ESR_PCMBUFFER_SIZE-m_iPCMEnd;for(e=0;e<b;e++){m_pPCMBuffer[m_iPCMEnd+e]=c[e]}for(e=0;e<f-b;e++){m_pPCMBuffer[e]=c[b+e]}m_iPCMEnd=f-b}log("call AppendData function, m_iPCMEnd : "+m_iPCMEnd);while(true){var g=false;if(ESVadStatus.ESVAD_INACTIVE!=m_iVADState){g=GetOneFrame();if(g){m_pFrameEnergy[m_iFrameEnd%ESR_FRAME_MAXNUM]=CalcFrameEnergy();BlockCopy(m_pPCMFrame,0,m_ppPCM,(m_iFrameEnd%parseInt(ESR_FRAME_MAXNUM))*parseInt(ESR_FRAME_STEP)*2,parseInt(ESR_FRAME_STEP)*2);m_iFrameEnd++;if(m_iFrameEnd<parseInt(ESIL_CHKBG_FRAMENUM)){continue}CheckVoice()}}if(m_iFrameCurrent<m_iSpeechEnd){if(enableVoiceDataCache){var d=new Array();BlockCopy(m_ppPCM,(m_iFrameCurrent%parseInt(ESR_FRAME_MAXNUM))*parseInt(ESR_FRAME_STEP)*2,d,0,parseInt(ESR_FRAME_STEP*2));outAudioList[outAudioList.length]=d}m_iFrameCurrent++}if(ESVadStatus.ESVAD_INACTIVE==m_iVADState){if(m_iFrameCurrent<m_iSpeechEnd){if(enableVoiceDataCache){var d=new Array();BlockCopy(m_ppPCM,(m_iFrameCurrent%parseInt(ESR_FRAME_MAXNUM))*parseInt(ESR_FRAME_STEP)*2,d,0,parseInt(ESR_FRAME_STEP*2));outAudioList[outAudioList.length]=d}m_iFrameCurrent++}}if(!g){break}}m_latestVolume=0;var a=0;for(e=0;e<f;e++){var j;j=(c[e]>>2);a+=(j*j+8)>>4}a/=f;if(a<256){m_latestVolume=0}else{m_latestVolume=simple_table_ln(a,6)>>22;if(m_latestVolume>9){m_latestVolume=9}}log("vad volume : "+m_latestVolume);postMessage({command:"volume",message:m_latestVolume});return 0}function GetVoiceData(){var a=null;if(outAudioList.Count>0){a=outAudioList[0];outAudioList.splice(0,1)}return a}function GetVoiceDataSamples(){return outAudioList.Count*parseInt(ESR_FRAME_STEP)}function simple_table_ln(e,b){var d;var c;var a=b;++e;if((e&4294901760)==0){e<<=16;a+=16}if((e&4278190080)==0){e<<=8;a+=8}if((e&4026531840)==0){e<<=4;a+=4}if((e&3221225472)==0){e<<=2;a+=2}if((e&2147483648)==0){e<<=1;a+=1}e=e-2147483648;c=(e>>21);d=(g_s16SimpleLnTable[c]<<7);d+=(31-a)*parseInt(ESR_MATH_LN2);return d}function CalcFrameEnergy(){var a=0;var c;var d;for(c=0;c<ESR_FRAME_SIZE;c++){a+=m_pPCMFrame[c]}a=a/parseInt(ESR_FRAME_SIZE);d=0;for(c=0;c<ESR_FRAME_SIZE;c++){var b,e;b=m_pPCMFrame[c];e=b-a;d+=(e*e+128)>>8}d>>=2;return Math.max(40,(d))}function GetOneFrame(){var b=parseInt(m_iPCMEnd-m_iPCMStart);if(b<0){b+=parseInt(ESR_PCMBUFFER_SIZE)}if(b<ESR_FRAME_SIZE){return false}if(m_iPCMStart+ESR_FRAME_SIZE<=ESR_PCMBUFFER_SIZE){var a=0;for(;a<ESR_FRAME_SIZE;a++){m_pPCMFrame[a]=m_pPCMBuffer[m_iPCMStart+a]}m_iPCMStart+=ESR_FRAME_STEP}else{var c=ESR_PCMBUFFER_SIZE-m_iPCMStart;var a;for(a=0;a<c;a++){m_pPCMFrame[a]=m_pPCMBuffer[m_iPCMStart+a]}for(a=0;a<ESR_FRAME_SIZE-c;a++){m_pPCMFrame[c+a]=m_pPCMBuffer[a]}m_iPCMStart+=ESR_FRAME_STEP;if(m_iPCMStart>ESR_PCMBUFFER_SIZE){m_iPCMStart-=ESR_PCMBUFFER_SIZE}}return true}function CheckEngery(b,e,a){var d=0;var c=0;for(;d<a;d++){if(m_pFrameEnergy[(m_iFrameCheck+d)%ESR_FRAME_MAXNUM]>b){c++}else{c=0}if(c>e){m_iFrameCheck=d+m_iFrameCheck-e;return true}}return false}function CheckVoice(){var b,d,e,c;var g,f;b=m_iFrameEnd-m_iFrameHead;while(b!=0){b=m_iFrameEnd-m_iFrameHead;if(b==0){return}if(0==m_s32ESil){if(b<ESIL_CHKBG_FRAMENUM){return}if(m_iFrameHead<=ESR_FRAME_SIZE/ESR_FRAME_STEP){++m_iFrameHead;continue}m_nCheckEndFrame=parseInt(EHIGH_CHKEND_FRAMENUM_SHORT);m_s32ESil=0;for(e=0;e<ESIL_CHKBG_FRAMENUM;e++){m_s32ESil+=m_pFrameEnergy[(m_iFrameHead+e)%ESR_FRAME_MAXNUM]}m_s32ESil/=parseInt(ESIL_CHKBG_FRAMENUM);m_iFrameCheck=m_iFrameHead+1;g=m_s32ESil+200;m_s32ELow=parseInt(g*20/(((simple_table_ln(g,0)+ESR_MATH_10LN2)>>18)-(4<<4)));m_s32ELow<<=5;m_s32ELow-=200}log("check vad state : "+m_iVADState);switch(m_iVADState){case ESVadStatus.ESVAD_SILENCE:d=parseInt(m_iFrameEnd-m_iFrameCheck);if(d<ELOW_CHKBG_FRAMENUM){return}if(CheckEngery(m_s32ELow,parseInt(ELOW_VALIDREQ_THRESH),parseInt(ELOW_CHKBG_FRAMENUM))){for(e=m_iFrameHead+1;e<=m_iFrameCheck-ESIL_CHKBG_FRAMENUM;++e){g=0;for(c=0;c<ESIL_CHKBG_FRAMENUM;c++){g+=m_pFrameEnergy[(e+c)%ESR_FRAME_MAXNUM]}g/=parseInt(ESIL_CHKBG_FRAMENUM);if(g<m_s32ESil){m_s32ESil=g;m_iFrameHead=e}}g=parseInt((simple_table_ln(m_s32ESil,0)+ESR_MATH_10LN2)>>14);f=((g-(9<<8))*(g-(9<<8)))>>12;f+=(32<<4);m_s32EHigh=(m_s32ESil*(720/2)/f)<<5;m_iSpeechBegin=m_iFrameCheck;m_iVADState=ESVadStatus.ESVAD_CHECK_BEGIN;speechStart=true}else{m_s32ESil=0;m_iVADState=ESVadStatus.ESVAD_SILENCE;m_iFrameHead++}break;case ESVadStatus.ESVAD_CHECK_BEGIN:d=parseInt(m_iFrameEnd-m_iFrameCheck);if(d<EHIGH_CHKBG_FRAMENUM){return}if(CheckEngery(m_s32EHigh,parseInt(EHIGH_VALIDREQ_THRESH),parseInt(EHIGH_CHKBG_FRAMENUM))){var a;m_iFrameHead=m_iSpeechBegin;m_iFrameCheck=m_iFrameHead+1;m_iFrameCurrent=Math.max(m_iSpeechBegin-parseInt(SPEECH_BEGIN_MARGIN),parseInt(ESR_SKIP_FRAME));m_iVADState=ESVadStatus.ESVAD_ACTIVE;m_iSpeechEnd=Math.min(m_iSpeechBegin+parseInt(SPEECH_END_MARGIN),m_iFrameEnd);m_iSpeechEnd2=m_iSpeechBegin;a=Math.max(m_iSpeechBegin,parseInt(ESR_SKIP_FRAME));m_s32EMax=0}else{m_s32ESil=0;m_iVADState=ESVadStatus.ESVAD_SILENCE;m_iFrameHead++}break;case ESVadStatus.ESVAD_ACTIVE:g=m_pFrameEnergy[m_iFrameHead%ESR_FRAME_MAXNUM];if(g<m_s32ELow){m_iVADState=ESVadStatus.ESVAD_CHECK_END;m_iFrameCheck=m_iFrameHead+1}else{m_s32EMax=Math.max(m_s32EMax,g);if(m_s32EMax>(m_s32EHigh*ESR_MAX_EHIGH_COEFF)){g=simple_table_ln(m_s32EMax/ESR_MAX_EHIGH_COEFF,-10)>>14;g-=9<<8;g=(g*g)>>12;g+=32<<4;g=(m_s32EMax/(parseInt(ESR_MAX_EHIGH_COEFF)*16))*g/720;g=simple_table_ln(g,-10)>>14;g-=9<<8;g=(g*g)>>12;g+=32<<4;g=(m_s32EMax/(parseInt(ESR_MAX_EHIGH_COEFF)*16))*g/720;m_s32ESil=g;g=m_s32ESil+200;m_s32ELow=(g)*20/parseInt(((simple_table_ln(g,0)+ESR_MATH_10LN2)>>18)-(4<<4));m_s32ELow<<=5;m_s32ELow-=200;g=parseInt((simple_table_ln(m_s32ESil,0)+ESR_MATH_10LN2)>>14);f=((g-(9<<8))*(g-(9<<8)))>>12;f+=(32<<4);m_s32EHigh=(m_s32ESil*(720/2)/f)<<5}m_iFrameHead++}m_iSpeechEnd=Math.min(m_iFrameHead+parseInt(SPEECH_END_MARGIN),m_iFrameEnd);m_iSpeechEnd2=m_iFrameHead;break;case ESVadStatus.ESVAD_CHECK_END:m_iSpeechEnd=Math.min(m_iFrameHead+parseInt(SPEECH_END_MARGIN),m_iFrameEnd);m_iSpeechEnd2=m_iFrameHead;d=m_iFrameEnd-m_iFrameCheck;if(d<m_nCheckEndFrame){return}if(CheckEngery(m_s32EHigh,parseInt(EHIGH_ENDVALID_THRESH),m_nCheckEndFrame)){log("local vad check end!!!!"+CheckEngery(m_s32EHigh,parseInt(EHIGH_ENDVALID_THRESH),m_nCheckEndFrame));m_iFrameHead++;m_iVADState=ESVadStatus.ESVAD_ACTIVE;m_nCheckEndFrame=parseInt(EHIGH_CHKEND_FRAMENUM_SHORT)}else{m_iVADState=ESVadStatus.ESVAD_INACTIVE;speechEnd=true;log("local vad check end!!!!");postMessage({command:"esvad",message:"end"});m_iFrameCheck=m_iFrameHead+1;m_s32ESil=0;if(m_iSpeechEnd-m_iSpeechBegin<MINIMUM_SPEECH_FRAMENUM+SPEECH_END_MARGIN){m_iSpeechBegin=0;m_iSpeechEnd=0;m_iVADState=ESVadStatus.ESVAD_SILENCE}return}break;case ESVadStatus.ESVAD_INACTIVE:return}}};'],
            {type: "text/javascript"}));
    };
    var speexWorkCode = function(){
        return window.URL.createObjectURL(new Blob(['onmessage=function(b){switch(b.data.command){case"init":SpeexEncoder(BandMode.Wide);encoder.Quality=5;break;case"encode":var a=[];Encode(b.data.inData,b.data.inOffset,b.data.inCount,a,b.data.outOffset,b.data.outCount);break}};function log(a){postMessage({type:"debug",message:a})}var encoder;var bits;var rawData;var FrameSize;var speexWbFrameLen=[10,15,20,25,32,42,52,60,70,86,106];var speex_quality=5;function SpeexEncoder(a){bits=new Bits();switch(a){case BandMode.Narrow:encoder=new NbEncoder();break;case BandMode.Wide:encoder=new SbEncoder(false);break;case BandMode.UltraWide:encoder=new SbEncoder(true);break;default:break}FrameSize=320;rawData=new Array()}function Encode(d,b,l,j,e,g){var a=l/FrameSize;var k=[];for(var h=0;h<a;h++){bits.Reset();var f=0;var m=0;while(f<l){for(var c=0;c<FrameSize;c++){rawData[c]=d[b+c+f]}m+=encoder.Encode(bits,rawData);f+=FrameSize}bits.Write(j,e,g);k[h*(speexWbFrameLen[speex_quality]+1)]=speexWbFrameLen[speex_quality];ArrayCopy(j,0,k,h*(speexWbFrameLen[speex_quality]+1)+1,speexWbFrameLen[speex_quality])}postMessage({command:"encode",buffer:k})}function Inner_prod(j,b,h,k,g){var f;var e=0,d=0,c=0,a=0;for(f=0;f<g;){e+=j[b+f]*h[k+f];d+=j[b+f+1]*h[k+f+1];c+=j[b+f+2]*h[k+f+2];a+=j[b+f+3]*h[k+f+3];f+=4}return e+d+c+a}function Open_loop_nbest_pitch(o,n,c,b,t,h,f,d){var r,q,p;var l;var e;var m,v,s;l=new Array();m=new Array();v=new Array();s=new Array();for(r=0;r<d;r++){l[r]=-1;f[r]=0;h[r]=c}v[0]=Inner_prod(o,n-c,o,n-c,t);e=Inner_prod(o,n,o,n,t);for(r=c;r<=b;r++){v[r-c+1]=v[r-c]+o[n-r-1]*o[n-r-1]-o[n-r+t-1]*o[n-r+t-1];if(v[r-c+1]<1){v[r-c+1]=1}}for(r=c;r<=b;r++){m[r-c]=0;s[r-c]=0}for(r=c;r<=b;r++){m[r-c]=Inner_prod(o,n,o,n-r,t);s[r-c]=m[r-c]*m[r-c]/(v[r-c]+1)}for(r=c;r<=b;r++){if(s[r-c]>l[d-1]){var a,u;a=m[r-c]/(v[r-c]+10);u=Math.sqrt(a*m[r-c]/(e+10));if(u>a){u=a}if(u<0){u=0}for(q=0;q<d;q++){if(s[r-c]>l[q]){for(p=d-1;p>q;p--){l[p]=l[p-1];h[p]=h[p-1];f[p]=f[p-1]}l[q]=s[r-c];h[q]=r;f[q]=u;break}}}}}function CreateJaggedArray(d,c){var a=new Array();for(var b=0;b<d;b++){a[b]=[]}return a}var Ltp3Tap=function(b,f,a){var k=new Array();k[0]=k[1]=k[1]=0;var g=b;var c=f;var h=a;var d=CreateJaggedArray(3,128);this.Quant=function(Q,E,I,L,H,G,D,P,u,t,o,F,O,J,m,z,C,A){var M,K;var B=new Array();B[0]=0;var y=0,s=0;var x=new Array();for(var M=0;M<O;M++){x[M]=0}var q=0;var v,l=-1;var w;var e=new Array();var n=new Array();w=A;if(w>10){w=10}for(var M=0;M<w;M++){e[M]=0;n[M]=0}if(w==0||t<u){J.Pack(0,h);J.Pack(0,c);for(M=0;M<O;M++){D[P+M]=0}return u}if(w>t-u+1){w=t-u+1}Open_loop_nbest_pitch(E,I,u,t,O,e,n,w);for(M=0;M<w;M++){y=e[M];for(K=0;K<O;K++){D[P+K]=0}v=j(Q,L,H,G,D,P,y,F,O,J,m,z,C,B);if(v<l||l<0){for(K=0;K<O;K++){x[K]=D[P+K]}l=v;q=y;s=B[0]}}J.Pack(q-u,h);J.Pack(s,c);for(M=0;M<O;M++){D[P+M]=x[M]}return y};function j(T,L,I,H,F,S,s,G,O,J,n,u,D,z){var N,M;var t;var y=new Array();var E=CreateJaggedArray(3,3);var w;var Q,P;w=1<<c;t=CreateJaggedArray(3,O);d=CreateJaggedArray(3,O);for(N=2;N>=0;N--){var K=s+1-N;for(M=0;M<O;M++){if(M-K<0){d[N][M]=n[u+M-K]}else{if(M-K-s<0){d[N][M]=n[u+M-K-s]}else{d[N][M]=0}}}if(N==2){Filters.Syn_percep_zero(d[N],0,L,I,H,t[N],O,G)}else{for(M=0;M<O-1;M++){t[N][M+1]=t[N+1][M]}t[N][0]=0;for(M=0;M<O;M++){t[N][M]+=d[N][0]*D[M]}}}for(N=0;N<3;N++){y[N]=Inner_prod(t[N],0,T,0,O)}for(N=0;N<3;N++){for(M=0;M<=N;M++){E[N][M]=E[M][N]=Inner_prod(t[N],0,t[M],0,O)}}var B=new Array();var l=0;var q=0;var R=0;B[0]=y[2];B[1]=y[1];B[2]=y[0];B[3]=E[1][2];B[4]=E[0][1];B[5]=E[0][2];B[6]=E[2][2];B[7]=E[1][1];B[8]=E[0][0];for(N=0;N<w;N++){var o=0;var m,e,U;l=3*N;m=0.015625*g[l]+0.5;e=0.015625*g[l+1]+0.5;U=0.015625*g[l+2]+0.5;o+=B[0]*m;o+=B[1]*e;o+=B[2]*U;o-=B[3]*m*e;o-=B[4]*U*e;o-=B[5]*U*m;o-=0.5*B[6]*m*m;o-=0.5*B[7]*e*e;o-=0.5*B[8]*U*U;if(false){var v=Math.abs(g[l+1]);if(g[l]>0){v+=g[l]}if(g[l+2]>0){v+=g[l+2]}if(v>1){continue}}if(o>R||N==0){R=o;q=N}}k[0]=0.015625*g[q*3]+0.5;k[1]=0.015625*g[q*3+1]+0.5;k[2]=0.015625*g[q*3+2]+0.5;z[0]=q;for(N=0;N<O;N++){F[S+N]=k[0]*d[2][N]+k[1]*d[1][N]+k[2]*d[0][N]}Q=0;P=0;for(N=0;N<O;N++){Q+=T[N]*T[N]}for(N=0;N<O;N++){P+=(T[N]-k[2]*t[0][N]-k[1]*t[1][N]-k[0]*t[2][N])*(T[N]-k[2]*t[0][N]-k[1]*t[1][N]-k[0]*t[2][N])}return P}};var LtpForcedPitch=function(){};var Filters=function(){};var last_pitch=0;var last_pitch_gain=new Array();last_pitch_gain[0]=last_pitch_gain[1]=last_pitch_gain[2]=0;var smooth_gain=1;var xx=new Array();for(var i=0;i<1024;i++){xx[i]=0}Filters.prototype.Residue_percep_zero=Filters.Residue_percep_zero=function(h,d,f,c,b,j,g,a){var e;var k=new Array();for(var l=0;l<a;l++){k[l]=0}Filters.Filter_mem2_b(h,d,f,c,j,0,g,a,k,0);for(e=0;e<a;e++){k[e]=0}Filters.Fir_mem2(j,0,b,j,0,g,a,k)};Filters.prototype.Fir_mem_up=Filters.Fir_mem_up=function(q,p,n,h,k,s){var g,f;for(g=0;g<h/2;g++){xx[2*g]=q[h/2-1-g]}for(g=0;g<k-1;g+=2){xx[h+g]=s[g+1]}for(g=0;g<h;g+=4){var r,o,m,l,e;r=o=m=l=0;e=xx[h-4-g];for(f=0;f<k;f+=4){var c,d,b;d=p[f];b=p[f+1];c=xx[h-2+f-g];r+=d*c;o+=b*c;m+=d*e;l+=b*e;d=p[f+2];b=p[f+3];e=xx[h+f-g];r+=d*e;o+=b*e;m+=d*c;l+=b*c}n[g]=r;n[g+1]=o;n[g+2]=m;n[g+3]=l}for(g=0;g<k-1;g+=2){s[g+1]=xx[g]}};Filters.prototype.Syn_percep_zero=Filters.Syn_percep_zero=function(h,d,f,c,b,j,g,a){var e;var k=new Array();for(var l=0;l<a;l++){k[l]=0}Filters.Filter_mem2_b(h,d,c,f,j,0,g,a,k,0);for(e=0;e<a;e++){k[e]=0}Filters.Iir_mem2(j,0,b,j,0,g,a,k)};Filters.prototype.Qmf_decomp=Filters.Qmf_decomp=function(m,c,q,n,h,l,r){var g,f,e,b;var p;var o;var d;p=new Array();o=new Array();d=l-1;b=l>>1;for(g=0;g<l;g++){p[l-g-1]=c[g]}for(g=0;g<l-1;g++){o[g]=r[l-g-2]}for(g=0;g<h;g++){o[g+l-1]=m[g]}for(g=0,e=0;g<h;g+=2,e++){q[e]=0;n[e]=0;for(f=0;f<b;f++){q[e]+=p[f]*(o[g+f]+o[d+g-f]);n[e]-=p[f]*(o[g+f]-o[d+g-f]);f++;q[e]+=p[f]*(o[g+f]+o[d+g-f]);n[e]+=p[f]*(o[g+f]-o[d+g-f])}}for(g=0;g<l-1;g++){r[g]=m[h-g-1]}};Filters.prototype.Iir_mem2=Filters.Iir_mem2=function(g,b,h,f,l,e,a,k){var d,c;for(d=0;d<e;d++){f[l+d]=g[b+d]+k[0];for(c=0;c<a-1;c++){k[c]=k[c+1]-h[c+1]*f[l+d]}k[a-1]=-h[a]*f[l+d]}};Filters.prototype.Fir_mem2=Filters.Fir_mem2=function(k,b,e,h,m,f,a,l){var d,c;var g;for(d=0;d<f;d++){g=k[b+d];h[m+d]=e[0]*g+l[0];for(c=0;c<a-1;c++){l[c]=l[c+1]+e[c+1]*g}l[a-1]=e[a]*g}};Filters.prototype.Filter_mem2_b=Filters.Filter_mem2_b=function(m,c,g,o,l,p,h,b,n,a){var f,e;var k,d;for(f=0;f<h;f++){k=m[c+f];l[p+f]=g[0]*k+n[0];d=l[p+f];for(e=0;e<b-1;e++){n[a+e]=n[a+e+1]+g[e+1]*k-o[e+1]*d}n[a+b-1]=g[b]*k-o[b]*d}};Filters.prototype.Bw_lpc=Filters.Bw_lpc=function(b,f,c,a){var e=1;for(var d=0;d<a+1;d++){c[d]=e*f[d];e*=b}};function NoiseSearch(){}var VQ=function(){};VQ.prototype.Index_s=VQ.Index_s=function(g,d,a){var c;var b=0;var e=0;for(c=0;c<a;c++){var f=g-d[c];f=f*f;if(c==0||f<b){b=f;e=c}}return e};VQ.prototype.Nbest=VQ.Nbest=function(f,d,n,h,g,s,m,q,o){var e,c,b,a=0,r=0;for(e=0;e<g;e++){var p=0.5*s[e];for(c=0;c<h;c++){p-=f[d+c]*n[a++]}if(e<m||p<o[m-1]){for(b=m-1;(b>=1)&&(b>r||p<o[b-1]);b--){o[b]=o[b-1];q[b]=q[b-1]}o[b]=p;q[b]=e;r++}}};function SplitShapeSearch(A,g,a,k,j,n){var w=10;var q=A;var y=g;var b=a;var f=k;var p=1<<j;var z=j;var c=n;var h=new Array();var o=new Array();for(var s=0;s<a;s++){h[s]=0;o[s]=0}var d=[];var B=[];var x=[];var u=[];for(var s=0;s<w;s++){d[s]=[];B[s]=[];x[s]=[];u[s]=[]}var m=new Array();var v=new Array();var r=new Array();var l=new Array();this.Quantify=function(e,G,O,L,Y,Q,D,aa,W,t,T){var ag,af,ae,ac,ab,X;var K;var C,V;var I;var al;var ad;var ak;var F=T;if(F>10){F=10}K=new Array();I=new Array();al=new Array();C=new Array();V=new Array();ad=new Array();ak=new Array();for(var ag=0;ag<F;ag++){I[ag]=0;ad[ag]=0;ak[ag]=0}for(ag=0;ag<F;ag++){for(af=0;af<b;af++){u[ag][af]=x[ag][af]=-1}}for(af=0;af<F;af++){for(ag=0;ag<Q;ag++){d[af][ag]=e[ag]}}for(ag=0;ag<p;ag++){var P;var J;P=ag*y;J=ag*y;for(af=0;af<y;af++){K[P+af]=0;for(ae=0;ae<=af;ae++){K[P+af]+=0.03125*f[J+ae]*W[af-ae]}}l[ag]=0;for(af=0;af<y;af++){l[ag]+=K[P+af]*K[P+af]}}for(af=0;af<F;af++){V[af]=0}for(ag=0;ag<b;ag++){var U=ag*y;var S=2147483647;for(af=0;af<F;af++){C[af]=S}for(af=0;af<F;af++){ad[af]=ak[af]=0}for(af=0;af<F;af++){var Z=0;for(ac=U;ac<U+y;ac++){Z+=d[af][ac]*d[af][ac]}Z*=0.5;if(c!=0){VQ.Nbest_sign(d[af],U,K,y,p,l,F,I,al)}else{VQ.Nbest(d[af],U,K,y,p,l,F,I,al)}for(ae=0;ae<F;ae++){var ah=V[af]+al[ae]+Z;if(ah<C[F-1]){for(ac=0;ac<F;ac++){if(ah<C[ac]){for(ab=F-1;ab>ac;ab--){C[ab]=C[ab-1];ad[ab]=ad[ab-1];ak[ab]=ak[ab-1]}C[ac]=ah;ad[ab]=I[ae];ak[ab]=af;break}}}}if(ag==0){break}}for(af=0;af<F;af++){for(ac=(ag+1)*y;ac<Q;ac++){B[af][ac]=d[ak[af]][ac]}for(ac=0;ac<y;ac++){var ai;var R;var H=1;R=ad[af];if(R>=p){H=-1;R-=p}X=y-ac;ai=H*0.03125*f[R*y+ac];var am;for(ab=0,am=U+y;ab<Q-y*(ag+1);ab++,am++){B[af][am]-=(ai*W[ab+X])}}for(X=0;X<b;X++){u[af][X]=x[ak[af]][X]}u[af][ag]=ad[af]}var aj;aj=d;d=B;B=aj;for(af=0;af<F;af++){for(ac=0;ac<b;ac++){x[af][ac]=u[af][ac]}}for(af=0;af<F;af++){V[af]=C[af]}}for(ag=0;ag<b;ag++){h[ag]=u[0][ag];t.Pack(h[ag],z+c)}for(ag=0;ag<b;ag++){var E;var M=1;E=h[ag];if(E>=p){M=-1;E-=p}for(af=0;af<y;af++){v[y*ag+af]=M*0.03125*f[E*y+af]}}for(af=0;af<Q;af++){D[aa+af]+=v[af]}Filters.Syn_percep_zero(v,0,G,O,L,r,Q,Y);for(af=0;af<Q;af++){e[af]-=r[af]}}}function LspQuant(){}LspQuant.MAX_LSP_SIZE=20;LspQuant.prototype.Lsp_quant=LspQuant.Lsp_quant=function(n,d,c,b,e){var h,f;var m,g;var l=0;var k=0;var a=0;for(h=0;h<b;h++){m=0;for(f=0;f<e;f++){g=(n[d+f]-c[a++]);m+=g*g}if(m<l||h==0){l=m;k=h}}for(f=0;f<e;f++){n[d+f]-=c[k*e+f]}return k};LspQuant.prototype.Lsp_weight_quant=LspQuant.Lsp_weight_quant=function(p,d,k,m,c,b,f){var h,e;var o,g;var n=0;var l=0;var a=0;for(h=0;h<b;h++){o=0;for(e=0;e<f;e++){g=(p[d+e]-c[a++]);o+=k[m+e]*g*g}if(o<n||h==0){n=o;l=h}}for(e=0;e<f;e++){p[d+e]-=c[l*f+e]}return l};var Codebook_Constants=new function(){};Codebook_Constants.exc_20_32_table=[12,32,25,46,36,33,9,14,-3,6,1,-8,0,-10,-5,-7,-7,-7,-5,-5,31,-27,24,-32,-4,10,-11,21,-3,19,23,-9,22,24,-10,-1,-10,-13,-7,-11,42,-33,31,19,-8,0,-10,-16,1,-21,-17,10,-8,14,8,4,11,-2,5,-2,-33,11,-16,33,11,-4,9,-4,11,2,6,-5,8,-5,11,-4,-6,26,-36,-16,0,4,-2,-8,12,6,-1,34,-46,-22,9,9,21,9,5,-66,-5,26,2,10,13,2,19,9,12,-81,3,13,13,0,-14,22,-35,6,-7,-4,6,-6,10,-6,-31,38,-33,0,-10,-11,5,-12,12,-17,5,0,-6,13,-9,10,8,25,33,2,-12,8,-6,10,-2,21,7,17,43,5,11,-7,-9,-20,-36,-20,-23,-4,-4,-3,27,-9,-9,-49,-39,-38,-11,-9,6,5,23,25,5,3,3,4,1,2,-3,-1,87,39,17,-21,-9,-19,-9,-15,-13,-14,-17,-11,-10,-11,-8,-6,-1,-3,-3,-1,-54,-34,-27,-8,-11,-4,-5,0,0,4,8,6,9,7,9,7,6,5,5,5,48,10,19,-10,12,-1,9,-3,2,5,-3,2,-2,-2,0,-2,-26,6,9,-7,-16,-9,2,7,7,-5,-43,11,22,-11,-9,34,37,-15,-13,-6,1,-1,1,1,-64,56,52,-11,-27,5,4,3,1,2,1,3,-1,-4,-4,-10,-7,-4,-4,2,-1,-7,-7,-12,-10,-15,-9,-5,-5,-11,-16,-13,6,16,4,-13,-16,-10,-4,2,-47,-13,25,47,19,-14,-20,-8,-17,0,-3,-13,1,6,-17,-14,15,1,10,6,-24,0,-10,19,-69,-8,14,49,17,-5,33,-29,3,-4,0,2,-8,5,-6,2,120,-56,-12,-47,23,-9,6,-5,1,2,-5,1,-10,4,-1,-1,4,-1,0,-3,30,-52,-67,30,22,11,-1,-4,3,0,7,2,0,1,-10,-4,-8,-13,5,1,1,-1,5,13,-9,-3,-10,-62,22,48,-4,-6,2,3,5,1,1,4,1,13,3,-20,10,-9,13,-2,-4,9,-20,44,-1,20,-32,-67,19,0,28,11,8,2,-11,15,-19,-53,31,2,34,10,6,-4,-58,8,10,13,14,1,12,2,0,0,-128,37,-8,44,-9,26,-3,18,2,6,11,-1,9,1,5,3,0,1,1,2,12,3,-2,-3,7,25,9,18,-6,-37,3,-8,-16,3,-10,-7,17,-34,-44,11,17,-15,-3,-16,-1,-13,11,-46,-65,-2,8,13,2,4,4,5,15,5,9,6,8,2,8,3,10,-1,3,-3,6,-2,3,3,-5,10,-11,7,6,-2,6,-2,-9,19,-12,12,-28,38,29,-1,12,2,5,23,-10,3,4,-15,21,-4,3,3,6,17,-9,-4,-8,-20,26,5,-10,6,1,-19,18,-15,-12,47,-6,-2,-7,-9,-1,-17,-2,-2,-14,30,-14,2,-7,-4,-1,-12,11,-25,16,-3,-12,11,-7,7,-17,1,19,-28,31,-7,-10,7,-10,3,12,5,-16,6,24,41,-29,-54,0,1,7,-1,5,-6,13,10,-4,-8,8,-9,-27,-53,-38,-1,10,19,17,16,12,12,0,3,-7,-4,13,12,-31,-14,6,-5,3,5,17,43,50,25,10,1,-6,-2];Codebook_Constants.exc_10_16_table=[22,39,14,44,11,35,-2,23,-4,6,46,-28,13,-27,-23,12,4,20,-5,9,37,-18,-23,23,0,9,-6,-20,4,-1,-17,-5,-4,17,0,1,9,-2,1,2,2,-12,8,-25,39,15,9,16,-55,-11,9,11,5,10,-2,-60,8,13,-6,11,-16,27,-47,-12,11,1,16,-7,9,-3,-29,9,-14,25,-19,34,36,12,40,-10,-3,-24,-14,-37,-21,-35,-2,-36,3,-6,67,28,6,-17,-3,-12,-16,-15,-17,-7,-59,-36,-13,1,7,1,2,10,2,11,13,10,8,-2,7,3,5,4,2,2,-3,-8,4,-5,6,7,-42,15,35,-2,-46,38,28,-20,-9,1,7,-3,0,-2,-5,-4,-2,-4,-8,-3,-8,-5,-7,-4,-15,-28,52,32,5,-5,-17,-20,-10,-1];Codebook_Constants.exc_10_32_table=[7,17,17,27,25,22,12,4,-3,0,28,-36,39,-24,-15,3,-9,15,-5,10,31,-28,11,31,-21,9,-11,-11,-2,-7,-25,14,-22,31,4,-14,19,-12,14,-5,4,-7,4,-5,9,0,-2,42,-47,-16,1,8,0,9,23,-57,0,28,-11,6,-31,55,-45,3,-5,4,2,-2,4,-7,-3,6,-2,7,-3,12,5,8,54,-10,8,-7,-8,-24,-25,-27,-14,-5,8,5,44,23,5,-9,-11,-11,-13,-9,-12,-8,-29,-8,-22,6,-15,3,-12,-1,-5,-3,34,-1,29,-16,17,-4,12,2,1,4,-2,-4,2,-1,11,-3,-52,28,30,-9,-32,25,44,-20,-24,4,6,-1,0,0,-3,7,-4,-4,-7,-6,-9,-2,-10,-7,-25,-10,22,29,13,-13,-22,-13,-4,0,-4,-16,10,15,-36,-24,28,25,-1,-3,66,-33,-11,-15,6,0,3,4,-2,5,24,-20,-47,29,19,-2,-4,-1,0,-1,-2,3,1,8,-11,5,5,-57,28,28,0,-16,4,-4,12,-6,-1,2,-20,61,-9,24,-22,-42,29,6,17,8,4,2,-65,15,8,10,5,6,5,3,2,-2,-3,5,-9,4,-5,23,13,23,-3,-63,3,-5,-4,-6,0,-3,23,-36,-46,9,5,5,8,4,9,-5,1,-3,10,1,-6,10,-11,24,-47,31,22,-12,14,-10,6,11,-7,-7,7,-31,51,-12,-6,7,6,-17,9,-11,-20,52,-19,3,-6,-6,-8,-5,23,-41,37,1,-21,10,-14,8,7,5,-15,-15,23,39,-26,-33,7,2,-32,-30,-21,-8,4,12,17,15,14,11];Codebook_Constants.exc_5_256_table=[-8,-37,5,-43,5,73,61,39,12,-3,-61,-32,2,42,30,-3,17,-27,9,34,20,-1,-5,2,23,-7,-46,26,53,-47,20,-2,-33,-89,-51,-64,27,11,15,-34,-5,-56,25,-9,-1,-29,1,40,67,-23,-16,16,33,19,7,14,85,22,-10,-10,-12,-7,-1,52,89,29,11,-20,-37,-46,-15,17,-24,-28,24,2,1,0,23,-101,23,14,-1,-23,-18,9,5,-13,38,1,-28,-28,4,27,51,-26,34,-40,35,47,54,38,-54,-26,-6,42,-25,13,-30,-36,18,41,-4,-33,23,-32,-7,-4,51,-3,17,-52,56,-47,36,-2,-21,36,10,8,-33,31,19,9,-5,-40,10,-9,-21,19,18,-78,-18,-5,0,-26,-36,-47,-51,-44,18,40,27,-2,29,49,-26,2,32,-54,30,-73,54,3,-5,36,22,53,10,-1,-84,-53,-29,-5,3,-44,53,-51,4,22,71,-35,-1,33,-5,-27,-7,36,17,-23,-39,16,-9,-55,-15,-20,39,-35,6,-39,-14,18,48,-64,-17,-15,9,39,81,37,-68,37,47,-21,-6,-104,13,6,9,-2,35,8,-23,18,42,45,21,33,-5,-49,9,-6,-43,-56,39,2,-16,-25,87,1,-3,-9,17,-25,-11,-9,-1,10,2,-14,-14,4,-1,-10,28,-23,40,-32,26,-9,26,4,-27,-23,3,42,-60,1,49,-3,27,10,-52,-40,-2,18,45,-23,17,-44,3,-3,17,-46,52,-40,-47,25,75,31,-49,53,30,-30,-32,-36,38,-6,-15,-16,54,-27,-48,3,38,-29,-32,-22,-14,-4,-23,-13,32,-39,9,8,-45,-13,34,-16,49,40,32,31,28,23,23,32,47,59,-68,8,62,44,25,-14,-24,-65,-16,36,67,-25,-38,-21,4,-33,-2,42,5,-63,40,11,26,-42,-23,-61,79,-31,23,-20,10,-32,53,-25,-36,10,-26,-5,3,0,-71,5,-10,-37,1,-24,21,-54,-17,1,-29,-25,-15,-27,32,68,45,-16,-37,-18,-5,1,0,-77,71,-6,3,-20,71,-67,29,-35,10,-30,19,4,16,17,5,0,-14,19,2,28,26,59,3,2,24,39,55,-50,-45,-18,-17,33,-35,14,-1,1,8,87,-35,-29,0,-27,13,-7,23,-13,37,-40,50,-35,14,19,-7,-14,49,54,-5,22,-2,-29,-8,-27,38,13,27,48,12,-41,-21,-15,28,7,-16,-24,-19,-20,11,-20,9,2,13,23,-20,11,27,-27,71,-69,8,2,-6,22,12,16,16,9,-16,-8,-17,1,25,1,40,-37,-33,66,94,53,4,-22,-25,-41,-42,25,35,-16,-15,57,31,-29,-32,21,16,-60,45,15,-1,7,57,-26,-47,-29,11,8,15,19,-105,-8,54,27,10,-17,6,-12,-1,-10,4,0,23,-10,31,13,11,10,12,-64,23,-3,-8,-19,16,52,24,-40,16,10,40,5,9,0,-13,-7,-21,-8,-6,-7,-21,59,16,-53,18,-60,11,-47,14,-18,25,-13,-24,4,-39,16,-28,54,26,-67,30,27,-20,-52,20,-12,55,12,18,-16,39,-14,-6,-26,56,-88,-55,12,25,26,-37,6,75,0,-34,-81,54,-30,1,-7,49,-23,-14,21,10,-62,-58,-57,-47,-34,15,-4,34,-78,31,25,-11,7,50,-10,42,-63,14,-36,-4,57,55,57,53,42,-42,-1,15,40,37,15,25,-11,6,1,31,-2,-6,-1,-7,-64,34,28,30,-1,3,21,0,-88,-12,-56,25,-28,40,8,-28,-14,9,12,2,-6,-17,22,49,-6,-26,14,28,-20,4,-12,50,35,40,13,-38,-58,-29,17,30,22,60,26,-54,-39,-12,58,-28,-63,10,-21,-8,-12,26,-62,6,-10,-11,-22,-6,-7,4,1,18,2,-70,11,14,4,13,19,-24,-34,24,67,17,51,-21,13,23,54,-30,48,1,-13,80,26,-16,-2,13,-4,6,-30,29,-24,73,-58,30,-27,20,-2,-21,41,45,30,-27,-3,-5,-18,-20,-49,-3,-35,10,42,-19,-67,-53,-11,9,13,-15,-33,-51,-30,15,7,25,-30,4,28,-22,-34,54,-29,39,-46,20,16,34,-4,47,75,1,-44,-55,-24,7,-1,9,-42,50,-8,-36,41,68,0,-4,-10,-23,-15,-50,64,36,-9,-27,12,25,-38,-47,-37,32,-49,51,-36,2,-4,69,-26,19,7,45,67,46,13,-63,46,15,-47,4,-41,13,-6,5,-21,37,26,-55,-7,33,-1,-28,10,-17,-64,-14,0,-36,-17,93,-3,-9,-66,44,-21,3,-12,38,-6,-13,-12,19,13,43,-43,-10,-12,6,-5,9,-49,32,-5,2,4,5,15,-16,10,-21,8,-62,-8,64,8,79,-1,-66,-49,-18,5,40,-5,-30,-45,1,-6,21,-32,93,-18,-30,-21,32,21,-18,22,8,5,-41,-54,80,22,-10,-7,-8,-23,-64,66,56,-14,-30,-41,-46,-14,-29,-37,27,-14,42,-2,-9,-29,34,14,33,-14,22,4,10,26,26,28,32,23,-72,-32,3,0,-14,35,-42,-78,-32,6,29,-18,-45,-5,7,-33,-45,-3,-22,-34,8,-8,4,-51,-25,-9,59,-78,21,-5,-25,-48,66,-15,-17,-24,-49,-13,25,-23,-64,-6,40,-24,-19,-11,57,-33,-8,1,10,-52,-54,28,39,49,34,-11,-61,-41,-43,10,15,-15,51,30,15,-51,32,-34,-2,-34,14,18,16,1,1,-3,-3,1,1,-18,6,16,48,12,-5,-42,7,36,48,7,-20,-10,7,12,2,54,39,-38,37,54,4,-11,-8,-46,-10,5,-10,-34,46,-12,29,-37,39,36,-11,24,56,17,14,20,25,0,-25,-28,55,-7,-5,27,3,9,-26,-8,6,-24,-10,-30,-31,-34,18,4,22,21,40,-1,-29,-37,-8,-21,92,-29,11,-3,11,73,23,22,7,4,-44,-9,-11,21,-13,11,9,-78,-1,47,114,-12,-37,-19,-5,-11,-22,19,12,-30,7,38,45,-21,-8,-9,55,-45,56,-21,7,17,46,-57,-87,-6,27,31,31,7,-56,-12,46,21,-5,-12,36,3,3,-21,43,19,12,-7,9,-14,0,-9,-33,-91,7,26,3,-11,64,83,-31,-46,25,2,9,5,2,2,-1,20,-17,10,-5,-27,-8,20,8,-19,16,-21,-13,-31,5,5,42,24,9,34,-20,28,-61,22,11,-39,64,-20,-1,-30,-9,-20,24,-25,-24,-29,22,-60,6,-5,41,-9,-87,14,34,15,-57,52,69,15,-3,-102,58,16,3,6,60,-75,-32,26,7,-57,-27,-32,-24,-21,-29,-16,62,-46,31,30,-27,-15,7,15];Codebook_Constants.exc_5_64_table=[1,5,-15,49,-66,-48,-4,50,-44,7,37,16,-18,25,-26,-26,-15,19,19,-27,-47,28,57,5,-17,-32,-41,68,21,-2,64,56,8,-16,-13,-26,-9,-16,11,6,-39,25,-19,22,-31,20,-45,55,-43,10,-16,47,-40,40,-20,-51,3,-17,-14,-15,-24,53,-20,-46,46,27,-68,32,3,-18,-5,9,-31,16,-9,-10,-1,-23,48,95,47,25,-41,-32,-3,15,-25,-55,36,41,-27,20,5,13,14,-22,5,2,-23,18,46,-15,17,-18,-34,-5,-8,27,-55,73,16,2,-1,-17,40,-78,33,0,2,19,4,53,-16,-15,-16,-28,-3,-13,49,8,-7,-29,27,-13,32,20,32,-61,16,14,41,44,40,24,20,7,4,48,-60,-77,17,-6,-48,65,-15,32,-30,-71,-10,-3,-6,10,-2,-7,-29,-56,67,-30,7,-5,86,-6,-10,0,5,-31,60,34,-38,-3,24,10,-2,30,23,24,-41,12,70,-43,15,-17,6,13,16,-13,8,30,-15,-8,5,23,-34,-98,-4,-13,13,-48,-31,70,12,31,25,24,-24,26,-7,33,-16,8,5,-11,-14,-8,-65,13,10,-2,-9,0,-3,-68,5,35,7,0,-31,-1,-17,-9,-9,16,-37,-18,-1,69,-48,-28,22,-21,-11,5,49,55,23,-86,-36,16,2,13,63,-51,30,-11,13,24,-18,-6,14,-19,1,41,9,-5,27,-36,-44,-34,-37,-21,-26,31,-39,15,43,5,-8,29,20,-8,-20,-52,-28,-1,13,26,-34,-10,-9,27,-8,8,27,-66,4,12,-22,49,10,-77,32,-18,3,-38,12,-3,-1,2,2,0];Codebook_Constants.exc_8_128_table=[-14,9,13,-32,2,-10,31,-10,-8,-8,6,-4,-1,10,-64,23,6,20,13,6,8,-22,16,34,7,42,-49,-28,5,26,4,-15,41,34,41,32,33,24,23,14,8,40,34,4,-24,-41,-19,-15,13,-13,33,-54,24,27,-44,33,27,-15,-15,24,-19,14,-36,14,-9,24,-12,-4,37,-5,16,-34,5,10,33,-15,-54,-16,12,25,12,1,2,0,3,-1,-4,-4,11,2,-56,54,27,-20,13,-6,-46,-41,-33,-11,-5,7,12,14,-14,-5,8,20,6,3,4,-8,-5,-42,11,8,-14,25,-2,2,13,11,-22,39,-9,9,5,-45,-9,7,-9,12,-7,34,-17,-102,7,2,-42,18,35,-9,-34,11,-5,-2,3,22,46,-52,-25,-9,-94,8,11,-5,-5,-5,4,-7,-35,-7,54,5,-32,3,24,-9,-22,8,65,37,-1,-12,-23,-6,-9,-28,55,-33,14,-3,2,18,-60,41,-17,8,-16,17,-11,0,-11,29,-28,37,9,-53,33,-14,-9,7,-25,-7,-11,26,-32,-8,24,-21,22,-19,19,-10,29,-14,-10,-4,-3,-2,3,-1,-4,-4,-5,-52,10,41,6,-30,-4,16,32,22,-27,-22,32,-3,-28,-3,3,-35,6,17,23,21,8,2,4,-45,-17,14,23,-4,-31,-11,-3,14,1,19,-11,2,61,-8,9,-12,7,-10,12,-3,-24,99,-48,23,50,-37,-5,-23,0,8,-14,35,-64,-5,46,-25,13,-1,-49,-19,-15,9,34,50,25,11,-6,-9,-16,-20,-32,-33,-32,-27,10,-8,12,-15,56,-14,-32,33,3,-9,1,65,-9,-9,-10,-2,-6,-23,9,17,3,-28,13,-32,4,-2,-10,4,-16,76,12,-52,6,13,33,-6,4,-14,-9,-3,1,-15,-16,28,1,-15,11,16,9,4,-21,-37,-40,-6,22,12,-15,-23,-14,-17,-16,-9,-10,-9,13,-39,41,5,-9,16,-38,25,46,-47,4,49,-14,17,-2,6,18,5,-6,-33,-22,44,50,-2,1,3,-6,7,7,-3,-21,38,-18,34,-14,-41,60,-13,6,16,-24,35,19,-13,-36,24,3,-17,-14,-10,36,44,-44,-29,-3,3,-54,-8,12,55,26,4,-2,-5,2,-11,22,-23,2,22,1,-25,-39,66,-49,21,-8,-2,10,-14,-60,25,6,10,27,-25,16,5,-2,-9,26,-13,-20,58,-2,7,52,-9,2,5,-4,-15,23,-1,-38,23,8,27,-6,0,-27,-7,39,-10,-14,26,11,-45,-12,9,-5,34,4,-35,10,43,-22,-11,56,-7,20,1,10,1,-26,9,94,11,-27,-14,-13,1,-11,0,14,-5,-6,-10,-4,-15,-8,-41,21,-5,1,-28,-8,22,-9,33,-23,-4,-4,-12,39,4,-7,3,-60,80,8,-17,2,-6,12,-5,1,9,15,27,31,30,27,23,61,47,26,10,-5,-8,-12,-13,5,-18,25,-15,-4,-15,-11,12,-2,-2,-16,-2,-6,24,12,11,-4,9,1,-9,14,-45,57,12,20,-35,26,11,-64,32,-10,-10,42,-4,-9,-16,32,24,7,10,52,-11,-57,29,0,8,0,-6,17,-17,-56,-40,7,20,18,12,-6,16,5,7,-1,9,1,10,29,12,16,13,-2,23,7,9,-3,-4,-5,18,-64,13,55,-25,9,-9,24,14,-25,15,-11,-40,-30,37,1,-19,22,-5,-31,13,-2,0,7,-4,16,-67,12,66,-36,24,-8,18,-15,-23,19,0,-45,-7,4,3,-13,13,35,5,13,33,10,27,23,0,-7,-11,43,-74,36,-12,2,5,-8,6,-33,11,-16,-14,-5,-7,-3,17,-34,27,-16,11,-9,15,33,-31,8,-16,7,-6,-7,63,-55,-17,11,-1,20,-46,34,-30,6,9,19,28,-9,5,-24,-8,-23,-2,31,-19,-16,-5,-15,-18,0,26,18,37,-5,-15,-2,17,5,-27,21,-33,44,12,-27,-9,17,11,25,-21,-31,-7,13,33,-8,-25,-7,7,-10,4,-6,-9,48,-82,-23,-8,6,11,-23,3,-3,49,-29,25,31,4,14,16,9,-4,-18,10,-26,3,5,-44,-9,9,-47,-55,15,9,28,1,4,-3,46,6,-6,-38,-29,-31,-15,-6,3,0,14,-6,8,-54,-50,33,-5,1,-14,33,-48,26,-4,-5,-3,-5,-3,-5,-28,-22,77,55,-1,2,10,10,-9,-14,-66,-49,11,-36,-6,-20,10,-10,16,12,4,-1,-16,45,-44,-50,31,-2,25,42,23,-32,-22,0,11,20,-40,-35,-40,-36,-32,-26,-21,-13,52,-22,6,-24,-20,17,-5,-8,36,-25,-11,21,-26,6,34,-8,7,20,-3,5,-25,-8,18,-5,-9,-4,1,-9,20,20,39,48,-24,9,5,-65,22,29,4,3,-43,-11,32,-6,9,19,-27,-10,-47,-14,24,10,-7,-36,-7,-1,-4,-5,-5,16,53,25,-26,-29,-4,-12,45,-58,-34,33,-5,2,-1,27,-48,31,-15,22,-5,4,7,7,-25,-3,11,-22,16,-12,8,-3,7,-11,45,14,-73,-19,56,-46,24,-20,28,-12,-2,-1,-36,-3,-33,19,-6,7,2,-15,5,-31,-45,8,35,13,20,0,-9,48,-13,-43,-3,-13,2,-5,72,-68,-27,2,1,-2,-7,5,36,33,-40,-12,-4,-5,23,19];Codebook_Constants.gain_cdbk_nb=[-32,-32,-32,-28,-67,-5,-42,-6,-32,-57,-10,-54,-16,27,-41,19,-19,-40,-45,24,-21,-8,-14,-18,1,14,-58,-18,-88,-39,-38,21,-18,-19,20,-43,10,17,-48,-52,-58,-13,-44,-1,-11,-12,-11,-34,14,0,-46,-37,-35,-34,-25,44,-30,6,-4,-63,-31,43,-41,-23,30,-43,-43,26,-14,-33,1,-13,-13,18,-37,-46,-73,-45,-36,24,-25,-36,-11,-20,-25,12,-18,-36,-69,-59,-45,6,8,-22,-14,-24,-1,13,-44,-39,-48,-26,-32,31,-37,-33,15,-46,-24,30,-36,-41,31,-23,-50,22,-4,-22,2,-21,-17,30,-34,-7,-60,-28,-38,42,-28,-44,-11,21,-16,8,-44,-39,-55,-43,-11,-35,26,-9,0,-34,-8,121,-81,7,-16,-22,-37,33,-31,-27,-7,-36,-34,70,-57,-37,-11,-48,-40,17,-1,-33,6,-6,-9,0,-20,-21,69,-33,-29,33,-31,-55,12,-1,-33,27,-22,-50,-33,-47,-50,54,51,-1,-5,-44,-4,22,-40,-39,-66,-25,-33,1,-26,-24,-23,-25,-11,21,-45,-25,-45,-19,-43,105,-16,5,-21,1,-16,11,-33,-13,-99,-4,-37,33,-15,-25,37,-63,-36,24,-31,-53,-56,-38,-41,-4,4,-33,13,-30,49,52,-94,-5,-30,-15,1,38,-40,-23,12,-36,-17,40,-47,-37,-41,-39,-49,34,0,-18,-7,-4,-16,17,-27,30,5,-62,4,48,-68,-43,11,-11,-18,19,-15,-23,-62,-39,-42,10,-2,-21,-13,-13,-9,13,-47,-23,-62,-24,-44,60,-21,-18,-3,-52,-22,22,-36,-75,57,16,-19,3,10,-29,23,-38,-5,-62,-51,-51,40,-18,-42,13,-24,-34,14,-20,-56,-75,-26,-26,32,15,-26,17,-29,-7,28,-52,-12,-30,5,-5,-48,-5,2,2,-43,21,16,16,-25,-45,-32,-43,18,-10,9,0,-1,-1,7,-30,19,-48,-4,-28,25,-29,-22,0,-31,-32,17,-10,-64,-41,-62,-52,15,16,-30,-22,-32,-7,9,-38];Codebook_Constants.gain_cdbk_lbr=[-32,-32,-32,-31,-58,-16,-41,-24,-43,-56,-22,-55,-13,33,-41,-4,-39,-9,-41,15,-12,-8,-15,-12,1,2,-44,-22,-66,-42,-38,28,-23,-21,14,-37,0,21,-50,-53,-71,-27,-37,-1,-19,-19,-5,-28,6,65,-44,-33,-48,-33,-40,57,-14,-17,4,-45,-31,38,-33,-23,28,-40,-43,29,-12,-34,13,-23,-16,15,-27,-14,-82,-15,-31,25,-32,-21,5,-5,-47,-63,-51,-46,12,3,-28,-17,-29,-10,14,-40];Codebook_Constants.hexc_10_32_table=[-3,-2,-1,0,-4,5,35,-40,-9,13,-44,5,-27,-1,-7,6,-11,7,-8,7,19,-14,15,-4,9,-10,10,-8,10,-9,-1,1,0,0,2,5,-18,22,-53,50,1,-23,50,-36,15,3,-13,14,-10,6,1,5,-3,4,-2,5,-32,25,5,-2,-1,-4,1,11,-29,26,-6,-15,30,-18,0,15,-17,40,-41,3,9,-2,-2,3,-3,-1,-5,2,21,-6,-16,-21,23,2,60,15,16,-16,-9,14,9,-1,7,-9,0,1,1,0,-1,-6,17,-28,54,-45,-1,1,-1,-6,-6,2,11,26,-29,-2,46,-21,34,12,-23,32,-23,16,-10,3,66,19,-20,24,7,11,-3,0,-3,-1,-50,-46,2,-18,-3,4,-1,-2,3,-3,-19,41,-36,9,11,-24,21,-16,9,-3,-25,-3,10,18,-9,-2,-5,-1,-5,6,-4,-3,2,-26,21,-19,35,-15,7,-13,17,-19,39,-43,48,-31,16,-9,7,-2,-5,3,-4,9,-19,27,-55,63,-35,10,26,-44,-2,9,4,1,-6,8,-9,5,-8,-1,-3,-16,45,-42,5,15,-16,10,0,0,0,0,0,0,0,0,0,0,-16,24,-55,47,-38,27,-19,7,-3,1,16,27,20,-19,18,5,-7,1,-5,2,-6,8,-22,0,-3,-3,8,-1,7,-8,1,-3,5,0,17,-48,58,-52,29,-7,-2,3,-10,6,-26,58,-31,1,-6,3,93,-29,39,3,17,5,6,-1,-1,-1,27,13,10,19,-7,-34,12,10,-4,9,-76,9,8,-28,-2,-11,2,-1,3,1,-83,38,-39,4,-16,-6,-2,-5,5,-2];Codebook_Constants.hexc_table=[-24,21,-20,5,-5,-7,14,-10,2,-27,16,-20,0,-32,26,19,8,-11,-41,31,28,-27,-32,34,42,34,-17,22,-10,13,-29,18,-12,-26,-24,11,22,5,-5,-5,54,-68,-43,57,-25,24,4,4,26,-8,-12,-17,54,30,-45,1,10,-15,18,-41,11,68,-67,37,-16,-24,-16,38,-22,6,-29,30,66,-27,5,7,-16,13,2,-12,-7,-3,-20,36,4,-28,9,3,32,48,26,39,3,0,7,-21,-13,5,-82,-7,73,-20,34,-9,-5,1,-1,10,-5,-10,-1,9,1,-9,10,0,-14,11,-1,-2,-1,11,20,96,-81,-22,-12,-9,-58,9,24,-30,26,-35,27,-12,13,-18,56,-59,15,-7,23,-15,-1,6,-25,14,-22,-20,47,-11,16,2,38,-23,-19,-30,-9,40,-11,5,4,-6,8,26,-21,-11,127,4,1,6,-9,2,-7,-2,-3,7,-5,10,-19,7,-106,91,-3,9,-4,21,-8,26,-80,8,1,-2,-10,-17,-17,-27,32,71,6,-29,11,-23,54,-38,29,-22,39,87,-31,-12,-20,3,-2,-2,2,20,0,-1,-35,27,9,-6,-12,3,-12,-6,13,1,14,-22,-59,-15,-17,-25,13,-7,7,3,0,1,-7,6,-3,61,-37,-23,-23,-29,38,-31,27,1,-8,2,-27,23,-26,36,-34,5,24,-24,-6,7,3,-59,78,-62,44,-16,1,6,0,17,8,45,0,-110,6,14,-2,32,-77,-56,62,-3,3,-13,4,-16,102,-15,-36,-1,9,-113,6,23,0,9,9,5,-8,-1,-14,5,-12,121,-53,-27,-8,-9,22,-13,3,2,-3,1,-2,-71,95,38,-19,15,-16,-5,71,10,2,-32,-13,-5,15,-1,-2,-14,-85,30,29,6,3,2,0,0,0,0,0,0,0,0,2,-65,-56,-9,18,18,23,-14,-2,0,12,-29,26,-12,1,2,-12,-64,90,-6,4,1,5,-5,-110,-3,-31,22,-29,9,0,8,-40,-5,21,-5,-5,13,10,-18,40,1,35,-20,30,-28,11,-6,19,7,14,18,-64,9,-6,16,51,68,8,16,12,-8,0,-9,20,-22,25,7,-4,-13,41,-35,93,-18,-54,11,-1,1,-9,4,-66,66,-31,20,-22,25,-23,11,10,9,19,15,11,-5,-31,-10,-23,-28,-6,-6,-3,-4,5,3,-28,22,-11,-42,25,-25,-16,41,34,47,-6,2,42,-19,-22,5,-39,32,6,-35,22,17,-30,8,-26,-11,-11,3,-12,33,33,-37,21,-1,6,-4,3,0,-5,5,12,-12,57,27,-61,-3,20,-17,2,0,4,0,-2,-33,-58,81,-23,39,-10,-5,2,6,-7,5,4,-3,-2,-13,-23,-72,107,15,-5,0,-7,-3,-6,5,-4,15,47,12,-31,25,-16,8,22,-25,-62,-56,-18,14,28,12,2,-11,74,-66,41,-20,-7,16,-20,16,-8,0,-16,4,-19,92,12,-59,-14,-39,49,-25,-16,23,-27,19,-3,-33,19,85,-29,6,-7,-10,16,-7,-12,1,-6,2,4,-2,64,10,-25,41,-2,-31,15,0,110,50,69,35,28,19,-10,2,-43,-49,-56,-15,-16,10,3,12,-1,-8,1,26,-12,-1,7,-11,-27,41,25,1,-11,-18,22,-7,-1,-47,-8,23,-3,-17,-7,18,-125,59,-5,3,18,1,2,3,27,-35,65,-53,50,-46,37,-21,-28,7,14,-37,-5,-5,12,5,-8,78,-19,21,-6,-16,8,-7,5,2,7,2,10,-6,12,-60,44,11,-36,-32,31,0,2,-2,2,1,-3,7,-10,17,-21,10,6,-2,19,-2,59,-38,-86,38,8,-41,-30,-45,-33,7,15,28,29,-7,24,-40,7,7,5,-2,9,24,-23,-18,6,-29,30,2,28,49,-11,-46,10,43,-13,-9,-1,-3,-7,-7,-17,-6,97,-33,-21,3,5,1,12,-43,-8,28,7,-43,-7,17,-20,19,-1,2,-13,9,54,34,9,-28,-11,-9,-17,110,-59,44,-26,0,3,-12,-47,73,-34,-43,38,-33,16,-5,-46,-4,-6,-2,-25,19,-29,28,-13,5,14,27,-40,-43,4,32,-13,-2,-35,-4,112,-42,9,-12,37,-28,17,14,-19,35,-39,23,3,-14,-1,-57,-5,94,-9,3,-39,5,30,-10,-32,42,-13,-14,-97,-63,30,-9,1,-7,12,5,20,17,-9,-36,-30,25,47,-9,-15,12,-22,98,-8,-50,15,-27,21,-16,-11,2,12,-10,10,-3,33,36,-96,0,-17,31,-9,9,3,-20,13,-11,8,-4,10,-10,9,1,112,-70,-27,5,-21,2,-57,-3,-29,10,19,-21,21,-10,-66,-3,91,-35,30,-12,0,-7,59,-28,26,2,14,-18,1,1,11,17,20,-54,-59,27,4,29,32,5,19,12,-4,1,7,-10,5,-2,10,0,23,-5,28,-104,46,11,16,3,29,1,-8,-14,1,7,-50,88,-62,26,8,-17,-14,50,0,32,-12,-3,-27,18,-8,-5,8,3,-20,-11,37,-12,9,33,46,-101,-1,-4,1,6,-1,28,-42,-15,16,5,-1,-2,-55,85,38,-9,-4,11,-2,-9,-6,3,-20,-10,-77,89,24,-3,-104,-57,-26,-31,-20,-6,-9,14,20,-23,46,-15,-31,28,1,-15,-2,6,-2,31,45,-76,23,-25];Codebook_Constants.high_lsp_cdbk=[39,12,-14,-20,-29,-61,-67,-76,-32,-71,-67,68,77,46,34,5,-13,-48,-46,-72,-81,-84,-60,-58,-40,-28,82,93,68,45,29,3,-19,-47,-28,-43,-35,-30,-8,-13,-39,-91,-91,-123,-96,10,10,-6,-18,-55,-60,-91,-56,-36,-27,-16,-48,-75,40,28,-10,-28,35,9,37,19,1,-20,-31,-41,-18,-25,-35,-68,-80,45,27,-1,47,13,0,-29,-35,-57,-50,-79,-73,-38,-19,5,35,14,-10,-23,16,-8,5,-24,-40,-62,-23,-27,-22,-16,-18,-46,-72,-77,43,21,33,1,-80,-70,-70,-64,-56,-52,-39,-33,-31,-38,-19,-19,-15,32,33,-2,7,-15,-15,-24,-23,-33,-41,-56,-24,-57,5,89,64,41,27,5,-9,-47,-60,-97,-97,-124,-20,-9,-44,-73,31,29,-4,64,48,7,-35,-57,0,-3,-26,-47,-3,-6,-40,-76,-79,-48,12,81,55,10,9,-24,-43,-73,-57,-69,16,5,-28,-53,18,29,20,0,-4,-11,6,-13,23,7,-17,-35,-37,-37,-30,-68,-63,6,24,-9,-14,3,21,-13,-27,-57,-49,-80,-24,-41,-5,-16,-5,1,45,25,12,-7,3,-15,-6,-16,-15,-8,6,-13,-42,-81,-80,-87,14,1,-10,-3,-43,-69,-46,-24,-28,-29,36,6,-43,-56,-12,12,54,79,43,9,54,22,2,8,-12,-43,-46,-52,-38,-69,-89,-5,75,38,33,5,-13,-53,-62,-87,-89,-113,-99,-55,-34,-37,62,55,33,16,21,-2,-17,-46,-29,-38,-38,-48,-39,-42,-36,-75,-72,-88,-48,-30,21,2,-15,-57,-64,-98,-84,-76,25,1,-46,-80,-12,18,-7,3,34,6,38,31,23,4,-1,20,14,-15,-43,-78,-91,-24,14,-3,54,16,0,-27,-28,-44,-56,-83,-92,-89,-3,34,56,41,36,22,20,-8,-7,-35,-42,-62,-49,3,12,-10,-50,-87,-96,-66,92,70,38,9,-70,-71,-62,-42,-39,-43,-11,-7,-50,-79,-58,-50,-31,32,31,-6,-4,-25,7,-17,-38,-70,-58,-27,-43,-83,-28,59,36,20,31,2,-27,-71,-80,-109,-98,-75,-33,-32,-31,-2,33,15,-6,43,33,-5,0,-22,-10,-27,-34,-49,-11,-20,-41,-91,-100,-121,-39,57,41,10,-19,-50,-38,-59,-60,-70,-18,-20,-8,-31,-8,-15,1,-14,-26,-25,33,21,32,17,1,-19,-19,-26,-58,-81,-35,-22,45,30,11,-11,3,-26,-48,-87,-67,-83,-58,3,-1,-26,-20,44,10,25,39,5,-9,-35,-27,-38,7,10,4,-9,-42,-85,-102,-127,52,44,28,10,-47,-61,-40,-39,-17,-1,-10,-33,-42,-74,-48,21,-4,70,52,10];Codebook_Constants.high_lsp_cdbk2=[-36,-62,6,-9,-10,-14,-56,23,1,-26,23,-48,-17,12,8,-7,23,29,-36,-28,-6,-29,-17,-5,40,23,10,10,-46,-13,36,6,4,-30,-29,62,32,-32,-1,22,-14,1,-4,-22,-45,2,54,4,-30,-57,-59,-12,27,-3,-31,8,-9,5,10,-14,32,66,19,9,2,-25,-37,23,-15,18,-38,-31,5,-9,-21,15,0,22,62,30,15,-12,-14,-46,77,21,33,3,34,29,-19,50,2,11,9,-38,-12,-37,62,1,-15,54,32,6,2,-24,20,35,-21,2,19,24,-13,55,4,9,39,-19,30,-1,-21,73,54,33,8,18,3,15,6,-19,-47,6,-3,-48,-50,1,26,20,8,-23,-50,65,-14,-55,-17,-31,-37,-28,53,-1,-17,-53,1,57,11,-8,-25,-30,-37,64,5,-52,-45,15,23,31,15,14,-25,24,33,-2,-44,-56,-18,6,-21,-43,4,-12,17,-37,20,-10,34,15,2,15,55,21,-11,-31,-6,46,25,16,-9,-25,-8,-62,28,17,20,-32,-29,26,30,25,-19,2,-16,-17,26,-51,2,50,42,19,-66,23,29,-2,3,19,-19,-37,32,15,6,30,-34,13,11,-5,40,31,10,-42,4,-9,26,-9,-70,17,-2,-23,20,-22,-55,51,-24,-31,22,-22,15,-13,3,-10,-28,-16,56,4,-63,11,-18,-15,-18,-38,-35,16,-7,34,-1,-21,-49,-47,9,-37,7,8,69,55,20,6,-33,-45,-10,-9,6,-9,12,71,15,-3,-42,-7,-24,32,-35,-2,-42,-17,-5,0,-2,-33,-54,13,-12,-34,47,23,19,55,7,-8,74,31,14,16,-23,-26,19,12,-18,-49,-28,-31,-20,2,-14,-20,-47,78,40,13,-23,-11,21,-6,18,1,47,5,38,35,32,46,22,8,13,16,-14,18,51,19,40,39,11,-26,-1,-17,47,2,-53,-15,31,-22,38,21,-15,-16,5,-33,53,15,-38,86,11,-3,-24,49,13,-4,-11,-18,28,20,-12,-27,-26,35,-25,-35,-3,-20,-61,30,10,-55,-12,-22,-52,-54,-14,19,-32,-12,45,15,-8,-48,-9,11,-32,8,-16,-34,-13,51,18,38,-2,-32,-17,22,-2,-18,-28,-70,59,27,-28,-19,-10,-20,-9,-9,-8,-21,21,-8,35,-2,45,-3,-9,12,0,30,7,-39,43,27,-38,-91,30,26,19,-55,-4,63,14,-17,13,9,13,2,7,4,6,61,72,-1,-17,29,-1,-22,-17,8,-28,-37,63,44,41,3,2,14,9,-6,75,-8,-7,-12,-15,-12,13,9,-4,30,-22,-65,15,0,-45,4,-4,1,5,22,11,23];Codebook_Constants.NB_CDBK_SIZE=64;Codebook_Constants.NB_CDBK_SIZE_LOW1=64;Codebook_Constants.NB_CDBK_SIZE_LOW2=64;Codebook_Constants.NB_CDBK_SIZE_HIGH1=64;Codebook_Constants.NB_CDBK_SIZE_HIGH2=64;Codebook_Constants.cdbk_nb=[30,19,38,34,40,32,46,43,58,43,5,-18,-25,-40,-33,-55,-52,20,34,28,-20,-63,-97,-92,61,53,47,49,53,75,-14,-53,-77,-79,0,-3,-5,19,22,26,-9,-53,-55,66,90,72,85,68,74,52,-4,-41,-58,-31,-18,-31,27,32,30,18,24,3,8,5,-12,-3,26,28,74,63,-2,-39,-67,-77,-106,-74,59,59,73,65,44,40,71,72,82,83,98,88,89,60,-6,-31,-47,-48,-13,-39,-9,7,2,79,-1,-39,-60,-17,87,81,65,50,45,19,-21,-67,-91,-87,-41,-50,7,18,39,74,10,-31,-28,39,24,13,23,5,56,45,29,10,-5,-13,-11,-35,-18,-8,-10,-8,-25,-71,-77,-21,2,16,50,63,87,87,5,-32,-40,-51,-68,0,12,6,54,34,5,-12,32,52,68,64,69,59,65,45,14,-16,-31,-40,-65,-67,41,49,47,37,-11,-52,-75,-84,-4,57,48,42,42,33,-11,-51,-68,-6,13,0,8,-8,26,32,-23,-53,0,36,56,76,97,105,111,97,-1,-28,-39,-40,-43,-54,-44,-40,-18,35,16,-20,-19,-28,-42,29,47,38,74,45,3,-29,-48,-62,-80,-104,-33,56,59,59,10,17,46,72,84,101,117,123,123,106,-7,-33,-49,-51,-70,-67,-27,-31,70,67,-16,-62,-85,-20,82,71,86,80,85,74,-19,-58,-75,-45,-29,-33,-18,-25,45,57,-12,-42,-5,12,28,36,52,64,81,82,13,-9,-27,-28,22,3,2,22,26,6,-6,-44,-51,2,15,10,48,43,49,34,-19,-62,-84,-89,-102,-24,8,17,61,68,39,24,23,19,16,-5,12,15,27,15,-8,-44,-49,-60,-18,-32,-28,52,54,62,-8,-48,-77,-70,66,101,83,63,61,37,-12,-50,-75,-64,33,17,13,25,15,77,1,-42,-29,72,64,46,49,31,61,44,-8,-47,-54,-46,-30,19,20,-1,-16,0,16,-12,-18,-9,-26,-27,-10,-22,53,45,-10,-47,-75,-82,-105,-109,8,25,49,77,50,65,114,117,124,118,115,96,90,61,-9,-45,-63,-60,-75,-57,8,11,20,29,0,-35,-49,-43,40,47,35,40,55,38,-24,-76,-103,-112,-27,3,23,34,52,75,8,-29,-43,12,63,38,35,29,24,8,25,11,1,-15,-18,-43,-7,37,40,21,-20,-56,-19,-19,-4,-2,11,29,51,63,-2,-44,-62,-75,-89,30,57,51,74,51,50,46,68,64,65,52,63,55,65,43,18,-9,-26,-35,-55,-69,3,6,8,17,-15,-61,-86,-97,1,86,93,74,78,67,-1,-38,-66,-48,48,39,29,25,17,-1,13,13,29,39,50,51,69,82,97,98,-2,-36,-46,-27,-16,-30,-13,-4,-7,-4,25,-5,-11,-6,-25,-21,33,12,31,29,-8,-38,-52,-63,-68,-89,-33,-1,10,74,-2,-15,59,91,105,105,101,87,84,62,-7,-33,-50,-35,-54,-47,25,17,82,81,-13,-56,-83,21,58,31,42,25,72,65,-24,-66,-91,-56,9,-2,21,10,69,75,2,-24,11,22,25,28,38,34,48,33,7,-29,-26,17,15,-1,14,0,-2,0,-6,-41,-67,6,-2,-9,19,2,85,74,-22,-67,-84,-71,-50,3,11,-9,2,62];Codebook_Constants.cdbk_nb_low1=[-34,-52,-15,45,2,23,21,52,24,-33,-9,-1,9,-44,-41,-13,-17,44,22,-17,-6,-4,-1,22,38,26,16,2,50,27,-35,-34,-9,-41,6,0,-16,-34,51,8,-14,-31,-49,15,-33,45,49,33,-11,-37,-62,-54,45,11,-5,-72,11,-1,-12,-11,24,27,-11,-43,46,43,33,-12,-9,-1,1,-4,-23,-57,-71,11,8,16,17,-8,-20,-31,-41,53,48,-16,3,65,-24,-8,-23,-32,-37,-32,-49,-10,-17,6,38,5,-9,-17,-46,8,52,3,6,45,40,39,-7,-6,-34,-74,31,8,1,-16,43,68,-11,-19,-31,4,6,0,-6,-17,-16,-38,-16,-30,2,9,-39,-16,-1,43,-10,48,3,3,-16,-31,-3,62,68,43,13,3,-10,8,20,-56,12,12,-2,-18,22,-15,-40,-36,1,7,41,0,1,46,-6,-62,-4,-12,-2,-11,-83,-13,-2,91,33,-10,0,4,-11,-16,79,32,37,14,9,51,-21,-28,-56,-34,0,21,9,-26,11,28,-42,-54,-23,-2,-15,31,30,8,-39,-66,-39,-36,31,-28,-40,-46,35,40,22,24,33,48,23,-34,14,40,32,17,27,-3,25,26,-13,-61,-17,11,4,31,60,-6,-26,-41,-64,13,16,-26,54,31,-11,-23,-9,-11,-34,-71,-21,-34,-35,55,50,29,-22,-27,-50,-38,57,33,42,57,48,26,11,0,-49,-31,26,-4,-14,5,78,37,17,0,-49,-12,-23,26,14,2,2,-43,-17,-12,10,-8,-4,8,18,12,-6,20,-12,-6,-13,-25,34,15,40,49,7,8,13,20,20,-19,-22,-2,-8,2,51,-51];Codebook_Constants.cdbk_nb_low2=[-6,53,-21,-24,4,26,17,-4,-37,25,17,-36,-13,31,3,-6,27,15,-10,31,28,26,-10,-10,-40,16,-7,15,13,41,-9,0,-4,50,-6,-7,14,38,22,0,-48,2,1,-13,-19,32,-3,-60,11,-17,-1,-24,-34,-1,35,-5,-27,28,44,13,25,15,42,-11,15,51,35,-36,20,8,-4,-12,-29,19,-47,49,-15,-4,16,-29,-39,14,-30,4,25,-9,-5,-51,-14,-3,-40,-32,38,5,-9,-8,-4,-1,-22,71,-3,14,26,-18,-22,24,-41,-25,-24,6,23,19,-10,39,-26,-27,65,45,2,-7,-26,-8,22,-12,16,15,16,-35,-5,33,-21,-8,0,23,33,34,6,21,36,6,-7,-22,8,-37,-14,31,38,11,-4,-3,-39,-32,-8,32,-23,-6,-12,16,20,-28,-4,23,13,-52,-1,22,6,-33,-40,-6,4,-62,13,5,-26,35,39,11,2,57,-11,9,-20,-28,-33,52,-5,-6,-2,22,-14,-16,-48,35,1,-58,20,13,33,-1,-74,56,-18,-22,-31,12,6,-14,4,-2,-9,-47,10,-3,29,-17,-5,61,14,47,-12,2,72,-39,-17,92,64,-53,-51,-15,-30,-38,-41,-29,-28,27,9,36,9,-35,-42,81,-21,20,25,-16,-5,-17,-35,21,15,-28,48,2,-2,9,-19,29,-40,30,-18,-18,18,-16,-57,15,-20,-12,-15,-37,-15,33,-39,21,-22,-13,35,11,13,-38,-63,29,23,-27,32,18,3,-26,42,33,-64,-66,-17,16,56,2,36,3,31,21,-41,-39,8,-57,14,37,-2,19,-36,-19,-23,-29,-16,1,-3,-8,-10,31,64,-65];Codebook_Constants.cdbk_nb_high1=[-26,-8,29,21,4,19,-39,33,-7,-36,56,54,48,40,29,-4,-24,-42,-66,-43,-60,19,-2,37,41,-10,-37,-60,-64,18,-22,77,73,40,25,4,19,-19,-66,-2,11,5,21,14,26,-25,-86,-4,18,1,26,-37,10,37,-1,24,-12,-59,-11,20,-6,34,-16,-16,42,19,-28,-51,53,32,4,10,62,21,-12,-34,27,4,-48,-48,-50,-49,31,-7,-21,-42,-25,-4,-43,-22,59,2,27,12,-9,-6,-16,-8,-32,-58,-16,-29,-5,41,23,-30,-33,-46,-13,-10,-38,52,52,1,-17,-9,10,26,-25,-6,33,-20,53,55,25,-32,-5,-42,23,21,66,5,-28,20,9,75,29,-7,-42,-39,15,3,-23,21,6,11,1,-29,14,63,10,54,26,-24,-51,-49,7,-23,-51,15,-66,1,60,25,10,0,-30,-4,-15,17,19,59,40,4,-5,33,6,-22,-58,-70,-5,23,-6,60,44,-29,-16,-47,-29,52,-19,50,28,16,35,31,36,0,-21,6,21,27,22,42,7,-66,-40,-8,7,19,46,0,-4,60,36,45,-7,-29,-6,-32,-39,2,6,-9,33,20,-51,-34,18,-6,19,6,11,5,-19,-29,-2,42,-11,-45,-21,-55,57,37,2,-14,-67,-16,-27,-38,69,48,19,2,-17,20,-20,-16,-34,-17,-25,-61,10,73,45,16,-40,-64,-17,-29,-22,56,17,-39,8,-11,8,-25,-18,-13,-19,8,54,57,36,-17,-26,-4,6,-21,40,42,-4,20,31,53,10,-34,-53,31,-17,35,0,15,-6,-20,-63,-73,22,25,29,17,8,-29,-39,-69,18,15,-15,-5];Codebook_Constants.cdbk_nb_high2=[11,47,16,-9,-46,-32,26,-64,34,-5,38,-7,47,20,2,-73,-99,-3,-45,20,70,-52,15,-6,-7,-82,31,21,47,51,39,-3,9,0,-41,-7,-15,-54,2,0,27,-31,9,-45,-22,-38,-24,-24,8,-33,23,5,50,-36,-17,-18,-51,-2,13,19,43,12,-15,-12,61,38,38,7,13,0,6,-1,3,62,9,27,22,-33,38,-35,-9,30,-43,-9,-32,-1,4,-4,1,-5,-11,-8,38,31,11,-10,-42,-21,-37,1,43,15,-13,-35,-19,-18,15,23,-26,59,1,-21,53,8,-41,-50,-14,-28,4,21,25,-28,-40,5,-40,-41,4,51,-33,-8,-8,1,17,-60,12,25,-41,17,34,43,19,45,7,-37,24,-15,56,-2,35,-10,48,4,-47,-2,5,-5,-54,5,-3,-33,-10,30,-2,-44,-24,-38,9,-9,42,4,6,-56,44,-16,9,-40,-26,18,-20,10,28,-41,-21,-4,13,-18,32,-30,-3,37,15,22,28,50,-40,3,-29,-64,7,51,-19,-11,17,-27,-40,-64,24,-12,-7,-27,3,37,48,-1,2,-9,-38,-34,46,1,27,-6,19,-13,26,10,34,20,25,40,50,-6,-7,30,9,-24,0,-23,71,-61,22,58,-34,-4,2,-49,-33,25,30,-8,-6,-16,77,2,38,-8,-35,-6,-30,56,78,31,33,-20,13,-39,20,22,4,21,-8,4,-6,10,-83,-41,9,-25,-43,15,-7,-12,-34,-39,-37,-33,19,30,16,-33,42,-25,25,-68,44,-15,-11,-4,23,50,14,4,-39,-43,20,-30,60,9,-20,7,16,19,-33,37,29,16,-35,7,38,-27];Codebook_Constants.h0=[0.00003596189,-0.0001123515,-0.0001104587,0.0002790277,0.0002298438,-0.0005953563,-0.0003823631,0.00113826,0.0005308539,-0.001986177,-0.0006243724,0.003235877,0.0005743159,-0.004989147,-0.0002584767,0.007367171,-0.0004857935,-0.01050689,0.001894714,0.01459396,-0.004313674,-0.01994365,0.00828756,0.02716055,-0.01485397,-0.03764973,0.026447,0.05543245,-0.05095487,-0.09779096,0.1382363,0.4600981,0.4600981,0.1382363,-0.09779096,-0.05095487,0.05543245,0.026447,-0.03764973,-0.01485397,0.02716055,0.00828756,-0.01994365,-0.004313674,0.01459396,0.001894714,-0.01050689,-0.0004857935,0.007367171,-0.0002584767,-0.004989147,0.0005743159,0.003235877,-0.0006243724,-0.001986177,0.0005308539,0.00113826,-0.0003823631,-0.0005953563,0.0002298438,0.0002790277,-0.0001104587,-0.0001123515,0.00003596189];Codebook_Constants.h1=[0.00003596189,0.0001123515,-0.0001104587,-0.0002790277,0.0002298438,0.0005953563,-0.0003823631,-0.00113826,0.0005308539,0.001986177,-0.0006243724,-0.003235877,0.0005743159,0.004989147,-0.0002584767,-0.007367171,-0.0004857935,0.01050689,0.001894714,-0.01459396,-0.004313674,0.01994365,0.00828756,-0.02716055,-0.01485397,0.03764973,0.026447,-0.05543245,-0.05095487,0.09779096,0.1382363,-0.4600981,0.4600981,-0.1382363,-0.09779096,0.05095487,0.05543245,-0.026447,-0.03764973,0.01485397,0.02716055,-0.00828756,-0.01994365,0.004313674,0.01459396,-0.001894714,-0.01050689,0.0004857935,0.007367171,0.0002584767,-0.004989147,-0.0005743159,0.003235877,0.0006243724,-0.001986177,-0.0005308539,0.00113826,0.0003823631,-0.0005953563,-0.0002298438,0.0002790277,0.0001104587,-0.0001123515,-0.00003596189];var Bits=function(){var h=1024;var c;var g;var e;var a;c=new Array();g=0;e=0;this.getBytes=function(){return c};this.Pack=function(k,j){b(k,j)};function b(k,j){var m=k;while(j>0){var l;l=(m>>(j-1))&1;c[g]|=(l<<(7-e));e++;if(e==8){e=0;g++}j--}}function f(){if(e>0){b(0,1)}while(e!=0){b(1,1)}}this.Write=function(j,m,k){f();var l=d();k=l;ArrayCopy(c,0,j,m,k);return k};this.Reset=function(){c=[];g=0;e=0};function d(){return g+((e>0)?1:0)}};function LbrLspQuant(){}function SubMode(h,e,l,j,f,b,a,d,c,g,k){this.LbrPitch=h;this.ForcedPitchGain=e;this.HaveSubframeGain=l;this.DoubleCodebook=j;this.LsqQuant=f;this.Ltp=b;this.Innovation=a;this.LpcEnhK1=d;this.LpcEnhK2=c;this.CombGain=g;this.BitsPerFrame=k}function NbLspQuant(){this.Quant=function(h,c,d,j){var g;var f,e;var b;var a=new Array();for(var g=0;g<LspQuant.MAX_LSP_SIZE;g++){a[g]=0}for(g=0;g<d;g++){c[g]=h[g]}a[0]=1/(c[1]-c[0]);a[d-1]=1/(c[d-1]-c[d-2]);for(g=1;g<d-1;g++){f=1/((0.15+c[g]-c[g-1])*(0.15+c[g]-c[g-1]));e=1/((0.15+c[g+1]-c[g])*(0.15+c[g+1]-c[g]));a[g]=(f>e)?f:e}for(g=0;g<d;g++){c[g]-=0.25*g+0.25}for(g=0;g<d;g++){c[g]*=256}b=LspQuant.Lsp_quant(c,0,Codebook_Constants.cdbk_nb,Codebook_Constants.NB_CDBK_SIZE,d);j.Pack(b,6);for(g=0;g<d;g++){c[g]*=2}b=LspQuant.Lsp_weight_quant(c,0,a,0,Codebook_Constants.cdbk_nb_low1,Codebook_Constants.NB_CDBK_SIZE_LOW1,5);j.Pack(b,6);for(g=0;g<5;g++){c[g]*=2}b=LspQuant.Lsp_weight_quant(c,0,a,0,Codebook_Constants.cdbk_nb_low2,Codebook_Constants.NB_CDBK_SIZE_LOW2,5);j.Pack(b,6);b=LspQuant.Lsp_weight_quant(c,5,a,5,Codebook_Constants.cdbk_nb_high1,Codebook_Constants.NB_CDBK_SIZE_HIGH1,5);j.Pack(b,6);for(g=5;g<10;g++){c[g]*=2}b=LspQuant.Lsp_weight_quant(c,5,a,5,Codebook_Constants.cdbk_nb_high2,Codebook_Constants.NB_CDBK_SIZE_HIGH2,5);j.Pack(b,6);for(g=0;g<d;g++){c[g]*=0.00097656}for(g=0;g<d;g++){c[g]=h[g]-c[g]}}}var VERY_SMALL=0;var NB_FRAME_SIZE=[5,43,119,160,220,300,364,492,79,1,1,1,1,1,1,1];var NB_SUBMODES=16;var NB_SUBMODE_BITS=4;var exc_gain_quant_scal1=[-0.35,0.05];var exc_gain_quant_scal3=[-2.79475,-1.81066,-1.16985,-0.848119,-0.58719,-0.329818,-0.063266,0.282826];var m_lsp;var filters;var submodes;var submodeID;var first;var frameSize;var subframeSize;var nbSubframes;var windowSize;var lpcSize;var bufSize;var min_pitch;var max_pitch;var gamma1;var gamma2;var lag_factor;var lpc_floor;var preemph;var pre_mem;var frmBuf;var frmIdx;var excBuf;var wbexcBuf;var excIdx;var innov;var lpc;var qlsp;var old_qlsp;var interp_qlsp;var interp_qlpc;var mem_sp;var pi_gain;var awk1,awk2,awk3;var voc_m1;var voc_m2;var voc_mean;var voc_offset;var dtx_enabled;this.m_lsp=new Lsp();this.filters=new Filters();Nbinit();function Nbinit(){submodes=BuildNbSubModes();submodeID=5;NbCodec_init(160,40,10,640)}function NbCodec_init(a,e,d,c){first=1;this.frameSize=a;this.windowSize=a*3/2;this.subframeSize=e;this.nbSubframes=a/e;this.lpcSize=d;this.bufSize=c;min_pitch=17;max_pitch=144;preemph=0;pre_mem=0;gamma1=0.9;gamma2=0.6;lag_factor=0.01;lpc_floor=1.0001;frmBuf=new Array();frmIdx=c-windowSize;excBuf=new Array();wbexcBuf=new Array();for(var b=0;b<c;b++){frmBuf[b]=0;excBuf[b]=0;wbexcBuf[b]=0}excIdx=c-windowSize;innov=new Array();for(var b=0;b<a;b++){innov[b]=0}lpc=new Array();for(var b=0;b<d+1;b++){lpc[b]=0}qlsp=new Array();old_qlsp=new Array();interp_qlsp=new Array();for(var b=0;b<d;b++){qlsp[b]=0;old_qlsp[b]=0;interp_qlsp[b]=0}interp_qlpc=new Array();for(var b=0;b<d+1;b++){interp_qlpc[b]=0}mem_sp=new Array();for(var b=0;b<5*d;b++){mem_sp[b]=0}pi_gain=new Array();for(var b=0;b<nbSubframes;b++){pi_gain[b]=0}awk1=new Array();awk2=new Array();awk3=new Array();for(var b=0;b<d+1;b++){awk1[b]=0;awk2[b]=0;awk3[b]=0}voc_m1=voc_m2=voc_mean=0;voc_offset=0;dtx_enabled=0}function BuildNbSubModes(){var f=new Ltp3Tap(Codebook_Constants.gain_cdbk_nb,7,7);var j=new Ltp3Tap(Codebook_Constants.gain_cdbk_lbr,5,0);var e=new Ltp3Tap(Codebook_Constants.gain_cdbk_lbr,5,7);var a=new Ltp3Tap(Codebook_Constants.gain_cdbk_lbr,5,7);var o=new LtpForcedPitch();var k=new NoiseSearch();var l=new SplitShapeSearch(40,10,4,Codebook_Constants.exc_10_16_table,4,0);var n=new SplitShapeSearch(40,10,4,Codebook_Constants.exc_10_32_table,5,0);var d=new SplitShapeSearch(40,5,8,Codebook_Constants.exc_5_64_table,6,0);var b=new SplitShapeSearch(40,8,5,Codebook_Constants.exc_8_128_table,7,0);var g=new SplitShapeSearch(40,5,8,Codebook_Constants.exc_5_256_table,8,0);var h=new SplitShapeSearch(40,20,2,Codebook_Constants.exc_20_32_table,5,0);var p=new NbLspQuant();var m=new LbrLspQuant();var c=new Array();c[1]=new SubMode(0,1,0,0,m,o,k,0.7,0.7,-1,43);c[2]=new SubMode(0,0,0,0,m,j,l,0.7,0.5,0.55,119);c[3]=new SubMode(-1,0,1,0,m,e,n,0.7,0.55,0.45,160);c[4]=new SubMode(-1,0,1,0,m,a,b,0.7,0.63,0.35,220);c[5]=new SubMode(-1,0,3,0,p,f,d,0.7,0.65,0.25,300);c[6]=new SubMode(-1,0,3,0,p,f,g,0.68,0.65,0.1,364);c[7]=new SubMode(-1,0,3,1,p,f,d,0.65,0.65,-1,492);c[8]=new SubMode(0,1,0,0,m,o,h,0.7,0.5,0.65,79);return c}var FrameSize;var BandMode=function(){};BandMode.Narrow=0;BandMode.Wide=1;BandMode.UltraWide=2;var HighLspQuant=function(){this.Quant=function(d,e,a,f){var c;var g;var b=new Array();for(c=0;c<a;c++){e[c]=d[c]}b[0]=1/(e[1]-e[0]);b[a-1]=1/(e[a-1]-e[a-2]);for(c=1;c<a-1;c++){b[c]=Math.max(1/(e[c]-e[c-1]),1/(e[c+1]-e[c]))}for(c=0;c<a;c++){e[c]-=0.3125*c+0.75}for(c=0;c<a;c++){e[c]*=256}g=LspQuant.Lsp_quant(e,0,Codebook_Constants.high_lsp_cdbk,64,a);f.Pack(g,6);for(c=0;c<a;c++){e[c]*=2}g=LspQuant.Lsp_weight_quant(e,0,b,0,Codebook_Constants.high_lsp_cdbk2,64,a);f.Pack(g,6);for(c=0;c<a;c++){e[c]*=0.0019531}for(c=0;c<a;c++){e[c]=d[c]-e[c]}}};var Lpc=new function(){this.Wld=function(c,k,h,b){var f,d;var a,g=k[0];if(k[0]==0){for(f=0;f<b;f++){h[f]=0}return 0}for(f=0;f<b;f++){a=-k[f+1];for(d=0;d<f;d++){a-=c[d]*k[f-d]}h[f]=a/=g;c[f]=a;for(d=0;d<Math.floor(f/2);d++){var e=c[d];c[d]+=a*c[f-1-d];c[f-1-d]+=a*e}if((f%2)!=0){c[d]+=c[d]*a}g*=1-a*a}return g};this.Autocorr=function(a,c,g,f){var e;var b;while(g-->0){for(b=g,e=0;b<f;b++){e+=a[b]*a[b-g]}c[g]=e}}};function Lsp(){var a;a=new Array();this.Lsp2lpc=function(c,r,s){var h,g;var p,n,d,b;var q,o,l,k=0;var e=s/2;for(h=0;h<4*e+2;h++){a[h]=0}d=1;b=1;for(g=0;g<=s;g++){var f=0;for(h=0;h<e;h++,f+=2){q=h*4;o=q+1;l=o+1;k=l+1;p=d-2*(c[f])*a[q]+a[o];n=b-2*(c[f+1])*a[l]+a[k];a[o]=a[q];a[k]=a[l];a[q]=d;a[l]=b;d=p;b=n}p=d+a[k+1];n=b-a[k+2];r[g]=(p+n)*0.5;a[k+1]=d;a[k+2]=b;d=0;b=0}}}var pw;pw=new Array();function Cheb_poly_eva(g,b,a){var e;var f;var d;var c=a>>1;d=new Array();d[0]=1;d[1]=b;f=g[c]+g[c-1]*b;b*=2;for(e=2;e<=c;e++){d[e]=b*d[e-1]-d[e-2];f+=g[c-e]*d[e]}return f}Lsp.prototype.Enforce_margin=Lsp.Enforce_margin=function(c,a,d){var b;if(c[0]<d){c[0]=d}if(c[a-1]>Math.PI-d){c[a-1]=Math.PI-d}for(b=1;b<a-1;b++){if(c[b]<c[b-1]+d){c[b]=c[b-1]+d}if(c[b]>c[b+1]-d){c[b]=0.5*(c[b]+c[b+1]-d)}}};Lsp.prototype.Lpc2lsp=Lsp.Lpc2lsp=function(G,z,b,f,F){var C,s,x,B,l,g,h=0;var H;var A,w,u,y,v;var c;var d;var n;var E;var r;var o;var t;var e=0;y=1;u=z/2;c=new Array();d=new Array();n=0;E=0;r=n;o=E;d[n++]=1;c[E++]=1;for(A=1;A<=u;A++){d[n++]=G[A]+G[z+1-A]-d[r++];c[E++]=G[A]-G[z+1-A]+c[o++]}n=0;E=0;for(A=0;A<u;A++){d[n]=2*d[n];c[E]=2*c[E];n++;E++}n=0;E=0;g=0;l=1;for(w=0;w<z;w++){if(w%2!=0){t=c}else{t=d}C=Cheb_poly_eva(t,l,z);y=1;while((y==1)&&(g>=-1)){var D=F*(1-0.9*l*l);if(Math.abs(C)<0.2){D*=0.5}g=l-D;s=Cheb_poly_eva(t,g,z);H=s;B=g;if((s*C)<0){e++;x=C;for(v=0;v<=f;v++){h=(l+g)/2;x=Cheb_poly_eva(t,h,z);if(x*C>0){C=x;l=h}else{s=x;g=h}}b[w]=h;l=h;y=0}else{C=H;l=B}}}return e};function Vbr(){var s=5;var e=6000;var q=0.3;var t=[[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],[3.5,2.5,2,1.2,0.5,0,-0.5,-0.7,-0.8,-0.9,-1],[10,6.5,5.2,4.5,3.9,3.5,3,2.5,2.3,1.8,1],[11,8.8,7.5,6.5,5,3.9,3.9,3.9,3.5,3,1],[11,11,9.9,9,8,7,6.5,6,5,4,2],[11,11,11,11,9.5,9,8,7,6.5,5,3],[11,11,11,11,11,11,9.5,8.5,8,6.5,4],[11,11,11,11,11,11,11,11,9.8,7.5,5.5],[8,5,3.7,3,2.5,2,1.8,1.5,1,0,0]];var l=[[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],[11,11,9.5,8.5,7.5,6,5,3.9,3,2,1],[11,11,11,11,11,9.5,8.7,7.8,7,6.5,4],[11,11,11,11,11,11,11,11,9.8,7.5,5.5]];var j=[[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],[3.9,2.5,0,0,0,0,0,0,0,0,-1]];var a;var c;var h;var g;var o;var d;var r;var n;var m;var k;var b;var f;c=0;h=1;o=0;a=0.1;r=0;d=0;n=0;k=0.05*Math.pow(e,q);b=0.05;m=k/b;f=0;g=new Array();for(var p=0;p<s;p++){g[p]=Math.log(e)}}var SB_FRAME_SIZE=[4,36,112,192,352,-1,-1,-1];var SB_SUBMODES=8;var SB_SUBMODE_BITS=3;var QMF_ORDER=64;var fullFrameSize;var foldingGain;var high;var y0,y1;var x0d;var g0_mem,g1_mem;var wbmodes;var wbmodeID;function SbCodec_init(a,f,e,c,d){wbmodes=BuildWbSubModes();wbmodeID=3;fullFrameSize=2*a;foldingGain=d;lag_factor=0.002;high=new Array();y0=new Array();y1=new Array();x0d=new Array();g0_mem=new Array();g1_mem=new Array();for(var b=0;b<fullFrameSize;b++){high[b]=0;y0[b]=0;y1[b]=0}for(var b=0;b<a;b++){x0d[b]=0}for(var b=0;b<QMF_ORDER;b++){g0_mem[b]=0;g1_mem[b]=0}}function BuildWbSubModes(){var a=new HighLspQuant();var d=new SplitShapeSearch(40,10,4,Codebook_Constants.hexc_10_32_table,5,0);var b=new SplitShapeSearch(40,8,5,Codebook_Constants.hexc_table,7,1);var c=new Array();c[1]=new SubMode(0,0,1,0,a,null,null,0.75,0.75,-1,36);c[2]=new SubMode(0,0,1,0,a,null,d,0.85,0.6,-1,112);c[3]=new SubMode(0,0,1,0,a,null,b,0.75,0.7,-1,192);c[4]=new SubMode(0,0,1,1,a,null,b,0.75,0.75,-1,352);return c}function BuildUwbSubModes(){var a=new HighLspQuant();var b=new Array();b[1]=new SubMode(0,0,1,0,a,null,null,0.75,0.75,-1,2);return b}function NbEncoder(){var p=[1,8,2,3,3,4,4,5,5,6,7];var H;var x;var k;var z;var q;var u;var b;var E;var I;var D;var h;var F;var t;var K;var g;var o;var m;var C;var w;var n;var y;var l;var G;var r;var A;var e;var J;var c;var v;var f;var s;var j;var a;var d;B(160,40,10,640);function B(L,P,O,N){NbCodec_init(L,P,O,N);A=3;e=0;vad_enabled=0;J=0;c=8;submodeSelect=5;k=0;H=1;z=new Array();q=N-windowSize;u=new Array();b=N-windowSize;for(var M=0;M<N;M++){z[M]=0;u[M]=0}E=Window(windowSize,P);h=LagWindow(O,lag_factor);D=new Array();for(var M=0;M<O+1;M++){D[M]=0}I=new Array();for(var M=0;M<windowSize;M++){I[M]=0}g=new Array();interp_qlpc=new Array();o=new Array();m=new Array();for(var M=0;M<O+1;M++){g[M]=0;interp_qlpc[M]=0;o[M]=0;m[M]=0}F=new Array();qlsp=new Array();t=new Array();old_qlsp=new Array();K=new Array();interp_qlsp=new Array();for(var M=0;M<O;M++){F[M]=0;qlsp[M]=0;t[M]=0;old_qlsp[M]=0;K[M]=0;interp_qlsp[M]=0}C=new Array();mem_sp=new Array();w=new Array();n=new Array();y=new Array();for(var M=0;M<O;M++){C[M]=0;mem_sp[M]=0;w[M]=0;n[M]=0;y[M]=0}l=new Vbr();G=0;j=0;a=8000;awk1=new Array();awk2=new Array();awk3=new Array();for(var M=0;M<O+1;M++){awk1[M]=0;awk2[M]=0;awk3[M]=0}r=new Array();for(var M=0;M<40;M++){r[M]=0}x=new Array();for(var M=0;M<nbSubframes;M++){x[M]=0}}this.Encode=function(ag,ad){var ai;var ap,am,V;var W;var Q;ArrayCopy(frmBuf,frameSize,frmBuf,0,bufSize-frameSize);frmBuf[bufSize-frameSize]=ad[0]-preemph*pre_mem;for(ai=1;ai<frameSize;ai++){frmBuf[bufSize-frameSize+ai]=ad[ai]-preemph*ad[ai-1]}pre_mem=ad[frameSize-1];ArrayCopy(z,frameSize,z,0,bufSize-frameSize);ArrayCopy(excBuf,frameSize,excBuf,0,bufSize-frameSize);ArrayCopy(u,frameSize,u,0,bufSize-frameSize);for(ai=0;ai<windowSize;ai++){I[ai]=frmBuf[ai+frmIdx]*E[ai]}Lpc.Autocorr(I,D,lpcSize+1,windowSize);D[0]+=10;D[0]*=lpc_floor;for(ai=0;ai<lpcSize+1;ai++){D[ai]*=h[ai]}Lpc.Wld(lpc,D,C,lpcSize);ArrayCopy(lpc,0,lpc,1,lpcSize);lpc[0]=1;var T=Lsp.Lpc2lsp(lpc,lpcSize,F,15,0.2);if(T==lpcSize){for(ai=0;ai<lpcSize;ai++){F[ai]=Math.acos(F[ai])}}else{if(A>1){T=Lsp.Lpc2lsp(lpc,lpcSize,F,11,0.05)}if(T==lpcSize){for(ai=0;ai<lpcSize;ai++){F[ai]=Math.acos(F[ai])}}else{for(ai=0;ai<lpcSize;ai++){F[ai]=t[ai]}}}var L=0;for(ai=0;ai<lpcSize;ai++){L+=(t[ai]-F[ai])*(t[ai]-F[ai])}var O;var Y;var af;if(first!=0){for(ai=0;ai<lpcSize;ai++){K[ai]=F[ai]}}else{for(ai=0;ai<lpcSize;ai++){K[ai]=0.375*t[ai]+0.625*F[ai]}}Lsp.Enforce_margin(K,lpcSize,0.002);for(ai=0;ai<lpcSize;ai++){K[ai]=Math.cos(K[ai])}m_lsp.Lsp2lpc(K,g,lpcSize);Y=0;af=0;Filters.Fir_mem2(frmBuf,frmIdx,g,excBuf,excIdx,frameSize,lpcSize,y);O=0;for(ai=0;ai<frameSize;ai++){O+=excBuf[excIdx+ai]*excBuf[excIdx+ai]}O=Math.sqrt(1+O/frameSize);v=-1;ag.Pack(0,1);ag.Pack(submodeID,NB_SUBMODE_BITS);if(first!=0){for(ai=0;ai<lpcSize;ai++){t[ai]=F[ai]}}submodes[submodeID].LsqQuant.Quant(F,qlsp,lpcSize,ag);if(submodes[submodeID].LbrPitch!=-1){ag.Pack(Y-min_pitch,7)}var U=Math.floor(0.5+3.5*Math.log(O));if(U<0){U=0}if(U>31){U=31}O=Math.exp(U/3.5);ag.Pack(U,5);if(first!=0){for(ai=0;ai<lpcSize;ai++){old_qlsp[ai]=qlsp[ai]}}ap=new Array();am=new Array();W=new Array();for(var ai=0;ai<subframeSize;ai++){ap[ai]=0;am[ai]=0;W[ai]=0}V=new Array();for(var ai=0;ai<lpcSize;ai++){V[ai]=0}Q=new Array();for(var ai=0;ai<frameSize;ai++){Q[ai]=0}for(ai=0;ai<frameSize;ai++){Q[ai]=frmBuf[frmIdx+ai]}for(var X=0;X<nbSubframes;X++){var al;var S;var ah,ac,ab,N;var ao;S=subframeSize*X;ah=frmIdx+S;ab=excIdx+S;ac=b+S;N=q+S;al=(1+X)/nbSubframes;for(ai=0;ai<lpcSize;ai++){K[ai]=(1-al)*t[ai]+al*F[ai]}for(ai=0;ai<lpcSize;ai++){interp_qlsp[ai]=(1-al)*old_qlsp[ai]+al*qlsp[ai]}Lsp.Enforce_margin(K,lpcSize,0.002);Lsp.Enforce_margin(interp_qlsp,lpcSize,0.002);for(ai=0;ai<lpcSize;ai++){K[ai]=Math.cos(K[ai])}m_lsp.Lsp2lpc(K,g,lpcSize);for(ai=0;ai<lpcSize;ai++){interp_qlsp[ai]=Math.cos(interp_qlsp[ai])}m_lsp.Lsp2lpc(interp_qlsp,interp_qlpc,lpcSize);al=1;pi_gain[X]=0;for(ai=0;ai<=lpcSize;ai++){pi_gain[X]+=al*interp_qlpc[ai];al=-al}Filters.Bw_lpc(gamma1,g,o,lpcSize);if(gamma2>=0){Filters.Bw_lpc(gamma2,g,m,lpcSize)}else{m[0]=1;m[1]=-preemph;for(ai=2;ai<=lpcSize;ai++){m[ai]=0}}for(ai=0;ai<subframeSize;ai++){excBuf[ab+ai]=0}excBuf[ab]=1;Filters.Syn_percep_zero(excBuf,ab,interp_qlpc,o,m,W,subframeSize,lpcSize);for(ai=0;ai<subframeSize;ai++){excBuf[ab+ai]=0}for(ai=0;ai<subframeSize;ai++){z[N+ai]=0}for(ai=0;ai<lpcSize;ai++){V[ai]=mem_sp[ai]}Filters.Iir_mem2(excBuf,ab,interp_qlpc,excBuf,ab,subframeSize,lpcSize,V);for(ai=0;ai<lpcSize;ai++){V[ai]=w[ai]}Filters.Filter_mem2_b(excBuf,ab,o,m,ap,0,subframeSize,lpcSize,V,0);for(ai=0;ai<lpcSize;ai++){V[ai]=w[ai]}Filters.Filter_mem2_b(frmBuf,ah,o,m,u,ac,subframeSize,lpcSize,V,0);for(ai=0;ai<subframeSize;ai++){am[ai]=u[ac+ai]-ap[ai]}for(ai=0;ai<subframeSize;ai++){excBuf[ab+ai]=z[N+ai]=0}var M,P;M=min_pitch;P=max_pitch;if(H!=0&&P>S){P=S}ao=submodes[submodeID].Ltp.Quant(am,u,ac,interp_qlpc,o,m,excBuf,ab,M,P,af,lpcSize,subframeSize,ag,z,N,W,A);x[X]=ao;Filters.Syn_percep_zero(excBuf,ab,interp_qlpc,o,m,ap,subframeSize,lpcSize);for(ai=0;ai<subframeSize;ai++){am[ai]-=ap[ai]}var ak;var aj=0,aa;ak=X*subframeSize;for(ai=0;ai<subframeSize;ai++){innov[ak+ai]=0}Filters.Residue_percep_zero(am,0,interp_qlpc,o,m,I,subframeSize,lpcSize);for(ai=0;ai<subframeSize;ai++){aj+=I[ai]*I[ai]}aj=Math.sqrt(0.1+aj/subframeSize);aj/=O;if(submodes[submodeID].HaveSubframeGain!=0){var an;aj=Math.log(aj);if(submodes[submodeID].HaveSubframeGain==3){an=VQ.Index_s(aj,exc_gain_quant_scal3,8);ag.Pack(an,3);aj=exc_gain_quant_scal3[an]}else{an=VQ.Index_s(aj,exc_gain_quant_scal1,2);ag.Pack(an,1);aj=exc_gain_quant_scal1[an]}aj=Math.exp(aj)}else{aj=1}aj*=O;aa=1/aj;for(ai=0;ai<subframeSize;ai++){am[ai]*=aa}submodes[submodeID].Innovation.Quantify(am,interp_qlpc,o,m,lpcSize,subframeSize,innov,ak,W,ag,A);for(ai=0;ai<subframeSize;ai++){innov[ak+ai]*=aj}for(ai=0;ai<subframeSize;ai++){excBuf[ab+ai]+=innov[ak+ai]}for(ai=0;ai<subframeSize;ai++){am[ai]*=aj}for(ai=0;ai<lpcSize;ai++){V[ai]=mem_sp[ai]}Filters.Iir_mem2(excBuf,ab,interp_qlpc,frmBuf,ah,subframeSize,lpcSize,mem_sp);Filters.Filter_mem2_b(frmBuf,ah,o,m,u,ac,subframeSize,lpcSize,w,0);for(ai=0;ai<subframeSize;ai++){z[N+ai]=excBuf[ab+ai]}}if(submodeID>=1){for(ai=0;ai<lpcSize;ai++){t[ai]=F[ai]}for(ai=0;ai<lpcSize;ai++){old_qlsp[ai]=qlsp[ai]}}first=0;var Z=0,R=0;var ae;for(ai=0;ai<frameSize;ai++){Z+=frmBuf[frmIdx+ai]*frmBuf[frmIdx+ai];R+=(frmBuf[frmIdx+ai]-Q[ai])*(frmBuf[frmIdx+ai]-Q[ai])}ae=10*Math.log((Z+1)/(R+1));ad[0]=frmBuf[frmIdx]+preemph*k;for(ai=1;ai<frameSize;ai++){ad[ai]=frmBuf[frmIdx+ai]+preemph*ad[ai-1]}k=ad[frameSize-1];if(submodes[submodeID].constructor===NoiseSearch||submodeID==0){H=1}else{H=0}return 1};this.getPiGain=function(){var L=[];ArrayCopy(pi_gain,0,L,0,pi_gain.length);return L};this.getExc=function(){var M=new Array();for(var L=0;L<frameSize;L++){M[L]=0}ArrayCopy(excBuf,excIdx,M,0,frameSize);return M};this.getInnov=function(){return innov};this.getMode=function(){if(d<0){d=0}var L=submodeID;if(d!=undefined){submodeID=submodeSelect=d}return L}}function Window(a,f){var b;var e=f*7/2;var d=f*5/2;var c=new Array();for(b=0;b<e;b++){c[b]=0.54-0.46*Math.cos(Math.PI*b/e)}for(b=0;b<d;b++){c[e+b]=0.54+0.46*Math.cos(Math.PI*b/d)}return c}function LagWindow(d,b){var c=new Array();for(var a=0;a<d+1;a++){c[a]=Math.exp(-0.5*(2*Math.PI*b*a)*(2*Math.PI*b*a))}return c}function SbEncoder(K){var r=[1,8,2,3,4,5,5,6,6,7,7];var P=[1,1,1,1,1,1,2,2,3,3,4];var N=[0,1,1,1,1,1,1,1,1,1,1];var C;var e;var T;var u;var x;var H;var a;var R;var l;var M;var O;var w;var Q;var S;var aa;var h;var q;var p;var m;var E;var W;var n;var v;var F;var A,z;var d;var U,D;var G;var j;var o;var y;var V;var ab;var I;var f;var X;var Y;var c;var B;var g;var s;var k;var b;var J;var t;if(K){Uwbinit()}else{Z()}function Z(){C=new NbEncoder();L(160,40,8,640,0.9);F=false;W=5;b=16000}function L(ac,ah,ag,ae,af){SbCodec_init(ac,ah,ag,ae,af);t=ag;I=3;f=0;X=0;Y=0;c=8;J=wbmodeID;e=[];T=[];u=[];x=[];H=[];a=[];Q=[];n=[];v=[];A=[];z=[];d=[];U=[];D=[];G=[];o=[];for(var ad=0;ad<5*t;ad++){o[ad]=0}for(var ad=0;ad<t+1;ad++){G[ad]=0}for(var ad=0;ad<fullFrameSize;ad++){v[ad]=0;A[ad]=0;z[ad]=0}for(var ad=0;ad<t;ad++){Q[ad]=0;n[ad]=0}for(var ad=0;ad<ac;ad++){e[ad]=0;d[ad]=0}for(var ad=0;ad<QMF_ORDER;ad++){T[ad]=0;U[ad]=0;D[ad]=0}for(var ad=0;ad<windowSize;ad++){u[ad]=0}for(var ad=0;ad<ac;ad++){x[ad]=0;H[ad]=0}for(var ad=0;ad<ah;ad++){a[ad]=0}R=Window(windowSize,ah);l=LagWindow(t,lag_factor);M=[];O=[];w=[];S=[];aa=[];h=[];q=[];p=[];m=[];E=[];V=[];y=[];ab=[];for(var ad=0;ad<t;ad++){M[ad]=0;w[ad]=0;S[ad]=0;m[ad]=0;E[ad]=0;y[ad]=0;V[ad]=0}for(var ad=0;ad<t+1;ad++){O[ad]=0;q[ad]=0;p[ad]=0;ab[ad]=0}k=0;j=1}this.Encode=function(ax,aw){var ay;var am,an;var aD,al,ae;var ai;wbmodeID=1;Filters.Qmf_decomp(aw,Codebook_Constants.h0,d,e,fullFrameSize,QMF_ORDER,T);C.Encode(ax,d);for(ay=0;ay<windowSize-frameSize;ay++){v[ay]=v[frameSize+ay]}for(ay=0;ay<frameSize;ay++){v[windowSize-frameSize+ay]=e[ay]}ArrayCopy(wbexcBuf,frameSize,wbexcBuf,0,bufSize-frameSize);aD=C.getPiGain();al=C.getExc();ae=C.getInnov();var aq=C.getMode();if(aq==0){ai=1}else{ai=0}for(ay=0;ay<windowSize;ay++){u[ay]=v[ay]*R[ay]}Lpc.Autocorr(u,O,t+1,windowSize);O[0]+=1;O[0]*=lpc_floor;for(ay=0;ay<t+1;ay++){O[ay]*=l[ay]}Lpc.Wld(lpc,O,M,t);ArrayCopy(lpc,0,lpc,1,t);var ak=Lsp.Lpc2lsp(lpc,t,w,15,0.2);if(ak!=t){ak=Lsp.Lpc2lsp(lpc,t,w,11,0.02);if(ak!=t){for(ay=0;ay<t;ay++){w[ay]=Math.cos(Math.PI*((ay+1))/(t+1))}}}for(ay=0;ay<t;ay++){w[ay]=Math.acos(w[ay])}var ac=0;for(ay=0;ay<t;ay++){ac+=(S[ay]-w[ay])*(S[ay]-w[ay])}ax.Pack(1,1);if(ai!=0){ax.Pack(0,SB_SUBMODE_BITS)}else{ax.Pack(wbmodeID,SB_SUBMODE_BITS)}wbmodes[wbmodeID].LsqQuant.Quant(w,Q,t,ax);if(j!=0){for(ay=0;ay<t;ay++){S[ay]=w[ay]}for(ay=0;ay<t;ay++){n[ay]=Q[ay]}}am=new Array();an=new Array();innov=new Array();for(var ay=0;ay<lpcSize;ay++){am[ay]=0}for(var ay=0;ay<lpcSize;ay++){an[ay]=0;innov[ay]=0}for(var ao=0;ao<nbSubframes;ao++){var aC,ag;var av,az,au,at;var aj;var ap,ar,af=0,ad=0;var ah;aj=subframeSize*ao;az=aj;av=excIdx+aj;at=aj;au=aj;aC=(1+ao)/nbSubframes;for(ay=0;ay<t;ay++){V[ay]=(1-aC)*S[ay]+aC*w[ay]}for(ay=0;ay<t;ay++){y[ay]=(1-aC)*n[ay]+aC*Q[ay]}Lsp.Enforce_margin(V,t,0.05);Lsp.Enforce_margin(y,t,0.05);for(ay=0;ay<t;ay++){V[ay]=Math.cos(V[ay])}for(ay=0;ay<t;ay++){y[ay]=Math.cos(y[ay])}m_lsp.Lsp2lpc(V,ab,t);m_lsp.Lsp2lpc(y,G,t);Filters.Bw_lpc(gamma1,ab,q,t);Filters.Bw_lpc(gamma2,ab,p,t);ap=ar=0;aC=1;pi_gain[ao]=0;for(ay=0;ay<=t;ay++){ar+=aC*G[ay];aC=-aC;pi_gain[ao]+=G[ay]}ap=aD[ao];ap=1/(Math.abs(ap)+0.01);ar=1/(Math.abs(ar)+0.01);ag=Math.abs(0.01+ar)/(0.01+Math.abs(ap));ah=(ag<5)?1:0;ah=0;Filters.Fir_mem2(v,az,G,wbexcBuf,av,subframeSize,t,m);for(ay=0;ay<subframeSize;ay++){af+=wbexcBuf[av+ay]*wbexcBuf[av+ay]}if(wbmodes[wbmodeID].Innovation==null){var aB;for(ay=0;ay<subframeSize;ay++){ad+=ae[aj+ay]*ae[aj+ay]}aB=af/(0.01+ad);aB=Math.sqrt(aB);aB*=ag;var aA=Math.floor(0.5+10+8*Math.log((aB+0.0001)));if(aA<0){aA=0}if(aA>31){aA=31}ax.Pack(aA,5);aB=0.1*Math.exp(aA/9.4);aB/=ag}for(ay=0;ay<lpcSize;ay++){am[ay]=o[ay]}Filters.Iir_mem2(wbexcBuf,av,G,v,az,subframeSize,t,o);Filters.Filter_mem2_b(v,az,q,p,x,au,subframeSize,t,E,0)}filters.Fir_mem_up(d,Codebook_Constants.h0,A,fullFrameSize,QMF_ORDER,U);filters.Fir_mem_up(v,Codebook_Constants.h1,z,fullFrameSize,QMF_ORDER,D);for(ay=0;ay<fullFrameSize;ay++){aw[ay]=2*(A[ay]-z[ay])}for(ay=0;ay<t;ay++){S[ay]=w[ay]}for(ay=0;ay<t;ay++){n[ay]=Q[ay]}j=0;return 1}}function ArrayCopy(f,a,g,b,e){var c=f.slice(a,a+e);for(var d=0;d<e;d++){g[b+d]=c[d]}};'],
            {type: "text/javascript"}));
    };
    var settings = {
        "serverUrl": "wss://h5.openspeech.cn/iat.do",
        "recordWorkerPath": null,
        "vadWorkerPath": null,
        "speexWorkerPath": null
    };

    var sessionInfo = {
        id: null,
        synId: 0//音频帧计数
    };
    var recording = false;
    var rec_state = "";
    var audioStream = null;
    var audioCtx = null;
    var audioNode = {
        "source":null,
        "scriptNode":null
    }
    var serverParam = "";
    var env = {
        "browserId":null,
        "bufferSize":null,
        "host":null,
        "isSupport":true
    };

    var recorderWorker = null;
    var speexWorker = null;
    var vadWorker = null;

    var newRecorderWorker = function (path) {
        var recorderWorker = new Worker(path);
        recorderWorker.onmessage = function (e) {
            volumeCheck.listen(e.data.volume)
            callback.onVolume(e.data.volume);

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
                    outputBufferLength: env.bufferSize
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
    };
    var newSpeexWorker = function (path) {
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
    };
    var newVadWorker = function (path) {
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
    };

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

    var socket = null;
    var newSocket = function (url) {
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
    };

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
            if (!window.URL){
                return false;
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
        },
        "getBrowserId":function(){
            if(typeof(Fingerprint2) == "function"){
                new Fingerprint2().get(function(result){
                    env.browserId = result;
                });
            }else{
                env.browserId = "unknow:"+btoa(navigator.userAgent).substr(0,16);
            }
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
            volumeCheck.start();

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
            volumeCheck.stop();
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
        audioNode.source = audioCtx.createMediaStreamSource(stream);
        audioNode.scriptNode = audioCtx.createScriptProcessor(env.bufferSize, 1, 1);
        recorderWorker.init(audioCtx.sampleRate);

        audioNode.scriptNode.onaudioprocess = function (e) {
            if (!recording) return;
            console.log(e.inputBuffer.getChannelData(0));
            recorderWorker.sendData(e.inputBuffer.getChannelData(0));
        };
        audioNode.source.connect(audioNode.scriptNode);
        audioNode.scriptNode.connect(audioCtx.destination);
        iatEvent.startRecord();
    };

    var initMedia = function () {
        navigator.getUserMedia({audio: true}, gotStream, function (e) {
            alert("getUserMedia error " + e.name);
        });
        if(audioCtx == null){
            audioCtx = new window.AudioContext();
        }
    };
    var volumeCheck = (function(){
        var lowVolumeLimit = 8;//音量过小
        var interval = 500;//音量判定间隔
        var maxTooLow = 5;//录音开始多少判定点提示音量过小
        var maxVolume = 0;
        var checkEventId = 0;

        var isTooLow = false;
        var tooLowCount = 0;

        var init = function(){
            maxVolume = 0;
            isTooLow = false;
            tooLowCount = 0;
        };
        var fire = function(){
            if(!isTooLow && maxVolume <lowVolumeLimit){
                tooLowCount++;
                if(tooLowCount >= maxTooLow){
                    isTooLow = true;
                    callback.onProcess("lowVolume");//音量太小
                }
                return
            }
            if(isTooLow && maxVolume >= lowVolumeLimit){
                callback.onProcess("normalVolume");//正常音量
            }
            if(maxVolume >= lowVolumeLimit){
                clearInterval(checkEventId);//一旦恢复正常，结束
                tooLowCount = 0;
            }
        };
        var start = function(){
            init();
            checkEventId = setInterval(fire,interval);
        };
        var stop = function(){
            clearInterval(checkEventId);
        };

        var listen = function(volume){
            maxVolume = Math.max(maxVolume,volume);
        };

        return {
            "start":start,
            "stop":stop,
            "listen":listen
        }
    })();
    return function (setting) {
        callback = utils.extend(callback,setting.callback);
        settings = utils.extend(settings,setting.params);
        //init
        (function () {
            //api 统一
            navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
            window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;
            window.URL = window.URL || window.webkitURL;
            //环境变量判断
            utils.getBrowserId();
            env.host = window.document.domain;
            env.bufferSize = utils.getBufferSize();
            env.isSupport = utils.checkIsSupport();
        })();
        this.isSupport = function () {
            return env.isSupport;
        };
        if(!env.isSupport){
            return;
        }
        settings.recordWorkerPath = recordWorkerCode();
        settings.vadWorkerPath = vadWorkerCode();
        settings.speexWorkerPath = speexWorkCode();

        recorderWorker = newRecorderWorker(settings.recordWorkerPath);
        speexWorker = newSpeexWorker(settings.speexWorkerPath);
        vadWorker = newVadWorker(settings.vadWorkerPath);
        socket = newSocket(settings.serverUrl);
        this.start = function (iat_params_obj) {
            serverParam = iat_params_obj.params + ", rse = utf8, browser_id=" + env.browserId + ",host=" + env.domain;
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

        this.kill = function () {
            if (audioStream != null) {
                var tracks = audioStream.getAudioTracks();
                for(var i=0 ;i<tracks.length;i++){
                    tracks[i].stop();
                }
                audioStream = null;
            }
            if (audioCtx != null) {
                audioNode.source.disconnect();
                audioNode.scriptNode.disconnect();
            }
        }
    }
})(window, navigator);