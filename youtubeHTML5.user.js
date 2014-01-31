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

var getQueryString = function (url) {
  var parser = document.createElement('a');
  parser.href = url;
  return parser.search;
};

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
  var parser = document.createElement('a');
  parser.href = url;
  var queryString = "?";
  for (var key in queryMap) {
    queryString += key + "=" + queryMap[key] + "&";
  }
  parser.search = queryString;
  return parser.href;
};

var HTML5_KEYS = ['expire','fexp','id','ip','ipbits','itag','key','ms','mt','mv','ratebypass',
                  'signature','source','sparams','sver','upn'];

var getUsefulData = function () {
  var pattern = /\"url\_encoded\_fmt\_stream\_map\"\:\ \"(.*?)\"/;
  var sources = document.body.innerHTML.match(pattern)[1].split(",");
  return sources.map(function (source) { return stringToMap(source, "\\u0026", "="); });
};

var pickFirstMapWithTag = function(usefulData, key, value) {
  return usefulData.filter(function (datum) { return datum[key] == value; })[0];
};

var videoClue = pickFirstMapWithTag(getUsefulData(), "itag", "43");
var url = decodeURIComponent(videoClue.url);
var tags = getQueryMap(url);
tags.signature = videoClue.sig;
var finalURL = setQueryMap(url, selectKeys(tags, HTML5_KEYS));
console.log(finalURL);


//})();



