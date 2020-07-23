#!/usr/bin/env node

var partner_id = 'public'                          // ID provided by AB. 
var partner_key = '2jfaWErgt2+o48gsk302kd'         // Key provided by AB.
var expires = Math.floor(Date.now() / 1000) + 86400;  // Seconds since epoch. Example expires in 24 hours.
var user_id = '383485'                             // Partner defined. May be an empty string.
//
// Build the signature
//
var message = '' + expires;
if (user_id) {
    message += "\n" + user_id;
}
var crypto = require('crypto');
var signature = crypto.createHmac('SHA256', partner_key).update(message).digest('base64')
//
// package the signature, expiration, etc. into a URL encoded query string fragment
//
var queryString = '&partner.id=' + encodeURIComponent(partner_id) + '&auth.signature=' + encodeURIComponent(signature) + '&auth.expires=' + encodeURIComponent(expires);
if (user_id) {
    queryString += '&user.id=' + encodeURIComponent(user_id);
}

console.log("Authentication parameters: " + queryString);

var requester = require('sync-request');

var response;
var body;
try {
  response = requester('GET', 'https://api.abconnect.certicaconnect.com/rest/v4.1/standards?' + queryString);
  body = response.getBody('utf-8');
} catch (e) {
  console.log('' + e);
}
if (response) console.log("Response code: " + response.statusCode);
if (body) console.log("Response body:\n" + body);
