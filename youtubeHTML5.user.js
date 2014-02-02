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

// Takes a string representing a key->value map, and parses
// it, given the expected string separating key-value pairs,
// and the separator between each key and value.
// For example, JSON maps (stripped of their curly braces)
// would require pairSep = "," and kvSep = ":". 
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

// Returns the query string from a URL, including the
// initial '?'. 
var getQueryString = function (url) {
  var parser = document.createElement('a');
  parser.href = url;
  return parser.search;
};

// Reads the query ("search") part of a URL and converts
// it to a map.
var parseQueryString = function (queryString) {
  var trimmed = queryString.replace(/^\?/,"");
  return stringToMap(trimmed, "&", "=");
};

// Takes the query part of a URL and returns a JSON
// object containing the same information.
var getQueryMap = function(url) {
  return parseQueryString(getQueryString(url));
};

// Takes a JSON object (aMap) and returns a new JSON
// object with only the desired keys. 
var selectKeys = function (aMap, desiredKeys) {
  var result = {};
  for (var i = 0; i < desiredKeys.length; ++i) {
    var key = desiredKeys[i];
    if (aMap.hasOwnProperty(key)) {
      result[key] = aMap[key];
    }
  }
  return result;
};

// Takes a URL and modifies (or creates) the query part
// with data taken from queryMap.
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

// Takes an array of JSON objects, and returns only those
// objects whose with the desired value and a given key.
var pickMapsWithTag = function(arrayOfObjects, key, value) {
  return arrayOfObjects.filter(function (datum) { return datum[key] == value; });
};

// Copies a URL string, and, if its protocol is http,
// converts it to HTTPS.
var changeToHttps = function (url) {
  var parser = document.createElement('a');
  parser.href = url;
  if (parser.protocol === "http:") {
    parser.protocol = "https:";
  }
  return parser.href;
};

// Returns true iff the URL string uses the HTTPS protocol.
var isHttps = function (url) {
  var parser = document.createElement('a');
  parser.href = url;
  return parser.protocol === "https:";
};

// ### YouTube-specific functions for extracting a URL of an HTML5 video.

// Scrapes useful video location data and signatures from a YouTube page.
var scrapeVideoLocationData = function (bodyHTML) {
  // Location data can be found in JSON object literals inside an inline SCRIPT tag.
  var pattern = /\"url\_encoded\_fmt\_stream\_map\"\:\ \"(.*?)\"/,
      // A series of literal maps each corresponds to a way to request a different
      // format of the same video. 
      sources = bodyHTML.match(pattern)[1].split(",");
  // Read the data from these literal maps.
  return sources.map(function (source) { return stringToMap(source, "\\u0026", "="); });
};

// The list of keys needed for a URL that points to an HTML5 version
// of a YouTube video.
var HTML5_KEYS = ['expire','fexp','id','ip','ipbits','itag','key','ms',
                  'mt','mv','ratebypass','signature','source','sparams','sver','upn'];

// Scrape necessary data from the YouTube page to construct a URL
// that points to an HTML5 version of the video.
var extractHTML5VideoURL = function (bodyHTML) {
  var videoItem = pickMapsWithTag(scrapeVideoLocationData(bodyHTML), "itag", "43")[0],
      // The 'url' tag from videoItem contains most of the URL we need
      // for obtaining the HTML5 video. URL-decode the tag to get a pure
      // URL, and ensure it uses HTTPS.
      url = changeToHttps(decodeURIComponent(videoItem.url)),
      // Read the tags from this URL, in turn.
      tags = getQueryMap(url);
  // The sig tag is necessary to obtain the video. Key name changes
  // from sig to signature.
  tags.signature = videoItem.sig;
  // Return a URL that has just the tags we need and no others.
  return setQueryMap(url, selectKeys(tags, HTML5_KEYS));
};

// ### Functions that mutate the YouTube page's DOM to replace
// the default video with an HTML5 version.

// Remove the old flash/JS video presented by the YouTube page.
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
   // Ensure that video fills its parent div as much as possible.
   // If video is too short, we get the letterbox effect. If too
   // narrow, we get pillarboxing instead.
   video.style = "width: 100%; height: 100%;";
   return video;
};

// Embed the video element in the YouTube page.
var embedVideo = function (videoElement) {
  var newVideoBox = document.createElement('div');
  newVideoBox.appendChild(videoElement);
  newVideoBox.style = "background-color: black; position: absolute; top: 0; bottom: 0; left: 0; right: 0; z-index: 99;";
  // Place it in the old playerAPI box.
  var playerAPI = document.querySelector("div#player-api");
  playerAPI.style.position = "relative";
  playerAPI.appendChild(newVideoBox);
};

// ### The main function

// Alter the YouTube page to show its video without using any nonlocal JavaScript.
var noScriptYouTube = function() {
   // Let's always use HTTPS in this script, to be safer.
   // Redundant if user uses the HTTPSEverywhere plugin.
   if (!isHttps(location.href)) {
     location.href = changeToHttps(location.href);
   }
   var html5VideoURL = extractHTML5VideoURL(document.body.innerHTML);
   // If we are unable to extract the needed URL, then abort.
   if (html5VideoURL === null) { return; }
   // Swap old video for new HTML5 video.
   removeOldVideo();
   var video = createNewVideoElement(html5VideoURL);
   embedVideo(video);
   // Play the video immediately, just as YouTube does.
   video.play();
};

// Run the main function to immediately make YouTube page work without
// nonlocal JavaScript.
noScriptYouTube();
})();
