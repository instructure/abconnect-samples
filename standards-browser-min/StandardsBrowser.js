const HOST = 'https://api.academicbenchmarks.com'
const STANDARDS_URL = HOST + "/rest/v4/standards";
const TOPICS_URL = HOST + "/rest/v4/topics";
const RETRY_LIMIT=5;
const RETRY_LAG=200;

var gPartnerID = null;
var gSignature = null;
var gAuthExpires = null;
var gTopicsLicensed = false;

// Pull in a file that could be used to pre-populate fields.
var imported = document.createElement('script');
imported.src = '../fieldDefaults.js';
document.head.appendChild(imported);

jQuery.support.cors = true;
//
// authenticate - build the required credentials and load the page
//
function authenticate() {
  gPartnerID = $('.partnerID').val().trim();
  var partnerKey = $('.partnerKey').val().trim();
  
  if (gPartnerID.length === 0 || // we are still missing something
    partnerKey.length === 0) {
    return;
  }
  //
  // reset the license levels - we do this here so we pickup the proper settings when someone changes the user account
  //
  gTopicsLicensed = false;

  gAuthExpires = Math.floor(Date.now() / 1000) + 3600; // 1 hour lifespan (in seconds) note that "gAuthExpires" is in seconds, not milliseconds
  //
  // Build the signature
  //
  var message = '' + gAuthExpires + "\n\nGET";
  //
  // Build the token
  //
  var hash = CryptoJS.HmacSHA256(message, partnerKey);
  gSignature = CryptoJS.enc.Base64.stringify(hash);
  
  checkTopicsLicenseLevel();
}
//
// checkTopicsLicenseLevel - see if we can request concepts/topics
//
function checkTopicsLicenseLevel() {
  //
  // hit the topics endpoint - if you get a 401, you are not licensed for topics or concepts (or possibly don't have a valid ID/key - but either way, let's drop topics and concepts)
  //
  var topicURL = TOPICS_URL + '?limit=0&facet_summary=_none' + authenticationParameters();
  //
  // request the data
  //
  $.ajax( 
    { 
      url: topicURL,
      crossDomain: true, 
      dataType: 'json', 
      tryCount: 0, 
      retryLimit: RETRY_LIMIT,
      success: function(data,status)
        {
          gTopicsLicensed = true; // note we can use topics
          init();
        },
      error: function(xhr, status, error) 
        { 
        switch (xhr.status) {
          case 401: // authorization error - let's figure out what kind
            if (xhr.responseJSON.errors && 
                xhr.responseJSON.errors[0].detail) {
                  
              if (xhr.responseJSON.errors[0].detail === 'Signature is not authorized.') {
                alert('Invalid partner ID or key.');
              } else if (xhr.responseJSON.errors[0].detail === 'This account is not licensed to access Topics') { // not going to do the Topic thing
                init();
              } else alert(`Unexpected error: ${xhr.responseText}`);
            } else alert(`Unexpected error: ${xhr.responseText}`);
            break;
          case 503: // various resource issues
          case 504: 
          case 408: 
          case 429: 
            this.tryCount++; 
            if (this.tryCount <= this.retryLimit) { //try again 
              var ajaxContext = this; 
              setTimeout($.ajax.bind(null, ajaxContext), this.tryCount * RETRY_LAG); 
            } else { 
              alert(`AB Connect is currently heavily loaded.  We retried several times but still haven't had an success.  Wait a few minutes and try again.`);
            } 
            return; 
          default: 
            alert(`Unexpected error: ${xhr.responseText}`);
        } 
      } 
    } 
  ); 
}
//
// init - if we are here, it is all good - get started 
//
var gWidgetInit = false;
function init() {
  //
  // Load the standards browser
  //
  if (gWidgetInit) {
    $('.standard').standardsBrowser('destroy'); // this isn't strictly necessary, but we want to make sure it is cleared if someone changes the auth credentials and re-initializes
  }
  $('.standard').standardsBrowser({
    selectMode: 'single',
    enableDoubleClick: false,
    authCredentials: {
      ID: gPartnerID,
      signature: gSignature,
      expires: gAuthExpires
    },
    onStandardSelect: function(event, GUID){
      standardSelected(GUID);
    },
    onStandardDeselect: function(event, GUID){
      noStandardSelected();
    },
    onError: function(event, message){
      alert(message);
    }
  });
  gWidgetInit = true;
}
//
// authenticationParameters - retrieve the auth URL parameters
//
function authenticationParameters() {
  var authDetails = '&partner.id=' + encodeURIComponent(gPartnerID);
  if (gSignature) {
    authDetails += '&auth.signature=' + encodeURIComponent(gSignature) + '&auth.expires=' + encodeURIComponent(gAuthExpires);
  }
  return authDetails;
}
//
// standardSelected - make note of a change in the current standard. We retrieve the standard and display the details.
//    currentStandard - the current selected GUID
//
//  Uses:
//    gActiveStandard - last standard selected.  If it hasn't changed, we don't do anything.  If it changed,
//      we display the standards data in the details. Otherwise do nothing.
//
var gActiveStandard = null;
function standardSelected(currentStandard) {
  //
  // They selected a new node
  //
  if (gActiveStandard != currentStandard) {
    //
    // construct the URL to pull the details
    //
    var sourceUrl = STANDARDS_URL + '/' + currentStandard +
      '?facet_summary=_none&fields[standards]=statement,section,document,education_levels,disciplines,number,parent,utilizations';
    if (gTopicsLicensed) sourceUrl += ',topics,concepts,key_ideas&include=topics,concepts'; // include the topics stuff if topics is licensed

    logCall(sourceUrl); // dump URLs to the console to make it easy to see the calls when learning the API

    sourceUrl += authenticationParameters(); // do the auth bit
    //
    // request the data
    //
    $.ajax( 
      { 
        url: sourceUrl,
        crossDomain: true, 
        dataType: 'json', 
        tryCount: 0, 
        retryLimit: RETRY_LIMIT,
        success: function(data,status) {
          PopulateDetails(data);
          
          gActiveStandard = currentStandard; // remember where we are
          },
        error: function(xhr, status, error) 
          { 
          switch (xhr.status) {
            case 503: // various resource issues
            case 504: 
            case 408: 
            case 429: 
              this.tryCount++; 
              if (this.tryCount <= this.retryLimit) { //try again 
                var ajaxContext = this; 
                setTimeout($.ajax.bind(null, ajaxContext), this.tryCount * RETRY_LAG); 
              } else { 
                alert(`AB Connect is currently heavily loaded.  We retried several times but still haven't had an success.  Wait a few minutes and try again.`);
              } 
              return; 
            default: 
              alert(`Unexpected error: ${xhr.responseText}`);
          } 
        } 
      } 
    ); 
  }
}
//
// noStandardSelected - If the user deselects the standard, clear the details
//
//  Uses:
//    gActiveStandard - last standard selected.  Clear it out to force a lookup next selection
//
function noStandardSelected() {
  //
  // Reset the selection state of everything
  //
  gActiveStandard = null;
  $('.details').empty(); // clear the standard details
}
//
// PopulateDetails - load the details section of the screen with the selected node details
//
//  Arguments:
//    data - AJAX response
//
function PopulateDetails(data) {
  //
  // Let's start simple and just dump the JSON in pretty format
  //
  var jsonPretty = syntaxHighlightResponse(data); // prettify the JSON of the standard
  
  $('.details').html(jsonPretty); // update the details div with the content
}
//
// toggleCommandLog - toggle the visibility of the API command log div area
//
function toggleCommandLog(URL) {
  $('.commandArea').toggle();
}
//
// logCall - dump the call URL to the command text area
//
//  Arguments:
//    URL - the call
//
function logCall(URL) {
  var textArea = $('.commandList');
  textArea.val(textArea.val() + URL + "\n\n");
  if(textArea.length)
       textArea.scrollTop(textArea[0].scrollHeight - textArea.height());
}
//
// syntaxHighlightResponse - pretify the response
//
//  Arguments:
//    json - AJAX response
//
//  Response: HTML pretified JSON
//
function syntaxHighlightResponse(json) {
  if (typeof json != 'string') {
     json = JSON.stringify(json, null, 2);
  }
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    var cls = 'number';
    var content = match;
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'key';
      } else {
        if (/"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"/.test(match)) {
          cls = 'guid';
        } else {
          cls = 'string';
        }
      }
    } else if (/true|false/.test(match)) {
      cls = 'boolean';
    } else if (/null/.test(match)) {
      cls = 'null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}
