//
// KEY_FACETS - This is a list of properties whose name is the same as the AB Connect meta.facets.facet value.  The value of said property is an object where the specific field names are described in more
//  detail below.
// FACET_WIDGET_ORDER - the facet names in the order which you'd like the facet widgets displayed
//
// It is recommended that you modify this list (add values, remove them or mark supported false) in provider.js to keep a clean interface.  To remove a widget from consideration,
//  remove it entirely from KEY_FACETS and FACET_WIDGET_ORDER.
//
var KEY_FACETS = {
  'disciplines.subjects': { // key is facet name which must match a name from the assets endpoint meta.facets[].facet value.  The value of this property in this structure is an object.
    'class': '.subjects', // matching HTML element class - can be whatever that doesn't clash with other existing names
    'title': 'Subject', // the side widget title
  },
  'disciplines.strands': {
    'class': '.strands',
    'title': 'Strand',
  },
  'disciplines.genres': {
    'class': '.genres',
    'title': 'Genre',
  },
  'disciplines.ece_domains': {
    'class': '.domains',
    'title': 'Early Childhood Domain',
  },
  'asset_types': {
    'class': '.types',
    'title': 'Type',
  },
  'education_levels.grades': {
    'class': '.grades',
    'title': 'Grade',
  },
  'education_levels.ece_ages': {
    'class': '.ages',
    'title': 'Age',
  }
};
var FACET_WIDGET_ORDER = [
  'asset_types',
  'disciplines.subjects',
  'education_levels.grades',
  'disciplines.strands',
  'disciplines.genres',
  'disciplines.ece_domains',
  'education_levels.ece_ages'
];
//
// buildFacetFilter - build the facet filter string
//  skip - a list of facets to NOT include in the filter string generation.  This is used to prevent clicking on a facet value from removing other facets from the list in it's own grouping.
//
//  returns: the facet filter string fragment
//
function buildFacetFilter(skip) {
  //
  // Build the filter statement, filtering on selected values if any.
  // Start by recording the selected facet values
  //
  var filter = "";
  for (var item in KEY_FACETS) {  // loop over the facets of interest
    if (KEY_FACETS.hasOwnProperty(item) && // make sure this is a real property
      KEY_FACETS[item].supported) { // if the facet is supported

      var theClass = KEY_FACETS[item].class.substr(1,KEY_FACETS[item].class.length);
      if ($.inArray(theClass, skip) !== -1) continue; // skip adding this facet to the filter if a skip was requested

      KEY_FACETS[item].checked = []; // clear the list
      //
      // loop over the check boxes and record those that are checked
      //
      $(KEY_FACETS[item].class + ' input[type=checkbox]').each(function () {
        if (this.checked) {
          KEY_FACETS[item].checked.push($(this).val());
        }
      });
      //
      // if there are filters on this facet, build the search string
      //
      if (KEY_FACETS[item].checked.length === 1) {  // one value for this facet - use a straight "EQ"
        //
        // most items use the facet.GUID for lookup but if it is asset type, use "asset_type"
        //
        if (item === 'asset_types') {
          filter += "asset_type EQ '" + KEY_FACETS[item].checked[0] + "' AND ";
        } else if (KEY_FACETS[item].custom) { // custom facets have a direct value - not a guid
          filter += item + " EQ '" + KEY_FACETS[item].checked[0] + "' AND ";          
        } else {
          filter += item + ".guid EQ '" + KEY_FACETS[item].checked[0] + "' AND ";
        }
      } else if (KEY_FACETS[item].checked.length > 1) { // multiple values - use the IN operation
      
        var list = '';
        for (var i=0; i < KEY_FACETS[item].checked.length; i++) {
          list += "'" + KEY_FACETS[item].checked[i] + "',";
        }
        //
        // most items use the facet.GUID for lookup but if it is asset type, use "asset_type"
        //
        if (item === 'asset_types') {
          filter += "asset_type IN (" + list.substr(0,list.length-1) + ") AND ";
        } else if (KEY_FACETS[item].custom) { // custom facets have a direct value - not a guid
          filter += item + " IN (" + list.substr(0,list.length-1) + ") AND ";          
        } else {
          filter += item + ".guid IN (" + list.substr(0,list.length-1) + ") AND ";
        }
      }
    }
  }
  
  return filter;
}
//
// identifyFacets - determine what facets are supported for this account in AB Connect
//
function identifyFacets() {
  //
  // construct the URL to retreive the facets
  //
  var sourceUrl = ASSETS_URL + '?limit=0&facet_summary=*';
  
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
        recordSupportedFacets(data);
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
            alert(`Error identifying facets. ${xhr.responseText}`);
        } 
      } 
    } 
  ); 
}
//
// recordSupportedFacets - determine what facets are supported by this account
//
//  data - AJAX response
//
function recordSupportedFacets(data) {
  //
  // Prep the data structure with some properties needed for implementation but not for the structure setup/configuration - namely supported and checked.
  //
  for (var facet in KEY_FACETS) {
    if (!KEY_FACETS.hasOwnProperty(facet)) continue; // skip non-facets
    
    if (KEY_FACETS[facet].supported === undefined) { // if "supported" wasn't defaulted initially, set it to false
      KEY_FACETS[facet].supported = false;
    }
    if (KEY_FACETS[facet].checked === undefined) { // if the default check list wasn't defined, create an empty array
      KEY_FACETS[facet].checked = [];
    }
    if (KEY_FACETS[facet].custom === undefined) { // if the "custom facet" indicator wasn't defined, set it to false
      KEY_FACETS[facet].custom = false;
    }
  }
  //
  // if there are no assets, be straight with the user. Otherwise they get a page with no facets and nothing really to do and it is confusing
  //
  if (data.meta.count === 0) {
    alert("There are no assets in your account yet so there is nothing to show.");
  }
  //
  // loop over facet types and if the provider has configured facets and they appear in our list, mark the facets as supported
  //
  for (var i=0; i < data.meta.facets.length; i++) {
    if (KEY_FACETS[data.meta.facets[i].facet]) { // it is one of the facets of interest - note that it is supported
      KEY_FACETS[data.meta.facets[i].facet].supported = true;
    }
  }
  //
  // build the supported facet groups
  //
  var body = '';
  for (var i=0; i < FACET_WIDGET_ORDER.length; i++) {
    var item = FACET_WIDGET_ORDER[i];

    if (KEY_FACETS.hasOwnProperty(item) && // make sure this is a real property
      !KEY_FACETS[item].supported) { // if the facet is not supported
      continue; // skip it
    }
    //
    // Build the facet markup
    //
    var className = KEY_FACETS[item].class.substr(1,KEY_FACETS[item].class.length)
    body += `
      <div class="${className}">
        <details>
            <summary>
                <ul>
                    <li class="titleName">${KEY_FACETS[item].title}</li>
                    <li></li>
                </ul>
            </summary>
            <div>
              <div class="content more">
                  <p>Result not found</p>
              </div>
            </div>
        </details>
      </div>`;
  }
  $('.facetArea').html(body);

  loadFacets();
}
//
// loadFacets - pull the facet data that populates the lists.
//
function loadFacets() {
  //
  // construct the URL to retreive the facets
  //
  var sourceUrl = ASSETS_URL + '?limit=0' + buildFilter();
  //
  // request the relevant facets
  //
  var facet = '&facet=';
  var summary = '&facet_summary=';
  for (var item in KEY_FACETS) {        // loop over the facets of interest
    if (KEY_FACETS.hasOwnProperty(item) &&  // make sure this is a real property
      KEY_FACETS[item].supported ) {    // the facet is supported by the asset class
      
      facet += item + ',';          // add this facet to the list
      summary += item + ',';        // add this facet to the list
    }
  }

  sourceUrl += facet.substr(0, facet.length-1) + summary.substr(0, summary.length-1); // record the facets (dropping the trailing comma)
  
  sourceUrl += authenticationParameters(); // do the auth bit
  //
  // request the data
  //
  $('.overlay').show();
  $.ajax(
    { 
      url: sourceUrl,
      crossDomain: true, 
      dataType: 'json', 
      tryCount: 0, 
      retryLimit: RETRY_LIMIT,
      success: function(data,status)
        {
        populateFacets(data);
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
            alert(`Error loading facets from AB Connect. ${xhr.responseText}`);
        } 
      } 
    } 
  ); 
}
//
// populateFacets - function to load the facet lists to the UI
//
//  data - AJAX response
//
function populateFacets(data) {
  //
  // loop over facet types and act on those that have data.
  //
  for (var i=0; i < data.meta.facets.length; i++) {
    
    if (KEY_FACETS[data.meta.facets[i].facet] && data.meta.facets[i].details) { // it is one of the supported facets
      //
      // Now load the list with the elements
      //
      populateFacetList(KEY_FACETS[data.meta.facets[i].facet].class, data.meta.facets[i].details, KEY_FACETS[data.meta.facets[i].facet].checked);
    }
  }
  $('.overlay').hide();
}
//
// populateFacetList - function to load a single facet list in the UI
//
//  list - the name of the list being loaded
//  values - the facet values for this list 
//  selected - list of selected items - re-check them when we run across them
//
function populateFacetList(list, values, selected) {
  
  var checks = $(list + ' .content'); // get the list of facet options (body of the div holding checkboxes)
  checks.empty(); // make sure the list is empty
  //
  // if there are no choices, hide the facet class
  //
  if (values.length < 2) {
    $(list).hide();
  } else {
    $(list).show(); // otherwise make sure you can see the list
  }
  //
  // if there are no options at all, we are done.  If there is one or more, we continue on
  //
  if (values.length === 0) return;
  //
  // build a hash of the selected values to support quick lookup
  //
  var lookupSelected = {};
  for (var i=0; i < selected.length; i++) {
    lookupSelected[selected[i]] = true;
  }
  //
  // Sort the values - note that this is facet type specific
  //
  values.sort(facetComparator(list));
  //
  // Loop over the facet values and add them to the supplied list.
  //
  for (var i=0; i < values.length; i++) {
    var label = values[i].data.descr; // most facets have their readable label in the descr of the list object
    var id = values[i].data.guid;
    var count = values[i].count;
    
    if (!label) {
      if (values[i].data.asset_type) {// special handling for asset type which doesn't have a GUID and the label is called asset_type
        label = values[i].data.asset_type;
      } else {      // special handling for custom facets which just have a "data" which is both label and value
        label = values[i].data;
      }
      id = label;
    }
    
    var checked = '';
    if (lookupSelected[id]) checked = 'checked'; // if this one is in the selection list, reselect it
    
    checks.html(checks.html() + `
      <div class="mdc-form-field">
        <div class="mdc-checkbox">
          <input type="checkbox"
                 id="${id}"
                 value="${id}"
                 class="mdc-checkbox__native-control"
                 onchange="updateDisplay();" ${checked}/>
          <div class="mdc-checkbox__background">
            <svg class="mdc-checkbox__checkmark"
                 viewBox="0 0 24 24">
              <path class="mdc-checkbox__checkmark__path"
                    fill="none"
                    stroke="white"
                    d="M1.73,12.91 8.1,19.28 22.79,4.59"/>
            </svg>
            <div class="mdc-checkbox__mixedmark"></div>
          </div>
        </div>

        <label for="${id}" title="${label}(${count})">${label}(${count})</label>
      </div>`);
  }
  
}
//
// facetComparator - function generator to compare the proper properties to sort the facets
//  list - list class name
//  returns - the comparator of choice
//
function facetComparator(list) {
    if (list === '.grades') { // sort grades by seq
      return function(a, b) {
        return (a.data.seq - b.data.seq);
      }
      
    } else if (list === '.types') { // sort by asset_type
      return function(a, b) {
        //
        // workaround for an issue with consumer/owner facets #AC-1583
        //
        let aa = a.data.asset_type;
        if (!aa) aa = a.data;
        let bb = b.data.asset_type;
        if (!bb) bb = b.data;
        var upperA = aa.toUpperCase();
        var upperB = bb.toUpperCase();
        if (upperA < upperB) return -1;
        else if (upperA > upperB) return 1;
        else return 0;
      }
      
    } else { // everything else is sorted alphabetically by descr
      return function(a, b) {
        var upperA;
        var upperB;
        if (a.data.descr !== undefined) { // built in facets are objects with descriptions
          upperA = a.data.descr.toUpperCase();
          upperB = b.data.descr.toUpperCase();
        } else {                          // custom facets are simple data lists
          upperA = a.data.toUpperCase();
          upperB = b.data.toUpperCase();
        }
        if (upperA < upperB) return -1;
        else if (upperA > upperB) return 1;
        else return 0;
      }
    }
}
//
// setup listeners on all of the list expanders
//
$(document).ready(function() {
  var summary = $('summary');
  for(var i = 0; i < summary.length; i++) {
    summary[i].addEventListener('click', setSize, true);
  }
});
//
// setSize - set the size of the facet panel - we cap it at 10 items and a more... link
//
function setSize() {
  var details = $(this).closest('details').get(0);
  
  if (details.open) {
    return; // bail out if the panel is going to close
  }
  
  var content = $(details).find('.content');
  
  var length = content.find('.mdc-form-field').length;
  if(length > 10) {
    const MORE_TEXT = "More...";
    const LESS_CLASS = 'less';

    var dup = content.find('.mdc-form-field:eq(0)').clone().css('display', 'none');
    $('body').append(dup);
    var height = dup.height(); // get the height of a line
    dup.remove();
    
    var dup = content.clone().css('display', 'none');
    $('body').append(dup);
    var contentHeight = dup.height(); // get the height of the content
    dup.remove();

    if (!$(details).find(".morelink").hasClass(LESS_CLASS)) { // if this is not expanded to the full set,
      content.height(10*height); // show only ten lines
    }
    
    if(!content.next().hasClass("morelink")) { // if we haven't setup the morelink yet, do it
      content.after('<a href="" class="morelink">' + MORE_TEXT + '</a>'); // add the more... link
      content.parent().find(".morelink").click(function(){
        if($(this).hasClass(LESS_CLASS)) {
          $(this).removeClass(LESS_CLASS);
          $(this).html(MORE_TEXT);
          $(this).prev().height(10*height);
        } else {
          $(this).addClass(LESS_CLASS);
          $(this).html("Less...");
          $(this).prev().height(contentHeight);
        }
        return false;
      });
    }
  }
}
//
// updateFacetWidgetCounts - update the facet counts on this widget
//  group - the facet widget being updated
//
function updateFacetWidgetCounts(group) {
  if (!$('.' + group).is(':visible')) return; // skip out if the facet group isn't displayed (not supported, etc.)
  //
  // construct the URL to retreive the facets
  //
  var sourceUrl = ASSETS_URL + '?limit=0' + buildFilter([group]);
  //
  // request the relevant facets
  //
  var facet = '&facet=';
  var summary = '&facet_summary=';
  var facetName = '';
  for (var item in KEY_FACETS) {        // loop over the facets of interest
    if (KEY_FACETS.hasOwnProperty(item) &&  // make sure this is a real property
      KEY_FACETS[item].class === ('.' + group)) { // this is the facet of interest
      
      if (!KEY_FACETS[item].supported) return; // skip out if the facet group isn't supported
      
      facet += item;        // add this facet to the list
      summary += item;        // add this facet to the list
      facetName = item;
      break;
    }
  }

  sourceUrl += facet + summary; // record the facets
  
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
        setFacetCount(data, group, facetName);
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
            alert(`Error updating the facet counts from AB Connect. ${xhr.responseText}`);
        } 
      } 
    } 
  ); 
}
//
// setFacetCount - update the facet counts on the specified widget
//  data - the API response
//  group - the facet widget being updated
//  facetName - the name of the facet field
//
function setFacetCount(data, group, facetName) {
  var checks = $('.' + group + ' .mdc-form-field');
  for (var i=0; i < checks.length; i++) {
    //
    // search the metadata for the matching value count
    //
    var checkBox = $(checks[i]).find(':checkbox');
    var count = findFacetCount(data, checkBox.attr('id'), facetName);
    //
    // disable the checkbox if the matching count is 0
    //
    if (count === 0) {
      $(checks[i]).addClass('disabledDiv');
    } else {
      $(checks[i]).removeClass('disabledDiv');
    }
    //
    // update the label with the count
    //
    var label = $(checks[i]).find('label');
    var labelName = label.text();
    labelName = labelName.replace(/\(\d+\)$/, ''); // strip the previous count (if any)
    labelName += '(' + count + ')'; // put the new in there
    label.text(labelName);
    label.attr('title', labelName);
  }
}
//
// findFacetCount - find the count of assets for the specified value of the specified facet
//  data - the API response
//  ID - item to locate counts for
//  facetName - the name of the facet field
//
//  returns the count of assets that match the facet value
//
function findFacetCount(data, ID, facetName) {
  //
  // Note if this is a custom facet for special processing
  //
  var bCustom = false;
  if (KEY_FACETS.hasOwnProperty(facetName) &&
      KEY_FACETS[facetName].custom) {
    bCustom = true;
  }
  //
  // loop over the returned facets until we find the one we are looking for
  //
  for (var i=0; i< data.meta.facets.length; i++) {
    var facet = data.meta.facets[i];
    //
    // loop over the facet values until we find the one we are looking for
    //
    if (facet.facet === facetName) {
      for (var j = 0; j < facet.details.length; j++) {
        var object = facet.details[j];
        //
        // we found the value we need:
        //
        if (facetName === 'asset_types') {
          // workaround for an issue with consumer/owner facets #AC-1583
          if (object.data.asset_type) {
          if (object.data.asset_type === ID) {
            return object.count; // return it
            }
          } else if (object.data) {
            if (object.data === ID) {
              return object.count; // return it
            }
          }
        } else if (bCustom) {
          if (object.data === ID) {
            return object.count; // return it
          }
        } else {
          if (object.data.guid === ID) {
            return object.count; // return it
          }
        }
      }
      break;
    }
  }
  return 0; // if it isn't there, it is 0
}