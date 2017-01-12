const HOST = 'https://api.academicbenchmarks.com'
const ASSETS_URL = HOST + "/rest/v4/assets";
var gPartnerID = null;
var gSignature = null;
var gAuthExpires = null;

var gKeyFacets = {
	'disciplines.subjects': { // key is facet name, value is an object with properties
		'class': '.subjects', // matching HTML element class
		'supported': false,	// supported (true if this account supports said facet)
		'checked': []	// list of checked facet values
	},
	'disciplines.strands': {
		'class': '.strands',
		'supported': false,
		'checked': []
	},
	'disciplines.genres': {
		'class': '.genres',
		'supported': false,
		'checked': []
	},
	'disciplines.ece_domains': {
		'class': '.domains',
		'supported': false,
		'checked': []
	},
	'asset_types': {
		'class': '.types',
		'supported': false,
		'checked': []
	},
	'education_levels.grades': {
		'class': '.grades',
		'supported': false,
		'checked': []
	},
	'education_levels.ece_ages': {
		'class': '.ages',
		'supported': false,
		'checked': []
	}
};

jQuery.support.cors = true;
//
// identifyFacets - determine what facets are supported for this customer
//
function identifyFacets() {
	//
	// construct the URL to retreive the facets
	//
	var sourceUrl = ASSETS_URL + '?limit=0';
	
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
		success: function(data,status)
			{
			recordSupportedFacets(data);
			},
		error: function(req, status, error)
			{
			alert(error);
			}
		}
	);
}
//
// recordSupportedFacets - determine what facets are supported by this account
//
//	data - AJAX response
//
function recordSupportedFacets(data) {
	//
	// if there are no assets, be straight with the user. Otherwise they get a page with no facets and nothing really to do and it is confusing
	//
	if (data.meta.count === 0) {
		alert("There are no assets in your account yet so there is nothing to show.");
	}
	//
	// loop over facet types and note the supported ones
	//
	for (var i=0; i < data.meta.facets.length; i++) {
		if (gKeyFacets[data.meta.facets[i].facet]) { // it is one of the facets of interest - note that it is supported
			gKeyFacets[data.meta.facets[i].facet].supported = true;
		}
	}
	//
	// hide the unsupported facet groups
	//
	for (var item in gKeyFacets) {	// loop over the facets of interest
		if (gKeyFacets.hasOwnProperty(item) && // make sure this is a real property
			!gKeyFacets[item].supported) { // if the facet is not supported, hide it
			$(gKeyFacets[item].class).hide();
		}
	}

	loadFacets();
}
//
// loadFacets - pull the facet data that populates the lists.
//
function loadFacets() {
	//
	// construct the URL to retreive the facets
	//
	var sourceUrl = ASSETS_URL + '?limit=0' + buildFacetFilter();
	//
	// request the relevant facets
	//
	var facet = '&facet=';
	for (var item in gKeyFacets) {				// loop over the facets of interest
		if (gKeyFacets.hasOwnProperty(item) && 	// make sure this is a real property
			gKeyFacets[item].supported ) {		// the facet is supported by the asset class
			
			facet += item + ','; 				// add this facet to the list
		}
	}

	sourceUrl += facet.substr(0, facet.length-1); // record the facets (dropping the trailing comma)
	
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
		success: function(data,status)
			{
			populateFacets(data);
			},
		error: function(req, status, error)
			{
			alert(error);
			}
		}
	);
}
//
// populateFacets - function to load the facet lists to the UI
//
//	data - AJAX response
//
function populateFacets(data) {
	//
	// loop over facet types and act on those that have data.
	//
	for (var i=0; i < data.meta.facets.length; i++) {
		
		if (gKeyFacets[data.meta.facets[i].facet] && data.meta.facets[i].details) { // it is one of the supported facets
			//
			// First we sort the elements - do it alphabetically for now.  TODO: put facet specific sort logic in here - alpha for all but grades - use seq or code?
			//
			data.meta.facets[i].details.sort(function(a,b) {
					if (a.data.descr < b.data.descr)
						return -1;
					if (a.data.descr > b.data.descr)
						return 1;
					return 0;
				});
			//
			// Now load the list with the elements
			//
			populateList(gKeyFacets[data.meta.facets[i].facet].class, data.meta.facets[i].details, gKeyFacets[data.meta.facets[i].facet].checked);
		}
	}
}
//
// populateList - function to load a single facet list in the UI
//
//	list - the name of the list being loaded
//	values - the facet values for this list 
//	selected - list of selected items - re-check them when we run across them
//
function populateList(list, values, selected) {
	
	var checks = $(list + ' .checks'); // get the list of facet options (body of the div holding checkboxes)
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
	// Loop over the facet values and add them to the supplied list.
	//
	for (var i=0; i < values.length; i++) {
		var label = values[i].data.descr;	// most facets have their readable label in the descr of the list object
		var id = values[i].data.guid;
		var count = values[i].count;
		
		if (!label && // special handling for asset type which doesn't have a GUID and the label is called asset_type
			values[i].data.asset_type) {
				
			label = values[i].data.asset_type;
			id = label;
		}
		
		var checked = '';
		if (lookupSelected[id]) checked = 'checked'; // if this one is in the selection list, reselect it
				
		checks.html(checks.html() + '<label><input type="checkbox" value="' + id + '" onchange="loadAssets();" ' + checked +
			'>' + label + '(' + count + ')</label>'); // add the item to the list
	}
}
//
// buildFacetFilter - build the facet filter string
//
//	returns: the facet filter string ready to be added to the end of the URL
//
function buildFacetFilter() {
	//
	// Build the filter statement, filtering on selected values if any.
	// Start by recording the selected facet values
	//
	var filter = "";
	for (var item in gKeyFacets) {	// loop over the facets of interest
		if (gKeyFacets.hasOwnProperty(item) && // make sure this is a real property
			gKeyFacets[item].supported) { // if the facet is supported

			gKeyFacets[item].checked = []; // clear the list
			//
			// loop over the check boxes and record those that are checked
			//
			$(gKeyFacets[item].class + ' input[type=checkbox]').each(function () {
				if (this.checked) {
					gKeyFacets[item].checked.push($(this).val());
				}
			});
			//
			// if there are filters on this facet, build the search string
			//
			if (gKeyFacets[item].checked.length === 1) {	// one value for this facet - use a straight "EQ"
				//
				// most items use the facet.GUID for lookup but if it is asset type, use "asset_type"
				//
				if (item === 'asset_types') {
					filter += "asset_type EQ '" + gKeyFacets[item].checked[0] + "' AND ";					
				} else {
					filter += item + ".guid EQ '" + gKeyFacets[item].checked[0] + "' AND ";
				}
			} else if (gKeyFacets[item].checked.length > 1) {	// multiple values - use the IN operation
			
				var list = '';
				for (var i=0; i < gKeyFacets[item].checked.length; i++) {
					list += "'" + gKeyFacets[item].checked[i] + "',";
				}
				//
				// most items use the facet.GUID for lookup but if it is asset type, use "asset_type"
				//
				if (item === 'asset_types') {
					filter += "asset_type IN (" + list.substr(0,list.length-1) + ") AND ";
				} else {
					filter += item + ".guid IN (" + list.substr(0,list.length-1) + ") AND ";
				}
			}
		}
	}
	//
	// if there is anything in the search field, add it to the filter criteria
	//
	var search = $('.search');
	if (search.val().length > 0) {
		var text = search.val().replace(/\W/g, ''); // prevent naughtiness - only allow alphanums
		filter += "query('" + text + "') AND "
	}
	//
	// if there was any criteria, add the proper argument formatting
	//
	if (filter) {
		filter = '&filter[assets]=(' + encodeURIComponent(filter.substr(0,filter.length-5)) + ')';
	}
	
	return filter;
}
//
// selectAsset - load the details section of the screen with the selected node details
//
function selectAsset() {
	//
	// Get the current selected asset
	//
	var GUID = $( "select.assetList option:selected").val()
	//
	// Let's start simple and just dump the JSON in pretty format
	//	
	var jsonPretty = syntaxHighlightResponse(gAssets[GUID]); // prettify the JSON of the standard
	
	$('.details').html(jsonPretty); // update the details div with the content
}
//
// loadAssets - pull the related assets.  Note that we skip this if there are no filter criteria to avoid overload
//
var gAssets = {}; // the cache of assets so we can populate the details
function loadAssets() {
	$('.details').empty(); // clear the assets details
	var list = $( "select.assetList");
	list.empty(); // clear the list

	var facetFilter = buildFacetFilter();
	if (facetFilter.length === 0) return; // bail if no one has selected filter criteria yet
	//
	// construct the URL to retreive the assets
	//
	var sourceUrl = ASSETS_URL + '?limit=100' + facetFilter;

	logCall(sourceUrl); // dump URLs to the console to make it easy to see the calls when learning the API
	
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
			populateAssets(data, list);
			},
		error: function(req, status, error)
			{
			alert(error);
			}
		});
}
//
// populateAssets - load the assets list - note that this function supports paging so the system doesn't totally die on large queries.
//	Therefore it is recursive (in a way)
//
//		data - AJAX response
//		list - the asset list object
//
function populateAssets(data, list) {
	
	if (data.data.length === 0) { // nothing to display
		return;
	}
	//
	// Loop over the assets, construct the label and add them to the supplied list
	//
	for (var i=0; i < data.data.length; i++) {
		gAssets[data.data[i].id] = data.data[i]; // cache this asset for later reference
		//
		// the line format is "<ID> <title>"
		//
		var label = data.data[i].attributes.client_id + ': ' + data.data[i].attributes.title;
				
		list.append($("<option />").val(data.data[i].id).text(label));
	}
	//
	// if we are at the end of the list, bail out.
	//
	if (!data.links.next) return;
	//
	// there are more assets to retrieve - load the next page
	//
	var sourceUrl = data.links.next;
	logCall(sourceUrl); // dump URLs to the console to make it easy to see the calls when learning the API

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
			populateAssets(data,list);
			},
		error: function(req, status, error)
			{
			alert(error);
			}
		});
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
// authenticate - build the required credentials and load the page
//
function authenticate() {
	if (gSignature) return; // if you enter the partner info and then click on another partner info field, it loads.  If you then click on anything, it can whack the UI, so we skip re-auth if it was done already.
	
	gPartnerID = $('.partnerID').val().trim();
	var partnerKey = $('.partnerKey').val().trim();
	
	if (gPartnerID.length === 0 || // we are still missing something
		partnerKey.length === 0) {
		return;
	}
	gAuthExpires = Math.floor(Date.now() / 1000) + 86400; // 1 day lifespan (in seconds) note that "gAuthExpires" is in seconds, not milliseconds
	//
	// Build the signature
	//
	var message = '' + gAuthExpires + "\n";
	//
	// Build the token
	//
	var hash = CryptoJS.HmacSHA256(message, partnerKey);
	gSignature = CryptoJS.enc.Base64.stringify(hash);
	
	identifyFacets();
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
//	Arguments:
//		URL - the call
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
//	Arguments:
//		json - AJAX response
//
//	Response: HTML pretified JSON
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
