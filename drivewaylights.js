var relay=null;
var tessel = require('tessel');
var relaylib=require('relay-mono');
var relay = relaylib.use(tessel.port['B']);

var http = require('http');
var https=require('https');

var googleKey='AIzaSyDia5A5iUs6Me8NI8V_S4_qUj-KR-uWxxs'; 
var delayTime = 5*60*1000;

var simMode = false; 
var debugmode = false; 
var currDate = new Date(); 

var dictLatLng = {};
var dictSunriseSunset={};

function city(name, UTCoffset)
{
	this.name = name; 
	this.UTCoffset = UTCoffset;
	this.sleephours = 22;
	this.sleepmin = 30;
	this.sleepsec=0; 
}
var city1 = new city("Seattle",-8*60*60*1000); 

function getApiData(url, callback, errorCallback)
{
	var httpObject = http; 
	if (url.indexOf("https:")!=-1)
		httpObject=https;	
    var req = httpObject.get(url, function(res) {
  	var pageData = "";
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      pageData += chunk;
    });

    res.on('end', function(){
    	var jsonres = JSON.parse(pageData);
    	callback(jsonres); 
    });

  }).on('error',function(error) 
  	{
  		errorCallback(error)
  	});
}
function setSunsetSunrise(result)
{
		city1.sunrise = result.results.sunrise;
    	city1.sunset = result.results.sunset;
    	dictSunriseSunset[calcToday()] = result;
    	checkTime(); 

}
function checkTime()
{
	var todaySunset = new Date(city1.sunset);
	setTimeout(function()
	{
		stringDebug("Sunset: "+ todaySunset);
		stringDebug("Current Time: " + currDate)
		if(relay)
		{
			relay.currTime = currDate;
		}
		makeEndTime();
		stringDebug("Todays endtime " + city1.endTime);
		if( (currDate.getTime() >= todaySunset.getTime()) && (currDate.getTime() <= city1.endTime))
		{
			console.log("turn the lights on"); 
			if(relay)
			{
				relay.turnOn(2,0,function(err)
				{
					if(err)
						console.log("there is a error of type " + err);
				})
			}
		}
		else
		{
			console.log("the lights should be off");
			if(relay)
			{
				relay.turnOff(2,0,function(err)
				{
					if(err)
						console.log("there is a error of type " + err);
				})
			}
		}
		turnOnLights();
	},delayTime)

}
function setLatLong(result)
{
	city1.lat=result.results[0].geometry.location.lat;
	city1.lng=result.results[0].geometry.location.lng;
	dictLatLng[city1.name] = result;
	getSunsetSunrise(setSunsetSunrise,sunriseSunsentError); 	
}
function getLatLong(callback,errorCallback)
{
	if(dictLatLng[city1.name] == null)
	{
		if(simMode)
		{
			stringDebug("Called API for Lat long");
		}
		var url = "https://maps.googleapis.com/maps/api/geocode/json?address="+city1.name.replace(" ","+") + "&key=" + googleKey;
		return getApiData(url,callback,errorCallback);
	}
	else 
	{
		return callback(dictLatLng[city1.name]);
	}
}
function stringDebug(str)
{
	if(debugmode)
	{
		console.log("Debug log: " + str);
	}
}
function calcToday(currDate)
{
	var adjustedDate = UTCtoCity(currDate);
	var today = adjustedDate.getFullYear()+"-"+(adjustedDate.getMonth()+1)+"-"+adjustedDate.getDate();
	return today; 
}
function getSunsetSunrise(callback,errorCallback)
{
	var today = calcToday();
	if(dictSunriseSunset[today] == null)
	{
		if(simMode)
		{
			stringDebug("Called API for sunrise sunset");
		}
		var url = "http://api.sunrise-sunset.org/json?lat="+city1.lat+"&lng="+city1.lng+"&date="+today+"&formatted=0"; 
		return getApiData(url,callback,errorCallback);
	}
	else 
	{
		callback(dictSunriseSunset[today]);
	}

}
function printError(error)
{
	console.log(error); 
}
function latLongError(error)
{
	printError(error); 
	city1.lat = 47.59978;
	city1.lng = -122.3346;
}
function sunriseSunsentError(error)
{
	printError(error); 
	city1.sunset= "3:00:00 AM";
	city1.sunrise= "3:00:00 PM";
}
function turnOnLights()
{
	if(simMode)
	{
		currDate.setTime(currDate.getTime() + 60*60*1000*1);
	}
	else 
	{
		currDate = new Date();
	}
	
	getLatLong(setLatLong,latLongError);
}	
function makeEndTime()
{
	
	city1.endTime = UTCtoCity(currDate);
	city1.endTime.setHours(city1.sleephours);
	city1.endTime.setMinutes(city1.sleepmin);
	city1.endTime.setSeconds(city1.sleepsec);
	city1.endTime = CitytoUTC(city1.endTime); 

}
function UTCtoCity(time)
{
	var x = new Date();
	x.setTime(currDate.getTime()+ city1.UTCoffset+currDate.getTimezoneOffset()*60*1000);
	return x; 
}
function CitytoUTC(time)
{
	var x = new Date();
	x.setTime(time.getTime() - city1.UTCoffset-currDate.getTimezoneOffset()*60*1000);
	return x; 
}
try
{
	turnOnLights();
}
catch(e)
{
	console.log("Unhandled Exception "+ e + " , resetting board");
	if(relay)
	{
		tessel.reset_board();
	}
}
if(relay)
{
	relay.on('latch', function (channel, value)
	{
		console.log("latched to "+ channel + value + "at" + relay.currTime); 
	})
}