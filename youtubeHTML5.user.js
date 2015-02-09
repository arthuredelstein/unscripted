// # Unscripted

// by Arthur Edelstein, 2014. [BSD 3-Clause License.](http://opensource.org/licenses/BSD-3-Clause)

// This user-script for Firefox's [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) extension
// lets you use popular web pages, even if Flash and the page's JavaScript is disabled.
// Supported sites include:
// - youtube.com
// - baidu.com
// - twitter.com (in progress)
// - guardian.com
// - washingtonpost.com
// I hope this script is useful for the Tor Browser Bundle, where it is safest to turn off JavaScript.

// This script can be [installed from UserScripts.org](http://userscripts.org/scripts/show/308677)
// or [downloaded from github](https://github.com/arthuredelstein/unscripted).

// First, the UserScript preamble.

// <pre>
// ==UserScript==
// @name        youtubeHTML5
// @namespace   arthuredelstein.com
// @description run html5 video on youtube
// @include     http://www.youtube.com/*
// @include     https://www.youtube.com/*
// @include     http://twitter.com/*
// @include     https://twitter.com/*
// @include     http://*.twitter.com/*
// @include     https://*.twitter.com/*
// @include     http://*.baidu.com/*
// @include     https://*.baidu.com/*
// @include     http://*.sina.com.cn/*
// @include     https://*.sina.com.cn/*
// @include     http://*.ebay.com/*
// @include     https://*.ebay.com/*
// @include     http://*.washingtonpost.com/*
// @include     https://*.washingtonpost.com/*
// @include     http://*.theguardian.com/*
// @include     https://*.theguardian.com/*
// @include     http://*.democracynow.org/*
// @include     https://*.democracynow.org/*
// @version     1
// @grant       GM_xmlhttpRequest
// ==/UserScript==
// </pre>

/*jshint multistr: true */
/*jshint esnext: true */

