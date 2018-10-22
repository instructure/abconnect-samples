const HOST = 'https://api.academicbenchmarks.com'
const STANDARDS_URL = HOST + "/rest/v4/standards";
const TOPICS_URL = HOST + "/rest/v4/topics";
const ASSETS_URL = HOST + "/rest/v4/assets";
const ARTIFACTS_URL = HOST + "/rest/v4/artifacts";
const CONCEPTS_URL = HOST + "/rest/v4/concepts";
const PROCESSING = 'Processing...';
const NO_ALIGNMENTS = 'No Alignments';

var gTopicsConceptsLicensed = false; // assume topics aren't licensed initially
var gArtifactsLicensed = false; // assume artifacts aren't licensed initially

jQuery.support.cors = true;
// Microsoft Edge support - Polyfill the <details> tag
$('details').details();
//
// updateDisplay - Something changed in the filter criteria - update all of the widgets and main list
//
function updateDisplay() {
  loadAssets();
  updateFacetCounts();
}
//
// updateFacetCounts - update the facets and counts
//
function updateFacetCounts() {
  //
  // loop over the detail tags.  The parent div class is the name of the facet.  We do NOT use the facet itself as filter criteria when counting asset counts because we could run into mutually exclusive situations
  // and we want different options to be selectable within a facet (like science and math).  Basically we are setting up an OR condition within the facet group
  //
  var facets = $('.side-panel details');
  for (var i=0; i < facets.length; i++) {
    var group = facets[i].parentNode.getAttribute('class');
    switch (group) {
      case 'standardsDoc':
        // do nothing here - we don't display counts on the documents
        break;
      case 'topicsCloud':
      case 'conceptsCloud':
        if (gTopicsConceptsLicensed) updateCloudCounts(group);
        break;
	      case 'artifacts':
	      case 'artifactsList':
          updateArtifactFaceting(); // update the artifact fact counts if there is anything to update
        break;
      case 'standardsAligned':
        updateStandardsAssetsCount(); // delegate the details to the align-widget module
        break;
      default: // normal faceted values
        updateFacetWidgetCounts(group); // delegate the details to the facet-widget module
        break;
    }
  }
}
//
// loadAssets - pull the related assets.  Note that we skip this if there are no filter criteria to avoid overload
//
var gAssets = {}; // the cache of assets so we can populate the details
var gVariableArguments = null;
var gFacetFilter = null;
function loadAssets() {
  var facetFilter = buildFilter();
  
  if (gFacetFilter !== facetFilter ) gPaging.offset = 0; // if anything about the filtering has changed, reset the paging
  gFacetFilter = facetFilter;
  
  var sVariableArguments = '?limit=' + gPaging.pageSize + '&offset=' + gPaging.offset + facetFilter;
  
  if (sVariableArguments === gVariableArguments) return; // nothing to update
  
  gVariableArguments = sVariableArguments;
  disableLists();
  //
  // construct the URL to retreive the assets
  //
  var sourceUrl = ASSETS_URL + sVariableArguments + '&fields[assets]=title,client_id,disciplines,education_levels,asset_type';
  sourceUrl += Provider.getAssetFields();

  sourceUrl += authenticationParameters(); // add the auth stuff
  //
  // request the data
  //
  $.ajax(
    {
    url: sourceUrl,
    crossDomain: true,
    dataType: 'json',
    success: function(data,status)
      {
      populateAssets(data);
      },
    error: function(req, status, error)
      {
      alert('Error loading assets from AB Connect. ' + req.responseText);
      }
    });
}
//
// populateAssets - load the assets list
//    data - AJAX response
//
function populateAssets(data) {
  hidePaging(); // prevent flashing of paging info
  updatePaging(data); // update the counts
  enableLists();
  var list = $( "ul.my-border-list.mdc-list--two-line.mdc-list");
  list.empty(); // clear the list
  var expList = $( ".expandList");
  expList.empty(); // clear the list
  var gridList = $( ".gridList .mdc-grid-list ul.mdc-grid-list__tiles");
  gridList.empty(); // clear the list
  gAssets = {};
  
  if (data.data.length === 0) { // nothing to display
    showPaging();
    return;
  }
  //
  // Loop over the assets, construct the label and add them to the supplied list
  //
  for (var i=0; i < data.data.length; i++) {
    var asset = data.data[i];
    gAssets[asset.id] = asset; // cache this asset for later reference
    //
    // flesh out the item definition
    //
    asset.attributes.disciplines.subjects.sort(function (a, b) { // sort the subjects alphabetically
      if (a.descr < b.descr) return -1;
      else if (a.descr > b.descr) return 1;
      else return 0;
    });
    var subjects = '';
    for (j=0; j < asset.attributes.disciplines.subjects.length; j++) { // convert the list to CSV
      subjects += asset.attributes.disciplines.subjects[j].descr + ', ';
    }
    if (subjects) {
      subjects = subjects.substr(0,subjects.length - 2);
    }
    asset.attributes.education_levels.grades.sort(function (a, b) { // sort the grades by seq
      if (a.seq < b.seq) return -1;
      else if (a.seq > b.seq) return 1;
      else return 0;
    });
    var grades = '';
    for (j=0; j < asset.attributes.education_levels.grades.length; j++) { // convert the list to CSV
      grades += asset.attributes.education_levels.grades[j].code + ',';
    }
    if (grades) {
      grades = grades.substr(0,grades.length - 1);
    }
    var title = '&lt;no title&gt;';
    if (asset.attributes.title) title = asset.attributes.title;
    //
    // create the basic list view element
    //
    var item = '';
    item = Provider.getBasicItem(asset, title, subjects, grades);
    list.append(item);
    //
    // create the expansion list view
    //
    item = Provider.getExpandItem(asset, title, subjects, grades);
    expList.html(expList.html() + item);
    //
    // create the grid view
    //
    item = Provider.getTileItem(asset, title, subjects, grades, i);
    gridList.html(gridList.html() + item);
  }

  showPaging();
}
//
// buildFilter - build the facet filter string
//  skip - a list of facets to NOT include in the filter string generation
//
//  returns: the facet filter string ready to be added to the end of the URL
//
function buildFilter(skip) {
  //
  // Build the filter statement, filtering on selected values if any.
  // Start by recording the selected facet values
  //
  var filter = buildFacetFilter(skip);
  //
  // if there is anything in the search field, add it to the filter criteria
  //
  var search = $('.search');
  if (search.val().length > 0) {
    var text = search.val().replace(/[^a-zA-Z0-9]+/g, ' '); // prevent naughtiness - only allow alphanums
    filter += "query('" + text + "') AND "
  }
  //
  // if standards are selected and we aren't skipping them for this filter:
  //
  var GUIDs = '';
  if ($.inArray( 'standardsAligned', skip) === -1) {
    //
    // gather the list of selected standards
    //
    var chips = $('.standardsChips .mdl-chip__text');
    GUIDs = '';
    for (var i=0; i < chips.length; i++) {
      GUIDs += "'" + chips[i].getAttribute('value') + "',"
    }
    if (GUIDs) {
      filter += "standards.id in (" + GUIDs.substr(0,GUIDs.length-1) + ") AND standards.disposition in ('accepted', 'predicted') AND ";
    }
  }
  //
  // if concepts are selected and we aren't skipping them for this filter:
  //
  if ($.inArray( 'conceptsCloud', skip) === -1) {
    //
    // now grab them from the tag cloud
    //
    chips = $('.conceptsCloud .chips .mdl-chip__text');
    GUIDs = '';
    for (var i=0; i < chips.length; i++) {
      var guid = chips[i].getAttribute('value');
      GUIDs += "'" + guid + "',"
    }
    if (GUIDs) {
      filter += "concepts.id in (" + GUIDs.substr(0,GUIDs.length-1) + ") AND ";
    }
  }
  //
  // if topics are selected and we aren't skipping them for this filter:
  //
  if ($.inArray( 'topicsCloud', skip) === -1) {
    //
    // now grab them from the tag cloud
    //
    chips = $('.topicsCloud .chips .mdl-chip__text');
    GUIDs = '';
    for (var i=0; i < chips.length; i++) {
      var guid = chips[i].getAttribute('value');
      GUIDs += "'" + guid + "',"
    }
    if (GUIDs) {
      filter += "topics.id in (" + GUIDs.substr(0,GUIDs.length-1) + ") AND ";
    }
  }
  //
  // if artifacts are selected and we aren't skipping them for this filter:
  //
  if ($.inArray( 'artifacts', skip) === -1) {
    //
    // now grab them from the tag cloud
    //
    chips = $('.artifacts .chips .mdl-chip__text');
    GUIDs = '';
    for (var i=0; i < chips.length; i++) {
      var guid = chips[i].getAttribute('value');
      GUIDs += "'" + guid + "',"
    }
    if (GUIDs) {
      filter += "artifacts.artifact_type.id in (" + GUIDs.substr(0,GUIDs.length-1) + ") AND ";
    }
  }
  //
  // allow the provider to configure defaults if they'd like
  //
  filter += Provider.buildFilter();
  //
  // if there was any criteria, add the proper argument formatting
  //
  if (filter) {
    filter = '&filter[assets]=(' + encodeURIComponent(filter.substr(0,filter.length-5)) + ')';
  }
  
  return filter;
}
//
// checkTopicsLicenseLevel - see if we can request concepts/topics
//
function checkTopicsLicenseLevel() {
  //
  // hit the topics endpoint - if you get a 401, you are not licensed for topics or concepts (or possibly don't have a valid ID/key - but either way, let's drop topics and concepts)
  //
  var topicURL = TOPICS_URL + '?limit=0' + authenticationParameters();
  //
  // request the data
  //
  $.ajax(
    {
    url: topicURL,
    crossDomain: true,
    dataType: 'json',
    success: function(data,status) {
        gTopicsConceptsLicensed = true; // note we can use topics and relationships as topics is a higher license level than relationships
        checkArtifactsLicenseLevel(); // check the artifact license now
      },
    error: function(req, status, error) {
        if (req.status === 401) { // authorization error - let's figure out what kind
          if (req.responseJSON.errors && 
            req.responseJSON.errors[0].detail) {
              
            if (req.responseJSON.errors[0].detail === 'Signature is not authorized.') {
              alert('Invalid partner ID or key.');
            } else if (req.responseJSON.errors[0].detail === 'This account is not licensed to access Topics') {
              checkArtifactsLicenseLevel(); // check the artifact license now
            } else { // swallow an unexpected error and just check the artifact license now
              checkArtifactsLicenseLevel(); // check the artifact license now
            }
          } else checkArtifactsLicenseLevel(); // swallow an unexpected error and check the artifact license now
        } else {
          alert(`An error occured when attempting to check the Topics license. This is likely a timeout on the dev server. Status: ${status}. Error: ${error}`);
          checkArtifactsLicenseLevel();
        }
      }
    }
  );
}
//
// checkArtifactsLicenseLevel - see if we can request artifacts
//
function checkArtifactsLicenseLevel() {
  //
  // hit the topics endpoint - if you get a 401, you are not licensed for topics or concepts (or possibly don't have a valid ID/key - but either way, let's drop topics and concepts)
  //
  var artifactURL = ARTIFACTS_URL + '?limit=0' + authenticationParameters();
  //
  // request the data
  //
  $.ajax(
    {
    url: artifactURL,
    crossDomain: true,
    dataType: 'json',
    success: function(data,status) {
        gArtifactsLicensed = true; // note we can use artifacts
        init();
      },
    error: function(req, status, error) {
        if (req.status === 401) { // authorization error - let's figure out what kind
          if (req.responseJSON.errors && 
            req.responseJSON.errors[0].detail) {
              
            if (req.responseJSON.errors[0].detail === 'Signature is not authorized.') {
              alert('Invalid partner ID or key.');
            } else if (req.responseJSON.errors[0].detail === 'This account is not licensed to access Artifacts') {
              init();
            } else { // swallow an unexpected error and just init the app without artifacts
              init();
            }
          } else init(); // swallow an unexpected error and just init the app without artifacts
        } else {
          alert(`An error occured when attempting to check the Artifacts license. This is likely a timeout on the dev server. Status: ${status}. Error: ${error}`);
          init();
        }
      }
    }
  );
}
//
// init - if we are here, it is all good - get started 
//
function init() {
  //
  // show/hide the topics and concepts stuff based on licensing
  //
  if (gTopicsConceptsLicensed) {
    $('.topicsCloud').show();
    $('.conceptsCloud').show();
    initCloudCounts();
  } else {
    $('.topicsCloud').hide();
    $('.conceptsCloud').hide();    
  }
  if (gArtifactsLicensed) {
    $('.artifacts').show();
    updateArtifactFaceting(); // gather the artifact facets
  } else {
    $('.artifacts').hide();
  }
  identifyFacets();
  loadAssets();
}
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
// authenticate - retrieve the required credentials and load the page
//
function authenticate() {
  //
  // call the provider specific method for loading the credentials
  //
  Provider.authenticate();
  //
  // reset the license levels - we do this here so we pickup the proper settings when someone changes the user account
  //
  gTopicsConceptsLicensed = false;
  checkTopicsLicenseLevel();
}
//
// viewExp - show the expansion list
//
function viewExp() {
  $('.basicList').hide();
  $('.viewList').css('color', '#000');
  $('.viewList').css('cursor', 'pointer');
  $('.gridList').hide();
  $('.viewGrid').css('color', '#000');
  $('.viewGrid').css('cursor', 'pointer');
  $('.expandList').show();
  $('.viewExp').css('color', '#bdbdbd');
  $('.viewExp').css('cursor', 'default');
}
//
// viewList - show the basic list view
//
function viewList() {
  $('.basicList').show();
  $('.viewList').css('color', '#bdbdbd');
  $('.viewList').css('cursor', 'default');
  $('.gridList').hide();
  $('.viewGrid').css('color', '#000');
  $('.viewGrid').css('cursor', 'pointer');
  $('.expandList').hide();
  $('.viewExp').css('color', '#000');
  $('.viewExp').css('cursor', 'pointer');
}
//
// viewGrid - show the grid view
//
function viewGrid() {
  $('.basicList').hide();
  $('.viewList').css('color', '#000');
  $('.viewList').css('cursor', 'pointer');
  $('.gridList').show();
  $('.viewGrid').css('color', '#bdbdbd');
  $('.viewGrid').css('cursor', 'default');
  $('.expandList').hide();
  $('.viewExp').css('color', '#000');
  $('.viewExp').css('cursor', 'pointer');
}
//
// disableLists - disable the list region
//
function disableLists() {
  $('.assetList').addClass('disabledDiv');
}
//
// enableLists - enable the list region
//
function enableLists() {
  $('.assetList').removeClass('disabledDiv');
}

function htmlEncode(value){
  //create a in-memory div, set it's inner text(which jQuery automatically encodes)
  //then grab the encoded contents back out.  The div never exists on the page.
  return $('<div/>').text(value).html();
}
