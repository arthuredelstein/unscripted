// ==UserScript==
// @name        youtubeHTML5
// @namespace   arthuredelstein.com
// @description run html5 video on youtube
// @include     https://www.youtube.com/*
// @include     http://www.youtube.com/*
// @version     1
// @grant       none
// ==/UserScript==
(function () {

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

var pickMapsWithTag = function(arrayOfObjects, key, value) {
  return arrayOfObjects.filter(function (datum) { return datum[key] == value; });
};

var changeToHttps = function (url) {
  var parser = document.createElement('a');
  parser.href = url;
  if (parser.protocol === "http:") {
    parser.protocol = "https:";
  }
  return parser.href;
};

var isHttps = function (url) {
  var parser = document.createElement('a');
  parser.href = url;
  return parser.protocol === "https:";
};

var getUsefulData = function (bodyHTML) {
  var pattern = /\"url\_encoded\_fmt\_stream\_map\"\:\ \"(.*?)\"/,
      sources = bodyHTML.match(pattern)[1].split(",");
  return sources.map(function (source) { return stringToMap(source, "\\u0026", "="); });
};

var HTML5_KEYS = ['expire','fexp','id','ip','ipbits','itag','key','ms','mt','mv','ratebypass',
                  'signature','source','sparams','sver','upn'];

var extractHTML5VideoURL = function (bodyHTML) {
  var videoItem = pickMapsWithTag(getUsefulData(bodyHTML), "itag", "43")[0],
      url = changeToHttps(decodeURIComponent(videoItem.url)),
      tags = getQueryMap(url);
  tags.signature = videoItem.sig;
  return setQueryMap(url, selectKeys(tags, HTML5_KEYS));
};

var removeOldVideo = function () {
   var oldVideoElement = document.querySelector("video"),
       videoBox = document.querySelector("div#movie_player");
   // Stop and destroy old video
   if (oldVideoElement !== null) {
     oldVideoElement.src = ""
   }
   if (videoBox !== null) {
     // Hide the containing box and controls.
     videoBox.style.visibility = "hidden";
   }
};

// Make a new video element with controls.
var createNewVideoElement = function(html5VideoURL) {
   var video = document.createElement('video');
   video.src = html5VideoURL;
   video.controls = "controls";
   video.style = "width: 100%; height: 100%;";
   return video;
};

var embedVideo = function (videoElement) {
  var newVideoBox = document.createElement('div');
  newVideoBox.appendChild(videoElement);
  newVideoBox.style = "background-color: black; position: absolute; top: 0; bottom: 0; left: 0; right: 0; z-index: 99;";
  // Place it in the old playerAPI box.
  var playerAPI = document.querySelector("div#player-api");
  playerAPI.style.position = "relative";
  playerAPI.appendChild(newVideoBox);
};

var noScriptYouTube = function() {
   if (!isHttps(location.href)) {
     location.href = changeToHttps(location.href);
   }
   var html5VideoURL = extractHTML5VideoURL(document.body.innerHTML);
   if (html5VideoURL === null) {
     return;
   }
   removeOldVideo();
   var video = createNewVideoElement(html5VideoURL);
   embedVideo(video);
   // Play it!
   video.play();
};

noScriptYouTube();
})();
