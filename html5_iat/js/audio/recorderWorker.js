var sampleRate,outputBufferLength;

var recBuffers  = [];
 
onmessage = function(e){
  switch(e.data.command){
    case "init":
      init(e.data.config);
      break;
    case "record":
      record(e.data.buffer);
      break;
	case "reset":
	  reset();
	  break;
  }
};
 
function init(config){
  sampleRate = config.sampleRate;
  outputBufferLength = config.outputBufferLength;
}
function reset(){
    recBuffers = [];
}

function record(inputBuffer){	
	var rss = new Resampler(sampleRate, 16000, 1, outputBufferLength, true);
	var i;
	var tempArray = [];
	for ( i = 0 ; i < inputBuffer.length ; i++) {
        tempArray.push(inputBuffer[i]);
    }
	
	var l = rss.resampler(tempArray); 
	var outputBuffer = new Float32Array(l);
	for( i = 0; i < l; i++)
		outputBuffer[i] = rss.outputBuffer[i];
	
	var data = floatTo16BitPCM(outputBuffer);
	
	
	for ( i = 0 ; i < data.length ; i++) {
        recBuffers.push(data[i]);
    }
		
	while(recBuffers.length > 320)
	{
		var items = recBuffers.splice(0, 320);
		var result = new Int16Array(320);
		for( i = 0; i < 320; i++)
		{
			result[i] = items[i];
		}
		this.postMessage({ "buffer" : result});
	}
}




function floatTo16BitPCM(input)
{
    var output = new Int16Array(input.length);
    for (var i = 0; i < input.length; i++){
		var s = Math.max(-1, Math.min(1, input[i]));
		if(s < 0)
			output[i] = s * 0x8000;
		else
			output[i] = s * 0x7FFF;
    }
	return output;
}

