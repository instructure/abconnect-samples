// ABtools.js
// ========
var RETRY = 5000; // delay to retry requests
var TIMEOUT = 200000;
var DELAY_INC = 10; // give us 10 milliseconds between each call
var gDelay = 0; // initial delay
var _assert;
var _arguments;
var _logger;
var _client;
var _receiveError;
var _dumpError;
var _spaceRequests;
var _getRequest;
var _dumpResponse;
var _fatalError;

module.exports = {
ASSERT: function(){return _assert},
arguments: function(){return _arguments},
LOGGER: function(){return _logger},
client: function(){return _client},

init: function() { // initialize the object
  _assert = require('assert');
  _arguments = require('commander');
  _logger = require('winston');
  _logger.level = 'info';
  var Client = require('node-rest-client').Client;
  _client = new Client();
  
  _receiveError = this.ReceiveError;
  _dumpError = this.DumpError;
  _spaceRequests = this.SpaceRequests;
  _getRequest = this.GetRequest;
  _dumpResponse = this.DumpResponse;
  _fatalError = this.FatalError;
},
//
// SpaceRequests - make a GET request after a delay
//  URL - the URL of the GET
//  callback - the function to callback
//  listArgs - an array of arguments to pass to the callback - typically the first argument is a unique ID for the request
//
SpaceRequests: function(URL, callback, listArgs) {
  _logger.debug("Delay: " + gDelay);
  setTimeout(_getRequest, gDelay, URL, callback, listArgs);
  gDelay += DELAY_INC;
},
//
// GetRequest - make a GET request - do nothing else
//  URL - the URL of the GET
//  callback - the function to callback
//  listArgs - an array of arguments to pass to the callback - typically the first argument is a unique ID for the request
//
GetRequest: function(URL, callback, listArgs) {
  _logger.debug("URL: " + URL);
  try {
    _client
      .get(URL, {
      requesConfig: { timeout: TIMEOUT },
      responseConfig: { timeout: TIMEOUT }
      }, function (data, response) {callback(data, response, listArgs)})
      .on('error', function (error) {_receiveError(error, callback, URL, listArgs)});
  }
  catch (error) {
    _fatalError("A fatal error occurred calling the AB server. \n" + URL + "\n Error: " + error.message);
  }
},
//
// ReceiveError - process the error response
//  error - the error object
//  callback - the function to callback
//  URL - the original URL being called
//  listArgs - an array of arguments to pass to the callback - typically the first argument is a unique ID for the request
//
ReceiveError: function(error, callback, URL, listArgs) {
  //
  // server overload - retry
  //
  if (error.code === 'ETIMEDOUT' ||
    error.code === 'ECONNRESET') {
    //
    // retry after a delay
    //
    _logger.debug("Received a " + error.code + " when getting ID " + listArgs[0] + ". Trying again.");
    _spaceRequests(URL, callback, listArgs);
    return;
  //
  // other error - abort
  //
  } else {
    _dumpError(error);
    _fatalError("REST call error. " + error);
  }
},
//
// DumpResponse - Used for attempting to pick apart the lightly documented response object to determine if there is something helpful
// in the defintion for use in debugging and trouble shooting.
//
DumpResponse: function (response) {
  for (var prop in response) {
    var hasOwn = '';
    if (response.req.hasOwnProperty(prop)) {
      hasOwn = ' *';
    }
    _logger.error("Response: response." + prop + hasOwn);
  }
  _logger.error("Path: " + response.req.path);
  _logger.error("URL: " + response.url);
  _logger.error("Status: " + response.statusCode);
},
//
// DumpError - Used for attempting to pick apart the lightly documented Node Rest Client error object to determine if there is something helpful
// in the defintion for use in debugging and trouble shooting.
// error.request.options.path
//
DumpError: function (error) {
  for (var prop in error) {
    var hasOwn = '';
    if (error.hasOwnProperty(prop)) {
      hasOwn = '* ';
    }
    _logger.error("Error: error." + prop + hasOwn + "=" + error[prop]);
  }
  for (var prop in error.request) {
    var hasOwn = '';
    if (error.request.hasOwnProperty(prop)) {
      hasOwn = '* ';
    }
    try {
      if (typeof error.request[prop] === 'function') {
        _logger.error("error.request." + prop + hasOwn + "=[function]");        
      } else {
        _logger.error("error.request." + prop + hasOwn + "=" + error.request[prop]);
      }
    }
    catch (e) {
      _logger.error("error.request." + prop + hasOwn + "=[circular object reference]: " + e);
    }
  }
  for (var prop in error.request.options) {
    var hasOwn = '';
    if (error.request.options.hasOwnProperty(prop)) {
      hasOwn = '* ';
    }
    try {
      if (typeof error.request.options[prop] === 'function') {
        _logger.error("error.request.options." + prop + hasOwn + "=[function]");        
      } else {
        _logger.error("error.request.options." + prop + hasOwn + "=" + error.request.options[prop]);
      }
    }
    catch (e) {
      _logger.error("error.request.options." + prop + hasOwn + "=[circular object reference]: " + e);
    }
  }
},
//
// FatalError - log a fatal error, email the audience so they know something happened, then exit
//
// message - the error details
//
FatalError: function (message) {
  _logger.error(message);
  process.exit();
}
};