const HOST = 'https://api.abconnect.certicaconnect.com'
const ASSETS_URL = HOST + "/rest/v4.1/assets";
const STANDARDS_URL = HOST + "/rest/v4.1/standards";
const STANDARDS_PAGE_SIZE = 100;
const RETRY_LIMIT=20;
const RETRY_LAG=500;

jQuery.support.cors = true;
//
// call the provider specific method for loading the credentials
//
Provider.authenticate();
//
// Now initialize the authority selector
//
initAuthoritySelector();
//
// authenticationParameters - retrieve the auth URL parameters
//
function authenticationParameters() {
  var authDetails = '&partner.id=' + encodeURIComponent(Provider.ID);
  if (Provider.signature) {
    authDetails += '&auth.signature=' + encodeURIComponent(Provider.signature) + '&auth.expires=' + encodeURIComponent(Provider.expires);
  }
  return authDetails;
}
//
// initAuthoritySelector - initialize the authority selector - retrieve the authorities in the license and populate the select list
//
function initAuthoritySelector() {
  //
  // get a list of authorities
  //
  var sourceUrl = STANDARDS_URL + '?facet=document.publication.authorities&facet_summary=document.publication.authorities&limit=0';
  logCall(sourceUrl, "Get the list of authorities in this account's license");
  sourceUrl += authenticationParameters(); // add the auth stuff
  $.ajax( 
    { 
      url: sourceUrl,
      crossDomain: true, 
      dataType: 'json', 
      tryCount: 0, 
      retryLimit: RETRY_LIMIT,
      success: function(data,status) {
          loadAuthorities(data);
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
              alert(`The system appears to be busy right now.  Wait for a short period and try again.`);
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
// loadAuthorities - load the authorities into the select region
//    data - the API response
//
function loadAuthorities(data) {
  //
  // sort the authorities alphabetically
  //
  data.meta.facets[0].details.sort(function (a, b) {
    if (a.data.descr < b.data.descr) return -1;
    else if (a.data.descr > b.data.descr) return 1;
    else return 0;
  });
  //
  // add the authorities to the selector
  //
  $.each(data.meta.facets[0].details, function (i, item) {
      $('.authority .mdc-select').append($('<option>', { 
          value: item.data.guid,
          text : item.data.descr 
      }));
  });
}
//
// lookupAsset - pull the asset alignments and start the process of showing them
//
function lookupAsset() {
  var searchText = $( ".textSearch .search").val();

  $( ".alignmentList").empty(); // clear out the old alignments
  
  if (!searchText || searchText.length ===0) {
    $('.assetTitle').html('<div class="assetValue">No content found.</div>');
    return;
  }
  //
  // get the asset details
  //
  findAsset(searchText);
}
//
// findAsset - pull the assets - we only show the first one but we show the "matching" count
//  searchText - text to search for assets
//
function findAsset(searchText) {
  //
  // build the filter criteria
  //
  searchText = searchText.replace(/\\/g, ""); // remove backslashes
  searchText = searchText.replace(/\'/g, "\\'"); // escape single quotes
  var filter = `id eq '${searchText}' OR client_id eq '${searchText}' OR query('${searchText}')`; // look for text matches in the GUID, client_id or general search text
  //
  // search for assets
  //
  var sourceUrl = ASSETS_URL + "?filter[assets]=(" + encodeURIComponent(filter) + ")&limit=1&facet_summary=_none&fields[assets]=title,client_id,id"; // pull the first asset that matches the criteria
  logCall(sourceUrl, "Find assets that match the search text on the client_id, AB GUID or in the text fields.");
  sourceUrl += authenticationParameters(); // add the auth stuff
  $.ajax( 
    { 
      url: sourceUrl,
      crossDomain: true, 
      dataType: 'json', 
      tryCount: 0, 
      retryLimit: RETRY_LIMIT,
      success: function(data,status) {
          showAsset(data);
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
              alert(`The system appears to be busy right now.  Wait for a short period and try again.`);
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
// showAsset - process the matching asset response
//
function showAsset(data) {
  var assetTitle = $('.assetTitle');
  if (data.data.length === 0) {
    assetTitle.html('<div class="assetValue">No content found.</div>');
    return;
  }
  //
  // show the asset header
  //
  var assetLabel = '';
  if (data.meta.count > 1) {
    assetLabel = 'Showing the alignments for the first item of ' + data.meta.count + '. ';
  }
  var asset = data.data[0];
  assetLabel += `<div class="assetLabel">Client ID:</div> <div class="assetValue">${asset.attributes.client_id}</div> `;
  if (asset.attributes.title) {
    assetLabel += `<div class="assetLabel">Title:</div> <div class="assetValue">${asset.attributes.title}</div> `;
  }
  assetLabel += `<div style="font-size: .8em;"><div class="assetLabel">AB GUID:</div> <div class="assetValue">${asset.id}</div></div>`
  assetTitle.html(assetLabel);
  //
  // Retrieve the alignments for display
  //
  showAlignments(asset.id);
}
//
// showAlignments - retrieve the alignments and prepare to display them
//  guid - matching asset GUID
//
function showAlignments(guid) {
  var authorityGuid = $('.authority .mdc-select :selected').val();
  //
  // build the filter criteria
  //
  var filter = "meta.disposition in ('predicted','accepted')"; // limit the standards to accepted and predicted (i.e. don't include rejected standards)
  if (authorityGuid) { // if an authority is selected
    filter += ` AND document.publication.authorities.guid eq '${authorityGuid}'` // limit the scope to that authority
  }
  //
  // request the standards and add it to the display
  //
  var sourceUrl = ASSETS_URL + '/' + guid + "/alignments?filter[standards]=(" + encodeURIComponent(filter) + ")&limit=" + STANDARDS_PAGE_SIZE;
  logCall(sourceUrl, "Find aligned standards (accepted and predicted) in the specified authority.");
  sourceUrl += authenticationParameters(); // add the auth stuff
  $.ajax(
    { 
      url: sourceUrl,
      crossDomain: true,
      dataType: 'json', 
      tryCount: 0, 
      retryLimit: RETRY_LIMIT,
      success: function(data,status) {
          //
          // if the first call returns no data, note that there are no alignments
          //
          if (!data.data.length) { // no alignments
            $('.alignmentList').text('No Alignments'); // since alignments are typically critical, we explicitly call it out if the alignments don't exist
            return;
          }
          $('.alignmentList').empty(); // clear the list so we can start to add to it

          populateAlignments(data);
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
              alert(`The system appears to be busy right now.  Wait for a short period and try again.`);
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
// populateAlignments - process the response from the alignment request
//  data - response from the API call
//
function populateAlignments(data) {
  //
  // convert the standards list to a single quoted CSV for use in an "id in(...)" statement
  //
  var csvList = '';
  for (var j=0; j<data.data.length; j++) {
    csvList += `'${data.data[j].id}',`;
  }
  csvList = csvList.substr(0,csvList.length-1); // trim the trailing comma
  //
  // request the standards and add it to the display
  //
  var sourceUrl = STANDARDS_URL + "?fields[standards]=statement,number,document&facet_summary=_none&filter[standards]=(id in (" + csvList + "))&limit=" + STANDARDS_PAGE_SIZE;
  logCall(sourceUrl, "Get the details of the aligned standards.");
  sourceUrl += authenticationParameters(); // add the auth stuff
  $.ajax(
    { 
      url: sourceUrl,
      crossDomain: true,
      dataType: 'json', 
      tryCount: 0, 
      retryLimit: RETRY_LIMIT,
      success: function(data,status) {
          renderAlignments(data);
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
              alert(`The system appears to be busy right now.  Wait for a short period and try again.`);
            } 
            return; 
          default: 
            alert(`Unexpected error: ${xhr.responseText}`);
        } 
      } 
    } 
  );
  //
  // if there are more standards in the paging, request the next page and exit
  //
  if (data.links.next && data.links.next.length > 0) {
    sourceUrl = data.links.next;
    logCall(sourceUrl, "Get the next page of aligned standards.");
    sourceUrl += authenticationParameters(); // add the auth stuff
    $.ajax(
      { 
        url: sourceUrl,
        crossDomain: true,
        dataType: 'json', 
        tryCount: 0, 
        retryLimit: RETRY_LIMIT,
        success: function(data,status) {
            populateAlignments(data);
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
                alert(`The system appears to be busy right now.  Wait for a short period and try again.`);
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
// renderAlignments - add the standards response to the alignment display
//  data - response from the API call
//
function renderAlignments(data) {
  //
  // Loop over the alignments constructing the resulting object filtered by authority if appropriate.
  //      The alignment list is an object (Map) of objects. Each key in the map is the authority name and the value is a list of standards objects.  Each standard object
  //        has a number and descr property.
  //
  var alignmentDetails = {};
  for (var i=0; i < data.data.length; i++) {
    var standard = data.data[i];
    //
    // Handle the funny situations where we don't have proper authorities setup yet.
    //
    var groupLabel;
    var groupGuid;
    if (standard.attributes.document.publication.authorities.length === 0) {
      groupLabel = standard.attributes.document.publication.descr;
      groupGuid = standard.attributes.document.publication.guid;
    } else {
      groupLabel = standard.attributes.document.publication.authorities[0].descr;
      groupGuid = standard.attributes.document.publication.authorities[0].guid;
    }
    if (!alignmentDetails.hasOwnProperty(groupGuid)) { // create authority
      alignmentDetails[groupGuid] = {
        label: groupLabel,
        standards: []
      };
    }
    //
    // Compensate for blank numbers
    //
    var number='';
    if (standard.attributes.number) {
      if (standard.attributes.number.enhanced && standard.attributes.number.enhanced.length > 0) {
        number = standard.attributes.number.enhanced;
      } else if (standard.attributes.number.raw && standard.attributes.number.raw.length > 0) {
        number = standard.attributes.number.raw;
      }
    }
    //
    // Add this standard to the authority
    //
    if (number) {
      alignmentDetails[groupGuid].standards.push({
        number: number,
        descr: standard.attributes.statement.combined_descr}
        );
    } else {
      alignmentDetails[groupGuid].standards.push({
        number: standard.attributes.statement.combined_descr.substr(0,20) + "...",
        descr: standard.attributes.statement.combined_descr}
        );
    }
  }
  //
  // loop over the authorities and display each standard on each authority
  //
  var authorities = Object.keys(alignmentDetails);
  var table = $('.alignmentList');
  for (var i=0; i<authorities.length; i++) {
    var guid = authorities[i];
    var alignments = alignmentDetails[guid];
    
    //
    // loop over the standards in this authority and add them to the list.
    //
    var newStandards = '';
    for (var j=0; j<alignments.standards.length; j++) {
      var standard = alignments.standards[j];
      newStandards += '<div class="standard" title="' + htmlEncode(standard.descr) + '">' + standard.number + '</div> ';
    }
    
    if ($(`.alignmentList .${guid}`).length) { // the authority already exists in the alignment list
      var authorityElement = table.find(`.${guid} .standardList`); // get the authority element
      authorityElement.append(newStandards); // add the standards to the list
      
    } else { // this is a new authority
      var authorityBody = '';
      authorityBody += `<div class="authority ${guid}">` + alignments.label + '<div class="standardList">'; // construct the new authority
      
      authorityBody += newStandards; // add the standards
      
      authorityBody += '</div></div>'; // close up the standardsList and authority
      
      table.append(authorityBody);
    }
  }

  $(".authority").tsort({order: "asc"}); // sort the authorities
  $(".standard").tsort({order: "asc"}); // sort the standards
}
//
// logCall - dump the call URL to the command text area
//    URL - the call
//    text - verbal desription
//
function logCall(URL, text) {
  var textArea = $('.commandList');
  textArea.val(textArea.val() + URL + " - " + text + "\n\n");
  if(textArea.length)
       textArea.scrollTop(textArea[0].scrollHeight - textArea.height());
}

function htmlEncode(value){
  //create a in-memory div, set it's inner text(which jQuery automatically encodes)
  //then grab the encoded contents back out.  The div never exists on the page.
  return $('<div/>').text(value).html();
}
