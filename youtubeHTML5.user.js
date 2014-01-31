// ==UserScript==
// @name        youtubeHTML5
// @namespace   arthuredelstein.com
// @description run html5 video on youtube
// @include     https://www.youtube.com/*
// @version     1
// @grant       none
// ==/UserScript==
/*(function () {*/
console.log("youtubeHTML5");
console.log(location.href);

var stringToMap = function (string, pairSep, kvSep) {
  var pairs = string.split(pairSep).map(function (kv) {
    return kv.split(kvSep);
  });
  var result = {};
  for (var i = 0; i < pairs.length; ++i) {
    var pair = pairs[i];
    result[pair[0]] = pair[1];
  }
  return result;  
};

var parseQueryString = function (queryString) {
  var trimmed = queryString.replace(/^\?/,"");
  return stringToMap(trimmed, "&", "=");
};

var getQueryString = function (url) {
  var parser = document.createElement('a');
  parser.href = url;
  return parser.search;
};

var getQueryMap = function(url) {
  return parseQueryString(getQueryString(url));
};

var selectKeys = function (aMap, keys) {
  var result = {};
  for (var i = 0; i < keys.length; ++i) {
    var key = keys[i];
    if (aMap.hasOwnProperty(key)) {
      result[key] = aMap[key];
    }
  }
  return result;
};

var setQueryMap = function(url, queryMap) {
  var parser = document.createElement('a'),
      queryString = "?";
  parser.href = url;
  for (var key in queryMap) {
    queryString += key + "=" + queryMap[key] + "&";
  }
  parser.search = queryString;
  return parser.href;
};

var getUsefulData = function () {
  var pattern = /\"url\_encoded\_fmt\_stream\_map\"\:\ \"(.*?)\"/,
      sources = document.body.innerHTML.match(pattern)[1].split(",");
  return sources.map(function (source) { return stringToMap(source, "\\u0026", "="); });
};

var pickMapsWithTag = function(arrayOfObjects, key, value) {
  return arrayOfObjects.filter(function (datum) { return datum[key] == value; });
};

var HTML5_KEYS = ['expire','fexp','id','ip','ipbits','itag','key','ms','mt','mv','ratebypass',
                  'signature','source','sparams','sver','upn'];

var acquireHTML5VideoURL = function() {
  var videoItem = pickMapsWithTag(getUsefulData(), "itag", "43")[0],
      url = decodeURIComponent(videoItem.url),
      tags = getQueryMap(url);
  tags.signature = videoItem.sig;
  return setQueryMap(url, selectKeys(tags, HTML5_KEYS));
};

var noScriptYouTube = function() {
   var html5VideoURL = acquireHTML5VideoURL();
   console.log(html5VideoURL);
   var oldVideoElement = document.querySelector("video"),
       videoBox = document.querySelector("div#movie_player"),
       playerAPI = document.querySelector("div#player-api");
   // Stop and destroy old video
   oldVideoElement.src = ""
   // Hide the containing box and controls.
   videoBox.style.visibility = "hidden";
   // Now make a new video element with controls.
   var video = document.createElement('video');
   video.src = html5VideoURL;
   video.controls = true;
   // Enclose new video in a div.
   var newVideoBox = document.createElement('div');
   newVideoBox.appendChild(video);
   newVideoBox.style = "background-color: white; position: absolute; top: 0; bottom: 0; left: 0; z-index: 99;";
   // Place it in the old playerAPI box.
   playerAPI.style.position = "relative";
   playerAPI.appendChild(newVideoBox);
   // Play it!
   video.play();
};

noScriptYouTube();
//})();



