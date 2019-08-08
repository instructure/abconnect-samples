const SELECTED = 'selected';
const STANDARDS_BROWSER_SELECTOR = '.standardsSelect .standard';
var gStandardsBrowserConfig = {};
var gWidgetStandardsList = {};
//
// selectStandards - When the standards button is pressed, load the browse widget
//
function selectStandards() {
  //
  // Initialize the browser with the latest config
  //
  initStandardsBrowser();
  
  parentElement = $('.ab-standards-dialog')
  
  var dialog = mdc.dialog.MDCDialog.attachTo(document.querySelector('.ab-standards-dialog'));
  
  dialog.show();
}
//
// saveStandards - make note of the selected standards and save the configuration for later
//
function saveStandards() {

  gStandardsBrowserConfig = $(STANDARDS_BROWSER_SELECTOR).standardsBrowser('getConfiguration'); // remember the settings so we can start where we were
  //
  // Loop over the assets, construct the label and add them to the supplied list
  //
  var chipSpace = $('.standardsChips');
  chipSpace.empty();
  var chips = '';
  for (var GUID in gWidgetStandardsList) {
    if (!gWidgetStandardsList.hasOwnProperty(GUID)) continue;
    //
    // Make sure the number is valid and readable
    //
    var number = gWidgetStandardsList[GUID].number;
    if (!number) {
      var limit = 10;
      if (gWidgetStandardsList[GUID].statement.length <= limit)
        limit = gWidgetStandardsList[GUID].statement.length - 1;
      
      number = gWidgetStandardsList[GUID].statement.substr(0,limit);
    }
    //
    // the line format is "<number> <statement>"
    //
    chips += `
    <span class="mdl-chip mdl-chip--deletable">
        <span class="mdl-chip__text" title="${gWidgetStandardsList[GUID].statement}" value="${GUID}">${number} </span>
        <button type="button" class="mdl-chip__action" value="${GUID}" onclick="dropStandard(event);"><i class="material-icons">cancel</i></button>
    </span>`;
  }
  chipSpace.html(chips);
  //
  // Refresh the list
  //
  updateDisplay();
}
//
// dropStandard - remove the specified standard from the list (chips) and update the display
//  event - the storage event
//
function dropStandard(ev) {
  
  delete gWidgetStandardsList[ev.target.parentNode.value]; // remove the standard from the list used for filtering
  ev.target.parentNode.parentNode.parentNode.removeChild(ev.target.parentNode.parentNode); // remove the chip.  I hate this notation.  :0
  
  updateDisplay();
}
//
// updateStandardsAssetsCount - refresh the asset counts on the standards chips
//
function updateStandardsAssetsCount() {
  var chips = $('.standardsChips .mdl-chip'); // get the list of aligned standards
  for (var i=0; i < chips.length; i++) { // loop over the related chips
    var guid = chips[i].firstElementChild.getAttribute('value'); // grab the GUID from the chip value
    countStandardsRelatedAssets(guid); // update the count
  }
}
//
// countStandardsRelatedAssets - count the number of assets related to this standard (taking the current filtering into account)
//  GUID - standard in question
//
function countStandardsRelatedAssets(GUID) {
  var facetFilter = buildFilter(['standardsAligned']);
  const leadIn = '&filter[assets]=(';
  //
  // include the appropriate relationships in the search
  //
  var dispositionSearch = "standards.disposition in ('accepted', 'predicted')";
  if (!gIncludePredicted) dispositionSearch = "standards.disposition EQ 'accepted'";
  if (facetFilter) { // there is some other criteria
    //
    // pick apart the filter and add this single standard as part of the criteria
    //
    facetFilter = decodeURIComponent(facetFilter.substr(leadIn.length, facetFilter.length - leadIn.length - 1)); // strip off the leading and trailing stuff and then decode the string
    facetFilter += " AND standards.id eq '" + GUID + "' AND " + dispositionSearch;
    facetFilter = leadIn + encodeURIComponent(facetFilter) + ')';
  } else { // there is no filter criteria
    facetFilter = leadIn + encodeURIComponent("standards.id eq '" + GUID + "' AND " + dispositionSearch) + ')';
  }
  var sVariableArguments = '?limit=0&facet_summary=_none' + facetFilter;
  //
  // construct the URL to count the assets
  //
  var sourceUrl = ASSETS_URL + sVariableArguments;

  sourceUrl += authenticationParameters(); // add the auth stuff
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
          setStandardAssetCount(data, GUID);
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
            alert(`Error retrieving standards facet counts from AB Connect. ${xhr.responseText}`);
        } 
      } 
    } 
  ); 

}
//
// setStandardAssetCount - update the display
//  data - API response
//  GUID - standard in question
//
function setStandardAssetCount(data, GUID) {
  var chip = $('[value=' + GUID + ']:eq(0)'); // grab the chip in question
  var number = chip.text(); // get the span text
  number = number.replace(/\(\d+\)$/, ''); // strip the previous number count (if any)
  number += '(' + data.meta.count + ')'; // put the new number in there
  chip.text(number); // update the chip
}
//
// initStandardsBrowser - initialize the standards browser
//
function initStandardsBrowser() {
  //
  // if there are any values selected in the document widget, use those as defaults.  If the actual standards document itself is selected,
  // use the selections as the defaults for the standards selector and hide the controls.  We do this because selecting any standards in a different
  // document in the standards browser will end up with 0 assets.
  //
  //
  // Load the standards browser
  //
  var config = {
    selectMode: 'multiple',
    enableDoubleClick: true,
    showAssetCount: true,
    authCredentials: {
      ID: Provider.ID,
      signature: Provider.signature,
      expires: Provider.expires
    },
    onStandardDoubleClick: function(event, GUID){
      addStandard(GUID);
    },
    onStandardSelect: function(event, GUID){
      standardsChanged();
    },
    onStandardDeselect: function(event, GUID){
      standardsChanged();
    },
    onError: function(event, message){
      alert(message);
    }
  };
  if (gStandardsBrowserConfig) {
    config.uiEntityState = gStandardsBrowserConfig;
  }
  //
  // setup the asset count filter criteria
  //
  var sFilter = buildFilter(['standardsAligned', 'standardsDoc']);
  if (sFilter) {
    if (!gIncludePredicted) {
      sFilter = sFilter.substr(0, sFilter.length-1) + " AND standards.disposition EQ 'accepted')";
    } else {
      sFilter = sFilter.substr(0, sFilter.length-1) + " AND standards.disposition in ('accepted', 'predicted'))";
    }

    var leadin = "&filter[assets]=(";
    config.assetCountFilter = decodeURIComponent(sFilter.substr(leadin.length, sFilter.length-leadin.length-1)); // the facet filter includes the full encoded filter string, but the widget wants just the decoded filter statement
  }

  try {
    $(STANDARDS_BROWSER_SELECTOR).standardsBrowser('destroy')
  } catch (e) {
    
  }
  
  $(STANDARDS_BROWSER_SELECTOR).standardsBrowser(config);
  //
  // Load the select list
  //
  var list = $( "ul.standardsList");
  list.empty();
  for (var GUID in gWidgetStandardsList) {
    
    if (!gWidgetStandardsList.hasOwnProperty(GUID)) continue; // skip this item if it isn't a standard
    
    var label = '';
    if (gWidgetStandardsList[GUID].number) label += gWidgetStandardsList[GUID].number + ' ';
    label += gWidgetStandardsList[GUID].statement; // build the visual element

    var item = `
        <li class="mdc-list-item" onclick="toggleStandard(event)" value="${GUID}">
          <div class="limitItem">
            ${label}
          </div>
        </li>`;

    list.append(item);
  }
  standardsChanged(); // update the buttons
}
//
// standardsChanged - update the arrow buttons
//
function standardsChanged() {
  //
  // get the current number of standards selected in the browser
  //
  var selection = $(STANDARDS_BROWSER_SELECTOR).standardsBrowser('getSelection');
  //
  // If there are any, enable any disabled buttons
  //
  var button = $('.addStandards');
  if (selection.length > 0) {
    button.prop('disabled', false);
  } else {
    button.prop('disabled', true);
  }
  //
  // get the current number of selected standards
  //
  selection = $(".standardsList ." + SELECTED);
  //
  // If there are any, enable any disabled buttons
  //
  button = $('.removeStandards');
  if (selection.length > 0) {
    button.prop('disabled', false);
  } else {
    button.prop('disabled', true);
  }
  //
  // get the current number of standards
  //
  selection = $(".standardsList .mdc-list-item");
  //
  // If there are any, enable any disabled buttons
  //
  button = $('.save');
  if (selection.length > 0) {
    button.prop('disabled', false);
  } else {
    button.prop('disabled', true);
  }
}
//
// addStandards - Add standards to the list window (if any are selected)
//
function addStandards() {
  var GUIDs = $(STANDARDS_BROWSER_SELECTOR).standardsBrowser('getSelection');
  if (GUIDs.length === 0) return; // nothing selected, skip
  //
  // loop over the selected standards and add them to the list
  //
  var sGUIDlist = '';
  for (var i=0; i< GUIDs.length; i++) {
    var GUID = GUIDs[i];
    
    sGUIDlist += "'" + GUID + "',";
  }
  sGUIDlist = sGUIDlist.substring(0,sGUIDlist.length-1); // strip the trailing comma
  var sourceUrl = STANDARDS_URL + '?filter[standards]=(' + encodeURIComponent('id in (' + sGUIDlist + ')') + ')&facet_summary=_none&fields[standards]=number,statement'
  
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
      success: function(data,status)
        {
        addStandardsToList(data);
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
            alert(`Error retrieving standards details for chips from AB Connect. ${xhr.responseText}`);
        } 
      } 
    } 
  ); 
}
//
// addStandard - Add a standard to the list window (in response to a double click event)
//
function addStandard(GUID) {
  var sourceUrl = STANDARDS_URL + '?filter[standards]=(' + encodeURIComponent("id eq '" + GUID + "'") + ')&fields[standards]=number,statement&facet_summary=_none'
  
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
      success: function(data,status)
        {
        addStandardsToList(data);
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
            alert(`Error retrieving standards details from AB Connect. ${xhr.responseText}`);
        } 
      } 
    } 
  ); 
}
//
// addStandardsToList - Add standards to the list window (if any are selected)
//  data - the response from the API call
//
function addStandardsToList(data) {
  //
  // loop over the standards
  //
  var list = $( "ul.standardsList");
  for (var i=0; i < data.data.length; i++) {
    var standard = data.data[i];
    
    if (gWidgetStandardsList.hasOwnProperty(standard.id)) continue; // skip this standard if it is already in the list
    
    gWidgetStandardsList[standard.id] = {
      number: standard.attributes.number.enhanced,
      statement: standard.attributes.statement.descr
    }; // track the list of selected standards
    
    var label = '';
    if (standard.attributes.number.enhanced) label += standard.attributes.number.enhanced + ' ';
    label += standard.attributes.statement.descr; // build the visual element

    var item = `
        <li class="mdc-list-item" onclick="toggleStandard(event)" value="${standard.id}">
          <div class="limitItem">
            ${label}
          </div>
        </li>`;

    list.append(item);
  }
  standardsChanged(); // update the buttons
}
//
// toggleStandard - toggle the selection of the clicked standard
//  event
//
function toggleStandard(ev) {
  //
  // toggle the selected status
  //
  $(ev.target).parent().toggleClass(SELECTED);
  
  standardsChanged();
}
//
// removeStandards - Remove standards from the list window
//
function removeStandards() {
  //
  // get the current of standards selected
  //
  var selection = $(".standardsList ." + SELECTED);
  //
  // loop over the standards
  //
  for (var i=0; i < selection.length; i++) {
    delete gWidgetStandardsList[selection[i].attributes['value'].value];
    selection.remove();
  }
  standardsChanged(); // update the buttons
}