function Resampler(fromSampleRate, toSampleRate, channels, outputBufferSize, noReturn) {
	this.fromSampleRate = fromSampleRate;
	this.toSampleRate = toSampleRate;
	this.channels = channels | 0;
	this.outputBufferSize = outputBufferSize;
	this.noReturn = !!noReturn;
	this.initialize();
}
Resampler.prototype.initialize = function () {
	//Perform some checks:
	if (this.fromSampleRate > 0 && this.toSampleRate > 0 && this.channels > 0) {
		if (this.fromSampleRate == this.toSampleRate) {
			//Setup a resampler bypass:
			this.resampler = this.bypassResampler;		//Resampler just returns what was passed through.
			this.ratioWeight = 1;
		}
		else {
			if (this.fromSampleRate < this.toSampleRate) {
				/*
				 Use generic linear interpolation if upsampling,
				 as linear interpolation produces a gradient that we want
				 and works fine with two input sample points per output in this case.
				 */
				this.lastWeight = 1;
				this.resampler = this.compileLinearInterpolation;
			}
			else {
				/*
					Custom resampler I wrote that doesn"t skip samples
					like standard linear interpolation in high downsampling.
					This is more accurate than linear interpolation on downsampling.
				*/
				this.tailExists = false;
				this.lastWeight = 0;
				this.resampler = this.compileMultiTap;

			}
			this.ratioWeight = this.fromSampleRate / this.toSampleRate;
			this.initializeBuffers();
		}
	}
	else {
		throw(new Error("Invalid settings specified for the resampler."));
	}
};
Resampler.prototype.compileLinearInterpolation = function (buffer) {
	var bufferLength = buffer.length;
	var outLength = this.outputBufferSize;
	if ((bufferLength % this.channels ) == 0) {
		if (bufferLength > 0) {
			var ratioWeight = this.ratioWeight;
			var weight = this.lastWeight;
			var firstWeight = 0;
			var secondWeight = 0;
			var outputOffset = 0;
			var outputBuffer = this.outputBuffer;
            var channel;
			for (; weight < 1; weight += ratioWeight) {
				secondWeight = weight % 1;
				firstWeight = 1 - secondWeight;
				for ( channel = 0; channel < this.channels; ++channel) {
					outputBuffer[outputOffset++] = (this.lastOutput[channel] * firstWeight) + (buffer[channel] * secondWeight);
				}
			}
			weight --;
			for (bufferLength -= this.channels , sourceOffset = Math.floor(weight) * this.channels; outputOffset < outLength && sourceOffset < bufferLength;) {
				secondWeight = weight % 1;
				firstWeight = 1 - secondWeight;
				for ( channel = 0; channel < this.channels; ++channel) {
					outputBuffer[outputOffset++] = (buffer[sourceOffset + channel] * firstWeight) + (buffer[sourceOffset + this.channels + channel] * secondWeight);
				}
				weight += ratioWeight;
				sourceOffset = Math.floor(weight) * this.channels;
			}
			for ( channel = 0; channel < this.channels; ++channel) {
				this.lastOutput[channel] = buffer[sourceOffset++];
			}
			this.lastWeight = weight % 1;
			return this.bufferSlice(outputOffset);
		}
		else {
			return (this.noReturn) ? 0 : [];
		}
	}
	else {
		throw(new Error("Buffer was of incorrect sample length."));
	}
};
Resampler.prototype.compileMultiTap = function (buffer) {
	var output = [];
	var bufferLength = buffer.length;
	var outLength = this.outputBufferSize;
	if ((bufferLength %  this.channels ) == 0) {
		if (bufferLength > 0) {
			var ratioWeight = this.ratioWeight;
			var weight = 0;
			for (var channel = 0; channel < this.channels; ++channel) {
				output[channel]= 0;
			}
			var actualPosition = 0;
			var amountToNext = 0;
			var alreadyProcessedTail = !this.tailExists;
			this.tailExists = false;
			var outputBuffer = this.outputBuffer;
			var outputOffset = 0;
			var currentPosition = 0;
			do {
				if (alreadyProcessedTail) {
					weight = ratioWeight;
					for (channel = 0; channel < this.channels; ++channel) {
						output[channel]= 0;
					}
				}else {
					weight = this.lastWeight;
					for (channel = 0; channel < this.channels; ++channel) {
						output[channel] += this.lastOutput[channel];
					}
					alreadyProcessedTail = true;
				}
				while (weight > 0 && actualPosition < bufferLength) {
					amountToNext = 1 + actualPosition - currentPosition;
					if (weight >= amountToNext) {
						for (channel = 0; channel < this.channels; ++channel) {
							output[channel] += buffer[actualPosition++] * amountToNext;
						}
						currentPosition = actualPosition;
						weight -= amountToNext;
					}
					else {
						for (channel = 0; channel < this.channels; ++channel) {
							output[channel] += buffer[actualPosition + channel ] * weight;
						}
						currentPosition += weight;
						weight = 0;
						break;
					}
				}
				if (weight == 0) {
					for (channel = 0; channel < this.channels; ++channel) {
						outputBuffer[outputOffset++] = output[channel] / ratioWeight;
					}
				}
				else {
					this.lastWeight = weight;
					for (channel = 0; channel < this.channels; ++channel) {
						this.lastOutput[channel] = output[channel];
					}
					this.tailExists = true;
					break;
				}
			} while (actualPosition < bufferLength && outputOffset < outLength);
			return this.bufferSlice(outputOffset);
		}else {
			return (this.noReturn) ? 0 : [];
		}
	}else {
		throw(new Error("Buffer was of incorrect sample length."));
	}
};

Resampler.prototype.bypassResampler = function (buffer) {
	if (this.noReturn) {
		this.outputBuffer = buffer;
		return buffer.length;
	}
	else {
		return buffer;
	}
};

Resampler.prototype.bufferSlice = function (sliceAmount) {
	if (this.noReturn) {
		return sliceAmount;
	}
	else {
		try {
			return this.outputBuffer.subarray(0, sliceAmount);
		}
		catch (error) {
			try {
				this.outputBuffer.length = sliceAmount;
				return this.outputBuffer;
			}
			catch (error) {
				return this.outputBuffer.slice(0, sliceAmount);
			}
		}
	}
};

Resampler.prototype.initializeBuffers = function () {
	try {
		this.outputBuffer = new Float32Array(this.outputBufferSize);
		this.lastOutput = new Float32Array(this.channels);
	} catch (error) {
		this.outputBuffer = [];
		this.lastOutput = [];
	}
};