// Enclose all in a function to avoid polluting the
// global namespace.
(function () {
"use strict";

// ### Utility functions (all referentially transparent)

// Takes a string representing a key->value map, and parses
// it, given the expected string separating key-value pairs,
// and the separator between each key and value.
// For example, JSON maps (stripped of their curly braces)
// would require pairSep = "," and kvSep = ":".
let stringToMap = function (string, pairSep, kvSep) {
  let pairs = string.split(pairSep).map(function (kv) {
    return kv.split(kvSep);
  });
  let result = {};
  for (let i = 0; i < pairs.length; ++i) {
    let pair = pairs[i];
    result[pair[0]] = pair[1];
  }
  return result;
};

// Returns the query string from a URL, including the
// initial '?'.
let getQueryString = function (url) {
  let parser = document.createElement('a');
  parser.href = url;
  return parser.search;
};

// Reads the query ("search") part of a URL and converts
// it to a map.
let parseQueryString = function (queryString) {
  let trimmed = queryString.replace(/^\?/,"");
  return stringToMap(trimmed, "&", "=");
};

// Takes the query part of a URL and returns a JSON
// object containing the same information.
let getQueryMap = function(url) {
  return parseQueryString(getQueryString(url));
};

// Takes a URL and modifies (or creates) the query part
// with data taken from queryMap.
let setQueryMap = function(url, queryMap) {
  let parser = document.createElement('a'),
      queryString = "?";
  parser.href = url;
  for (let key in queryMap) {
    queryString += key + "=" + queryMap[key] + "&";
  }
  parser.search = queryString;
  return parser.href;
};

// Takes an array of JSON objects, and returns only those
// objects whose with the desired value and a given key.
let pickMapsWithTag = function(arrayOfObjects, key, value) {
  return arrayOfObjects.filter(function (datum) { return datum[key] == value; });
};

// Copies a URL string, and, if its protocol is http,
// converts it to HTTPS.
let changeToHttps = function (url) {
  let parser = document.createElement('a');
  parser.href = url;
  if (parser.protocol === "http:") {
    parser.protocol = "https:";
  }
  return parser.href;
};

// Returns true iff the URL string uses the HTTPS protocol.
let isHttps = function (url) {
  let parser = document.createElement('a');
  parser.href = url;
  return parser.protocol === "https:";
};

// ### Mutating web pages.

// Restore images, links, or other elements that ordinarily need JavaScript to
// work correctly.                                                                                                                     

let restoreAttribute = function (thumbnailSelector, sourceAttribute, targetAttribute) {
  Array.prototype.forEach.call(document.querySelectorAll(thumbnailSelector), element => {
    if (element.hasAttribute(sourceAttribute)) {
      element.setAttribute(targetAttribute, element.getAttribute(sourceAttribute));
    }
  });
};

// ### Baidu, Washington Post, Weibo
let imgDataSrc = function () {
  restoreAttribute('img', 'data-src', 'src');
};

// ### Flickr (dead)

//let flickr = function () {
//  restoreAttribute('img.defer', 'data-defer-src', 'src');
//};

// ### Twitter (incomplete)
// TODO: Get this working for various kinds of streams (login, person, search, etc)
let twitter_cleanup = function() {
  restoreAttribute("a.twitter-timeline-link", "data-expanded-url", "href");
  restoreAttribute("a.twitter-timeline-link", "data-resolved-url-large", "href");
};

let twitter_footer = function () {
  let itemList = document.querySelector("div.GridTimeline-items"),
      lastItemID = itemList.getAttribute("data-max-id"),
      nextItemsURL = "https://twitter.com/i/profiles/show/NickKristof/timeline?max_id=" + lastItemID;
  GM_xmlhttpRequest({
    method: "GET",
    url: nextItemsURL,
    onload: function (response) {
      itemList.insertAdjacentHTML('beforeend', JSON.parse(response.responseText).items_html);
      twitter_cleanup();
    }
  });
};

let twitter = function () {
  twitter_cleanup();
  twitter_footer();
};

// ### YouTube
// For extracting a URL of an HTML5 video.

// Scrapes useful video location data and signatures from a YouTube page.
let scrapeVideoLocationData = function (bodyHTML) {
  // Location data can be found in JSON object literals inside an inline SCRIPT tag.
  let pattern = /\"url\_encoded\_fmt\_stream\_map\"\:\ ?\"(.*?)\"/,
      // A series of literal maps each corresponds to a way to request a different
      // format of the same video.
      sources = bodyHTML.match(pattern)[1].split(",");
  // Read the data from these literal maps.
  return sources.map(function (source) { return stringToMap(source, "\\u0026", "="); });
};

// Scrape necessary data from the YouTube page to construct a URL
// that points to an HTML5 version of the video.
let extractHTML5VideoURL = function (bodyHTML) {
  let chosenVideoItem = pickMapsWithTag(scrapeVideoLocationData(bodyHTML), "itag", "43")[0],
      // The 'url' tag from chosenVideoItem contains most of the URL we need
      // for obtaining the HTML5 video. URL-decode the tag to get a pure
      // URL, and ensure it uses HTTPS.
      url = changeToHttps(decodeURIComponent(chosenVideoItem.url)),
      // Read the tags from this URL, in turn.
      tags = getQueryMap(url);
  // The signature / sig tag is necessary to obtain the video.
  tags.signature = tags.signature || chosenVideoItem.signature || chosenVideoItem.sig;
  // Return a URL that has the full complement of tags.
  return setQueryMap(url, tags);
};

// ### Mutating the YouTube page.

// Embed the video element in the YouTube page and return a reference to it.
let embedVideo = function (html5VideoURL) {
  // Place it in the old playerAPI box.
  let playerAPI = document.querySelector("div#player-api");
  playerAPI.style.position = "relative";
  playerAPI.innerHTML = '<div style="background-color: black; position: absolute; top: 0; bottom: 0; left: 0; right: 0; z-index: 99;"> \
                        <video id="unscripted" src="' + html5VideoURL + '" style="width: 100%; height: 100%" controls></video> \
                        </div>';
  return document.querySelector('video#unscripted');
};

// ### The main function

// Alter the YouTube page to show its video without needing the page's JavaScript.
let youtube = function() {
   // Let's always use HTTPS in this script, to be safer.
   // Redundant if user uses the HTTPSEverywhere plugin.
   if (!isHttps(location.href)) {
     location.href = changeToHttps(location.href);
   }
   try {
     let html5VideoURL = extractHTML5VideoURL(document.body.innerHTML);
     // Swap old video for new HTML5 video.
     let video = embedVideo(html5VideoURL);
     // Play the video immediately, just as YouTube does.
     video.play();
   } catch (e) {
     console.log(e);
     // Never mind.
   }
   restoreAttribute('img', 'data-thumb', 'src');
};

let guardian = function() {
  Array.prototype.forEach.call(document.querySelectorAll('div[data-src]'), function (element) {
    let src = element.getAttribute('data-src'),
        srcFixed = src.replace('{width}', element.clientWidth),
        img = document.createElement('img');
    img.src = srcFixed;
    img.setAttribute('class', 'responsive-image');
    element.appendChild(img);    
  });
};

let democracyNow = function () {
  // Hide an ugly no javascript warning.
  document.querySelector("div#player_not_available").hidden = true;
  // Read the video settings, which contain the video URL and start time.
  let videoSettings = JSON.parse(document.querySelector("div#video_player script.settings").innerHTML),
      src = videoSettings.file + "#t=" + videoSettings.start,
      videoPlayer = document.querySelector("div#video_player"),
      video = document.createElement('video');
  video.src = src;
  video.width = "100%";
  video.height = "100%";
  videoPlayer.insertBefore(video, videoPlayer.firstChild);
};

// Run the main function to immediately bring web page to heel.

if (location.href.contains('youtube.com')) {
  youtube();
}
if (location.href.contains('baidu.com')) {
  imgDataSrc();
}
if (location.href.contains('washingtonpost.com')) {
  imgDataSrc();
}
//if (location.href.contains('flickr.com')) {
//  flickr();
//}
if (location.href.contains('twitter.com')) {
  twitter();
}
if (location.href.contains('guardian.com')) {
  guardian();
}
if (location.href.contains('sina.com.cn')) {
  imgDataSrc();
  restoreAttribute('img', 'real_src', 'src');  
}
if (location.href.contains('ebay.com')) {
  imgDataSrc();
  document.querySelector("noscript.nojs").innerHTML = "";
}
if (location.href.contains('democracynow.org')) {
  democracyNow();
}
// Terminate enclosing function.
})();
