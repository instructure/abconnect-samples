// ABTools.js
// ========
var RETRY = 5000; // delay to retry requests
var TIMEOUT = 200000;
var DELAY_INC = 10; // give us 10 milliseconds between each call
var gDelay = 0; // initial delay
var _arguments;
var _logger;
var _client;
var _dumpError;
var _spaceRequests;
var _dumpResponse;
var _fatalError;
var _assert;
const POST = 'POST';
const PATCH = 'PATCH';
const DELETE = 'DELETE';
const GET = 'GET';

module.exports = {
arguments: function(){return _arguments},
LOGGER: function(){return _logger},
client: function(){return _client},
POST: POST,
PATCH: PATCH,
DELETE: DELETE,
GET: GET,

init: function() { // initialize the object
  _assert = require('assert');
  _arguments = require('commander');
  _logger = require('winston');
  _logger.level = 'info';
  var Client = require('node-rest-client').Client;
  _client = new Client();
  
  _dumpError = this.DumpError;
  _spaceRequests = this.SpaceRequests;
  _dumpResponse = this.DumpResponse;
  _fatalError = this.FatalError;
},
//
// SpaceRequests - make a request to the server after a delay
//  method - the request method
//  restArgs - an object to pass to the node-rest-client.  Note we merge timeout values into it.
//  URL - the URL of the action
//  callback - the function to callback
//  callbackArgs - an array of arguments to pass to the callback - typically the first argument is a unique ID for the request
//
SpaceRequests: function(method, restArgs, URL, callback, callbackArgs) {
  _logger.debug("Delay: " + gDelay);
  setTimeout(_sendRequest, gDelay, method, restArgs, URL, callback, callbackArgs);
  gDelay += DELAY_INC;
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
//
// _sendRequest - make a request - do nothing else
//    method - method of call being made: POST, GET, etc.  Only POST and GET are supported right now
//    restArgs - an object to pass to the node-rest-client.  Note we merge timeout values into it.
//    URL - the URL of the call
//    callback - the function to callback
//    callbackArgs - an array of arguments to pass to the callback - typically the first argument is a unique ID for the request
//
function _sendRequest(method, restArgs, URL, callback, callbackArgs) {
  _logger.debug("URL: " + URL);
  //
  // merge node rest client configurations
  //
  restArgs = Object.assign(restArgs, {
      requesConfig: { timeout: TIMEOUT },
      responseConfig: { timeout: TIMEOUT }
      });
      
  try {
    if (method === GET) {
      _client
        .get(URL, restArgs, function (data, response) {callback(data, response, callbackArgs)})
        .on('error', function (error) {_receiveError(error, _spaceRequests, method, restArgs, URL, callback, callbackArgs)});
    } else if (method === POST) {
      
      _client
        .post(URL, restArgs, function (data, response) {callback(data, response, callbackArgs)})
        .on('error', function (error) {_receiveError(error, _spaceRequests, method, restArgs, URL, callback, callbackArgs)});
        
    } else if (method === PATCH) {

      _client
        .patch(URL, restArgs, function (data, response) {callback(data, response, callbackArgs)})
        .on('error', function (error) {_receiveError(error, _spaceRequests, method, restArgs, URL, callback, callbackArgs)});
        
    } else if (method === DELETE) {

      _client
        .delete(URL, restArgs, function (data, response) {callback(data, response, callbackArgs)})
        .on('error', function (error) {_receiveError(error, _spaceRequests, method, restArgs, URL, callback, callbackArgs)});
        
    } else {
      _assert(false, 'ABTools only supports GET, POST, PATCH and DELETE methods.');
    }
  }
  catch (error) {
    _fatalError("A fatal error occurred calling the AB server. \n" + URL + "\n Error: " + error.message);
  }
}
//
// _receiveError - process the error response
//    error - the error object
//    recoverFunction - function to call to recover
//    method - method of call being made: POST, GET, etc.  Only POST and GET are supported right now
//    restArgs - an object to pass to the node-rest-client.  Note we merge timeout values into it.
//    URL - the URL of the call
//    callback - the function to callback
//    callbackArgs - an array of arguments to pass to the callback - typically the first argument is a unique ID for the request
//
function _receiveError(error, recoverFunction, method, restArgs, URL, callback, callbackArgs) {
  //
  // server overload - retry
  //
  if (error.code === 'ETIMEDOUT' ||
    error.code === 'ECONNRESET') {
    //
    // retry after a delay
    //
    _logger.debug("Received a " + error.code + ". Trying again.");
    recoverFunction(method, restArgs, URL, callback, callbackArgs);
    return;
  //
  // other error - abort
  //
  } else {
    _dumpError(error);
    _fatalError("REST call error. " + error);
  }
}