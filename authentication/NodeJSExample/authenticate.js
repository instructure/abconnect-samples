#!/usr/bin/env node

var partner_id = 'public'                          // ID provided by AB. 
var partner_key = '2jfaWErgt2+o48gsk302kd'         // Key provided by AB.
var expires = Math.floor(Date.now() / 1000) + 86400;  // Seconds since epoch. Example expires in 24 hours.
var user_id = '383485'                             // Partner defined. May be an empty string.
//
// Build the signature
//
var message = '' + expires + "\n";
if (user_id) {
    message += user_id;
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

console.log(queryString);
