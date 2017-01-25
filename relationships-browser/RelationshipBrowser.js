const HOST = 'https://api.academicbenchmarks.com'
const STANDARDS_URL = HOST + "/rest/v4/standards";
const TOPICS_URL = HOST + "/rest/v4/topics";
const DETAILS_LABEL_REL = 'Details of Related Standard';
const LIST_NAME = {
	".authority": "Authority",
	".publication": "Publication",
	".doc": "Subject",
	".section": "Section",
	".dest_authority": "Authority",
	".dest_publication": "Publication",
	".dest_doc": "Subject"
};
var gPartnerID = null;
var gSignature = null;
var gAuthExpires = null;
var gTopicsLicensed = false;
var gRelationshipsLicensed = false;
var gGradeFilter = false;

jQuery.support.cors = true;
//
// Create the core tree object
//
var gEasyTree = $('.tree').easytree({
	openLazyNode: openLazyNode,
	stateChanged: stateChanged
});
//
// loadFacets - pull the facet data that populates the drop down list.  This same code is used for the "source" standards and the "related"
//	standards.
//
//	listName - name of the list to be loaded
//
function loadFacets(listName) {
	//
	// determine which set of lists we are dealing with - source or related
	//
	var listDef = determineListDef(listName);
	//
	// construct the URL to retreive the facets
	//
	var sourceUrl = STANDARDS_URL + '?limit=0';
	//
	// build the filter statement, filtering on selected values if any.  Here we add filters depending on how deep
	// into the set of filters we are.  E.g. subject is deeper than publication.  We add the filter criteria on the
	// left for data that populates the right.
	//
	var filter = "";
	if (listName !== listDef.AUTH_WIDGET) {	// the widget is not the authority widget - so add authority to the filter criteria - i.e. only publications under this authority will appear
		var authority = $( "select." + listDef.AUTH_WIDGET + " option:selected").val();
		if (authority) {
			filter = "document.publication.authorities.guid EQ '" + authority + "'";
		}
		if (listName !== listDef.PUB_WIDGET) { // we are not working with the publication either, so add publication to the filter criteria - i.e. only subjects under this publication appear
			var publication = $( "select." + listDef.PUB_WIDGET + " option:selected").val();
			if (publication) {
				if (filter) {
					filter += ' AND '
				}
				filter += "document.publication.guid EQ '" + publication + "'";
			}
			if (listName !== listDef.DOC_WIDGET) { // subject (actually, document - it is the subject/year combination)
				var doc = $( "select." + listDef.DOC_WIDGET + " option:selected").val();
				if (doc) {
					if (filter) {
						filter += ' AND '
					}
					filter += "document.guid EQ '" + doc + "'";
				}
			}
		}
	}
	if (filter) {
		sourceUrl += '&filter[standards]=(' + encodeURIComponent(filter) + ')';
	}
	//
	// unselect dependent lists that are no longer valid and determine what data we want back
	// note that we always request everything downstream from the select box that was changed
	//
	var facet = '&facet=';
	//
	// Note that there is no "section" for the related standards list - this was a choice so it would show relationships across
	// courses or grades.  So only add the section facet into the list if we are working with the source standards.
	//
	if (listDef.bSource) {
		facet += 'section,'; // add the section to the facet list
		$( "select.section option:selected").removeAttr('selected'); // unselect whatever was selected
		$('select.section').empty(); // clear out the list
        $('select.section').prop('disabled', 'disabled'); // disable the list until it is repopulated with accurate data
		}
	//
	// When requesting facets, the logic is basically the opposite of the filter logic - start at the bottom and work your way up
	//
	if (listName !== 'section') { // we are higher than the section - request the document facets
		facet += 'document,'; // add the document to the facet list
		$( "select." + listDef.DOC_WIDGET + " option:selected").removeAttr('selected');  // unselect whatever was selected
		$('select.' + listDef.DOC_WIDGET).empty(); // clear out the list
        $('select.' + listDef.DOC_WIDGET).prop('disabled', 'disabled'); // disable the list until it is repopulated with accurate data
		if (listName !== listDef.DOC_WIDGET) { // we are higher than the document list
			facet += 'document.publication,';  // add the publication to the facet list
			$( "select." + listDef.PUB_WIDGET + " option:selected").removeAttr('selected'); // unselect whatever was selected
			$('select.' + listDef.PUB_WIDGET).empty();  // clear out the list
			$('select.' + listDef.PUB_WIDGET).prop('disabled', 'disabled'); // disable the list until it is repopulated with accurate data
			if (listName !== listDef.PUB_WIDGET) { // we only get here for authorities - since this only happens on initial load, we don't need to clear the drop down, but we need to make sure we are requesting the facet
				facet += 'document.publication.authorities,';
			}
		}
	}
	sourceUrl += facet.substring(0,facet.length-1); // record the facets
	
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
			PopulateFacets(data, listDef);
			},
		error: function(req, status, error)
			{
			alert(error);
			}
		}
	);
	
	if (listDef.bSource) loadSection(); // load the tree or clear it
}
//
// lookupAncestors - If a descendent is selected (like a section) and parents aren't selected yet, get the parents
//	and select them so the lists are smart
//
//	listName - name of the list to be loaded
//
function lookupAncestors(listName) {
	//
	// determine which set of lists we are dealing with
	//
	var listDef = determineListDef(listName);
	//
	// construct the URL to retreive the facets
	//
	var sourceUrl = STANDARDS_URL + '?limit=0';
	//
	// build the filter statement, filter on the selected list
	//
	var filter;
	var facet;
	switch(listName) {
		case listDef.PUB_WIDGET: // we are working with the publication
			var publication = $( "select." + listDef.PUB_WIDGET + " option:selected").val(); // grab the current publication
			filter = "document.publication.guid EQ '" + publication + "'"; // add it to the filter criteria
			facet = 'document.publication.authorities'; // ask for the parent in the facets
			break;
		case listDef.DOC_WIDGET: // we are working with the document (subject/year)
			var doc = $( "select." + listDef.DOC_WIDGET + " option:selected").val(); // grab the current document
			filter = "document.guid EQ '" + doc + "'"; // add it to the filter criteria
			facet = 'document.publication.authorities,document.publication'; // ask for the parents in the facets
			break;
		case 'section': // we are working with the section (course/grade)
			var section = $( "select.section option:selected").val(); // grab the current section
			filter = "section.guid EQ '" + section + "'";  // add it to the filter criteria
			facet = 'document.publication.authorities,document.publication,document'; // ask for the parents in the facets
			break;
	}
	//
	// construct the remainder of the URL
	//
	sourceUrl += '&facet=' + facet + '&filter[standards]=(' + encodeURIComponent(filter) + ')';

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
			SelectAncestors(data, listDef);
			},
		error: function(req, status, error)
			{
			alert(error);
			}
		}
	);
}
//
// SelectAncestors - Select the ancestor list values based on the response.  Since the request facets only included the parents
//	we use the existance of the facet data to key on what lists to select.  Note at this point, each requested facet should only have one
//	value
//
//	data - AJAX response
//	listDef - the definition of the lists we are working with
//
function SelectAncestors(data, listDef) {
	//
	// loop over facet types and act on those that have data.  Since downstream data isn't requested
	// we only process the data we receive on any given call.
	//
	for (var i=0; i < data.meta.facets.length; i++) {
		if (data.meta.facets[i].facet === 'document.publication.authorities' && // we are working with the authority facet
			data.meta.facets[i].details) { // and data was returned
			//
			// locate the relevant list and select the proper list item
			//
			$('select.' + listDef.AUTH_WIDGET + ' option[value="' + data.meta.facets[i].details[0].data.guid + '"]').attr('selected', 'selected');
			
		} else if (data.meta.facets[i].facet === 'document.publication' &&  // we are working with the publcation and have data
			data.meta.facets[i].details) {
			//
			// locate the relevant list and select the proper list item
			//
			$('select.' + listDef.PUB_WIDGET + ' option[value="' + data.meta.facets[i].details[0].data.guid + '"]').attr('selected', 'selected');
			
		} else if (data.meta.facets[i].facet === 'document' && // we are working with the document and have data
			data.meta.facets[i].details) {
			//
			// locate the relevant list and select the proper list item
			//
			$('select.' + listDef.DOC_WIDGET + ' option[value="' + data.meta.facets[i].details[0].data.guid + '"]').attr('selected', 'selected');
		}
	}
	
	lockLabels();
}
//
// loadSection - Load the appropriate section information into the tree for browsing.  Note that we only load the top level items
// 		and then we lazy load the deeper branches and leaves to avoid the overhead of populating the full tree when it is unlikely anyone
// 		will open the entire tree.
//
var gSectionGUID = null; // the GUID of the section open in the tree - keep it around as we use it in several places.
function loadSection() {
	//
	// grab the current section from the list
	//
	var section = $( "select.section option:selected").val();
	//
	// if the section has changed, let's start by clearing it.
	//
	if (gSectionGUID != section) {
		//
		// empty the tree and rebuild it - there is no way to do this in one call with easytree
		//
		while (gEasyTree.getAllNodes().length > 0) {
			gEasyTree.removeNode(gEasyTree.getAllNodes()[0].id); // remove this node
		}
		gEasyTree.rebuildTree();
		//
		// clear any related data so we can reload as appropriate
		//
		gActiveNode = null; // forget about the active node in the tree
		gCurrentSourceStandard = null; // forget the ID of the standard in the detail view
		$( "select.relationshipList").empty(); // clear the related items list
		$('.details').empty(); // clear the standard details
	}
	//
	// Now if we have a section and it is new, let's load it
	//
	if (section &&
		gSectionGUID != section) {
		
		gSectionGUID = section; // remember the active section
		//
		// Populate the tree if there is enough data
		//
		var node = {};
		node.id = '';
		node.guid = false;
		openLazyNode(false, false, node, false);
	} else { // no section - clear the history
		gSectionGUID = null;
	}
}
//
// PopulateFacets - function to load the facet lists to the UI
//
//	data - AJAX response
//	listDef - the definition of the lists we are working with
//
function PopulateFacets(data, listDef) {
	//
	// loop over facet types and act on those that have data.  Since upstream data isn't requested
	// we only process the data we receive on any given call.
	//
	for (var i=0; i < data.meta.facets.length; i++) {
		
		if (data.meta.facets[i].facet === 'document.publication.authorities' && data.meta.facets[i].details) { // authorities
			//
			// First we sort the elements - in this case we do it alphabetically by name because that makes the most sense for the list of authorities
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
			PopulateList('.' + listDef.AUTH_WIDGET, $('.' + listDef.AUTH_WIDGET + ' option:selected').val(), data.meta.facets[i].details);
			
		} else if (data.meta.facets[i].facet === 'document.publication' && data.meta.facets[i].details) { // publication
			//
			// First we sort the elements - in this case we do it alphabetically by name
			//
			data.meta.facets[i].details.sort(function(a,b) {
					if (a.data.title < b.data.title)
						return -1;
					if (a.data.title > b.data.title)
						return 1;
					return 0;
				});
			//
			// Now load the list with the elements
			//
			PopulateList('.' + listDef.PUB_WIDGET, $('.' + listDef.PUB_WIDGET + ' option:selected').val(), data.meta.facets[i].details);
			
		} else if (data.meta.facets[i].facet === 'document' && data.meta.facets[i].details) { // document (subject/year)
			//
			// First we sort the elements - in this case we do it alphabetically by name, then by year
			//
			data.meta.facets[i].details.sort(function(a,b) {
					if (a.data.descr < b.data.descr)
						return -1;
					if (a.data.descr > b.data.descr)
						return 1;
					if (a.data.adopt_year < b.data.adopt_year)
						return -1;
					if (a.data.adopt_year > b.data.adopt_year)
						return 1;					
					return 0;
				});
			//
			// Now load the list with the elements
			//
			PopulateList('.' + listDef.DOC_WIDGET, $('.' + listDef.DOC_WIDGET + ' option:selected').val(), data.meta.facets[i].details);
			
		} else 
		if (data.meta.facets[i].facet === 'section' && data.meta.facets[i].details) {
			//
			// sort the sections by seq
			//
			data.meta.facets[i].details.sort(function(a,b) {
				return a.data.seq - b.data.seq;
				});
			//
			// Now load the list with the elements
			//
			PopulateList('.section', $('.section option:selected').val(), data.meta.facets[i].details);
		}
	}
}
//
// lockLabels - disable the label options so you can't go from a publication name back to "publication" which has no GUID (etc.)
//
function lockLabels() {
	if ($('.authority').prop('selectedIndex') > 0) $('.authority :nth-child(1)').attr('disabled', 'disabled'); // disable the "label" option
	if ($('.publication').prop('selectedIndex') > 0) $('.publication :nth-child(1)').attr('disabled', 'disabled'); // disable the "label" option
	if ($('.doc').prop('selectedIndex') > 0) $('.doc :nth-child(1)').attr('disabled', 'disabled'); // disable the "label" option
	if ($('.section').prop('selectedIndex') > 0) $('.section :nth-child(1)').attr('disabled', 'disabled'); // disable the "label" option
	if ($('.dest_authority').prop('selectedIndex') > 0) $('.dest_authority :nth-child(1)').attr('disabled', 'disabled'); // disable the "label" option
	if ($('.dest_publication').prop('selectedIndex') > 0) $('.dest_publication :nth-child(1)').attr('disabled', 'disabled'); // disable the "label" option
	if ($('.dest_doc').prop('selectedIndex') > 0) $('.dest_doc :nth-child(1)').attr('disabled', 'disabled'); // disable the "label" option
}
//
// PopulateList - function to load a single facet list in the UI
//
//		list - the name of the list being loaded
//		select - the specific option being selected
//		values - the facet values for this list 
//
function PopulateList(list, select, values) {
	$(list).empty(); // make sure the list is empty
	
	$(list).append($("<option />").val('').text(LIST_NAME[list])); // the first element is the name - it is not selectable (disabled)
	//
	// Loop over the facet values and add them to the supplied list.  Note that there is some logic here specific
	// to the AB Connect JSON API response format.
	//
	for (var i=0; i < values.length; i++) {
		var label = values[i].data.descr;	// most facets have their readable label in the descr of the list object
		if (values[i].data.adopt_year) {	// the document has and adoption year which is key for differentiating documents
			label += " (" + values[i].data.adopt_year + ")";
		}
		
		if (!label) {						// publications don't use descr.  Instead they have a title.  If we get here and we are missing the lable, it is a publication so use title
			label = values[i].data.title;
		}
		
		$(list).append($("<option />").val(values[i].data.guid).text(label)); // add the item to the list
	}
	$(list + ' option[value="' + select + '"]').attr('selected', 'selected'); // select the default value
	$(list).prop('disabled', false); // re-enable the list

	lockLabels();
}
//
// openLazyNode - open this branch in the standards tree when it is selected. If the data hasn't been loaded yet,
//		call AB Connect to get the data.
//
//		event - event in question (open)
//		nodes - node tree
//		node - selected node to open
//		hasChildren - true of the selected node already has children
//
function openLazyNode(event, nodes, node, hasChildren) {
	if (hasChildren) { // don't call ajax if lazy node already has children
		return false;
	}
	//
	// construct the URL to pull the children
	//
	var sourceUrl = STANDARDS_URL;
	//
	// if there is a parent node, add it's value to the query so it becomes the start point
	//
	if (node.guid) {
		sourceUrl += "?filter[standards]=(" + encodeURIComponent("parent.id eq '" + node.guid + "'") + ")"; // start from this standard
	} else { // no parent, grab the top of the section
		sourceUrl += "?filter[standards]=(" + encodeURIComponent("level eq '1' AND section.guid eq '" + gSectionGUID + "'") + ")"; // start from the top
	}
	sourceUrl += '&fields[standards]=statement,number,children,seq';

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
			PopulateNode(data, node);
			},
		error: function(req, status, error)
			{
			alert(error);
			}
		}
	);
}
//
// PopulateNode - function to load the branch in the tree with the children that came back from the AJAX call
//
//		data - AJAX response
//		node - node being populated
//
function PopulateNode(data, node) {
	//
	// sort the standards by seq
	//
	data.data.sort(function(a,b) {
		return a.attributes.seq - b.attributes.seq
	});
	//
	// loop over the responses
	//
	for (var i = 0; i < data.data.length; i++) {
		
		var standard = data.data[i]; // grab the data for this particular standard
		//
		// build the node
		//
		var child = {};
		var number = "";
		if (standard.attributes.number.raw) {
			number = standard.attributes.number.raw;
		}
		child.text = number + " " + standard.attributes.statement.descr; // The tree entry label is th standard number + descr
		//
		// set the folder status based on the children count
		//
		child.isFolder = standard.relationships.children.data.length > 0; // has children
		child.isLazy = child.isFolder;
		child.guid = standard.id;
		child.isExpanded = false;

		gEasyTree.addNode(child, node.id); // add the node to the tree
	}

	gEasyTree.rebuildTree();
}
//
// selectRelatedStandard - respond to a selection in the relationshipList
//
//		gActiveRelatedItem - last item selected.  If it hasn't changed, we don't do anything.  If it changed, 
//			we display the standards data in a pop-up. Otherwise do nothing.
//
var gActiveRelatedItem;
function selectRelatedStandard() {
	var currentItem = $( "select.relationshipList option:selected").val(); // get the standard that is selected (pull the GUID)
	//
	// if something was found, update the details section
	//
	if (currentItem) {
		//
		// They selected something - see if it is a new standard
		//
		if (gActiveRelatedItem != currentItem) {
			//
			// construct the URL to pull the details
			//
			var sourceUrl = STANDARDS_URL + '/' + currentItem +
				'?fields[standards]=statement,section,document,education_levels,disciplines,number,parent,utilizations';
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
				success: function(data,status)
					{
					PopulateDetails(data, DETAILS_LABEL_REL);
					},
				error: function(req, status, error)
					{
					alert(error);
					}
				}
			);
		}
	}
	gActiveRelatedItem = currentItem; // remember where we are
}
//
// stateChanged - make note of a change in state of the standards tree. If the change in state is a new standard selected,
//		we retrieve the standards and display the details.
//
//		nodes - complete list of nodes
//		nodesJSON - ditto (stored as JSON)
//
//	Uses:
//		gActiveNode - last node selected.  If it hasn't changed, we don't do anything.  If it changed,
//			we display the standards data in a pop-up. Otherwise do nothing.
//
var gActiveNode = null;
var gCurrentSourceStandard = null;
function stateChanged(nodes, nodesJson) {
	var currentNode = getActiveNode(nodes);
	//
	// if something was found, update the details section
	//
	if (currentNode) {
		//
		// They selected a new node
		//
		if (gActiveNode != currentNode) {
			//
			// construct the URL to pull the details
			//
			var sourceUrl = STANDARDS_URL + '/' + currentNode.guid +
				'?fields[standards]=statement,section,document,education_levels,disciplines,number,parent,utilizations';
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
				success: function(data,status)
					{
					PopulateDetails(data, 'Details of Source Standard');
					//
					// Retain the data so we can use it to lookup related standards when appropriate.
					// Then clear out the settings that the system uses to track if it is current on the siblings list so it forces an update of the list
					//
					gCurrentSourceStandard = data;
					//
					// update the grade selection if the filter is active
					//
					updateGrades();
					//
					// clear out the memory of the siblings list selection so it starts fresh
					//
					forceSiblingRefresh();
					
					gActiveNode = currentNode; // remember where we are
					},
				error: function(req, status, error)
					{
					alert(error);
					}
				}
			);
		}
	}
}
//
// getActiveNode - retrieve the selected node
//		NOTE: this is a recursive function
//
//	Arguments:
//		nodes - complete list of nodes
//
// Returns: the currently active node or null if none is found
//
function getActiveNode(nodes) {
	//
	// loop over the list of nodes
	//
	for (var i = 0; i < nodes.length; i++) {
		
		var node = nodes[i];
		
		if (node.isActive) { // found the active node - retrun it
			return node;
		}
		//
		// This node has children - recurse to check the list of children
		//
		if (node.children && node.children.length > 0) {
			
			node = getActiveNode(node.children);
			
			if (node) {
				return node;
			}
		}
	}
	return null; //nothing found - return
}
//
// PopulateDetails - load the details section of the screen with the selected node details
//
//	Arguments:
//		data - AJAX response
//		label - label for the details section
//
function PopulateDetails(data, label) {
	//
	// Let's start simple and just dump the JSON in pretty format
	//
	// set the label of the details section according to which set of standards we are referring to as both the tree and siblings list can have something selected at the same time.
	//
	$('.detailsTitle h1').text(label); 
	
	var jsonPretty = syntaxHighlightResponse(data); // prettify the JSON of the standard
	
	$('.details').html(jsonPretty); // update the details div with the content
}
//
// loadSiblings - pull the sibling standards
//
var gDestDoc = null;
var gRelationshipType = null;
var gLastStandardID = null;
function loadSiblings() {
	//
	// get the relationship type and destination doc
	//
	var destDoc = $( "select.dest_doc option:selected").val();
	var relationshipType = $( "select.relationship option:selected").val();
	//
	// bail if nothing has changed
	//
	if (gDestDoc === destDoc &&
		gRelationshipType === relationshipType &&
		(!gCurrentSourceStandard || gCurrentSourceStandard.data.id === gLastStandardID)) {
		return;
	}
	//
	// if the standards details display is related to the current sibling, clear it
	//
	if ($('.detailsTitle h1').text() === DETAILS_LABEL_REL) {
		$('.details').empty(); // clear the standard details
	}
	//
	// bail if we are missing a selection - make sure the list is empty
	//
	var list = $( "select.relationshipList");
	list.empty(); // clear the list
	if (!gCurrentSourceStandard || !destDoc || !relationshipType ||
		(relationshipType === 'Topic' && gCurrentSourceStandard.data.relationships.topics.data.length === 0) // the request is for siblings via topics and the current node doesn't have any Topics
		) {
		return;
	}
	//
	// remember the criteria of what we are displaying in the relationship list (siblings)
	//
	gDestDoc = destDoc;
	gRelationshipType = relationshipType;
	gLastStandardID = gCurrentSourceStandard.data.id;
	//
	// Retrieve the related standards based on the type specified in the relationship type drop down
	//
	var sourceUrl = STANDARDS_URL + '?fields[standards]=statement,number,seq,education_levels';
	//
	// build the filter statement based on the relationship type, the current selected source standard and the sibling document
	//
	var filter = '';
	switch(gRelationshipType) {
		case 'Peer':
			filter = "peers.id eq '" + gCurrentSourceStandard.data.id + "'";
			break;
		case 'Peer Derivative':
			filter = "peer_derivatives.id eq '" + gCurrentSourceStandard.data.id + "'";
			break;
		case 'Derivative':
			//
			// note the reverse logic here.  If you are looking for a derivative standard (one derived from the source standard), you need to look for standards
			// that have the source standard as it's origin.
			//
			filter = "origins.id eq '" + gCurrentSourceStandard.data.id + "'";
			break;
		case 'Origin':
			//
			// note the reverse logic here.  If you are looking for an origin standard, you need to look for standards
			// that have the source standard as it's derivative.
			//
			filter = "derivatives.id eq '" + gCurrentSourceStandard.data.id + "'";
			break;
		case 'Topic':
			//
			// Topics are a little more complex as the current standard may have multiple, so we have a list.  Note that some standards don't have topics but those should be caught above
			//
			for (var i=0; i<gCurrentSourceStandard.data.relationships.topics.data.length; i++) {
				filter += "'" + gCurrentSourceStandard.data.relationships.topics.data[i].id + "',"
			}
			filter = "topics.id in (" + filter.substring(0, filter.length-1) + ")";
			break;
	}
	//
	// if the grade filter box is checked, add it to the filter criteria
	//
	if (gGradeFilter) {
		var low = $('.lowGrade').val();
		var high = $('.highGrade').val();
		
		if (low === high) {
			filter += " AND education_levels.grades.code EQ '" + low + "'";
		} else {
			var listGrades = '';
			if (low === 'K') {
				listGrades = "'K',";
				low = 1;
			}
			for (var i=low; i<=high; i++) {
				listGrades += "'" + i + "',"
			}
			filter += 'AND education_levels.grades.code IN (' + listGrades + ")";
		}
	}
	
	sourceUrl += '&filter[standards]=(' + encodeURIComponent(filter + " and document.guid eq '" + gDestDoc + "'") + ')'; // limit by doc as well

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
			PopulateSiblings(data);
			},
		error: function(req, status, error)
			{
			alert(error);
			}
		});
}
//
// PopulateSiblings - load the siblings list
//
//	Arguments:
//		data - AJAX response
//
function PopulateSiblings(data) {
	var list = $( "select.relationshipList");
	
	if (data.data.length === 0) { // nothing to display
		return;
	}

	data.data.sort(function(a,b) { // sort standards by grade, number then sequence
			if (a.attributes.education_levels.grades[0].seq < b.attributes.education_levels.grades[0].seq) // use the lowest grade for sort order
				return -1;
			if (a.attributes.education_levels.grades[0].seq > b.attributes.education_levels.grades[0].seq)
				return 1;
			//
			// grades are the same - sort by number
			//
			if (a.attributes.number.enhanced < b.attributes.number.enhanced)
				return -1;
			if (a.attributes.number.enhanced > b.attributes.number.enhanced)
				return 1;
			//
			// numbers are the same (likely missing) - sort by seq
			//
			if (a.attributes.seq < b.attributes.seq)
				return -1;
			if (a.attributes.seq > b.attributes.seq)
				return 1;
			return 0;
		});
	//
	// Loop over the standards, construct the label and add them to the supplied list
	//
	for (var i=0; i < data.data.length; i++) {
		//
		// the line format is "Grades X,Y,Z: <number> <statement>"
		//
		var grades = '';
		for (var j=0; j < data.data[i].attributes.education_levels.grades.length; j++) { // accumulate the grades
			grades += data.data[i].attributes.education_levels.grades[j].code + ',';
		}
		var label = ''
		if (data.data[i].attributes.education_levels.grades.length > 1) { // branch on plurality
			label = 'Grades ';
		} else {
			label = 'Grade ';
		}
		label += grades.substring(0, grades.length-1) + ": ";
		//
		// add the number if one exists
		//
		if (data.data[i].attributes.number.enhanced.length > 0) {
			label += data.data[i].attributes.number.enhanced + ' ';
		}
		//
		// now the statement
		//
		label += data.data[i].attributes.statement.descr;
				
		list.append($("<option />").val(data.data[i].id).text(label));
	}
}
//
// determineListDef - determine which set of lists we are working with and return the names related to this set
//
//	Arguments:
//		listName - the name of one of the lists
//
//	Response: object.
//				bSource - true if we are dealing with the source standards lists
//				AUTH_WIDGET - name of the related widgets in the HTML
//				PUB_WIDGET
//				DOC_WIDGET
//
function determineListDef(listName) {
	var start = listName.substr(0,4);
	return getListDef(start != 'dest');
}
//
// getListDef - determine which set of lists we are working with and return the names related to this set
//
//	Arguments:
//		bSource - true if we are talking about the source standard lists
//
//	Response: object.
//				bSource - true if we are dealing with the source standards lists
//				AUTH_WIDGET - name of the related widgets in the HTML
//				PUB_WIDGET
//				DOC_WIDGET
//
function getListDef(bSource) {
	var obj = {};
	obj.bSource = bSource; // bSource is true if the lists in question are the source standard lists
	
	if (obj.bSource) {
		obj.AUTH_WIDGET = "authority";
		obj.PUB_WIDGET = "publication";
		obj.DOC_WIDGET = "doc";
	} else {
		obj.AUTH_WIDGET = "dest_authority";
		obj.PUB_WIDGET = "dest_publication";
		obj.DOC_WIDGET = "dest_doc";
	}
	return (obj);
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
				gTopicsLicensed = true; // note we can use topics and relationships as topics is a higher license level than relationships
				gRelationshipsLicensed = true;
				init();
			},
		error: function(req, status, error)	{
				if (req.status === 401) { // authorization error - let's figure out what kind
					if (req.responseJSON.errors && 
						req.responseJSON.errors[0].detail) {
							
						if (req.responseJSON.errors[0].detail === 'Signature is not authorized.') {
							alert('Invalid partner ID or key.');
						} else if (req.responseJSON.errors[0].detail === 'This account is not licensed to access Topics') {
							// not going to do the Topic thing - let's check the relationships
							checkRelationshipLicenseLevel();
						} else alert(error);
					} else alert(error);
				} else alert(error);
			}
		}
	);
}
//
// checkTopicsLicenseLevel - see if we can request concepts/topics
//
function checkRelationshipLicenseLevel() {
	//
	// hit the relationships - if you get a 401, you are not licensed for relationships
	//
	var peersURL = STANDARDS_URL + '?limit=1&fields[standards]=peers' + authenticationParameters();
	//
	// request the data
	//
	$.ajax(
		{
		url: peersURL,
		crossDomain: true,
		dataType: 'json',
		success: function(data,status) {
				gRelationshipsLicensed = true;// note we can use relationships
				init();
			},
		error: function(req, status, error)	{
				if (req.status === 401) { // authorization error - let's figure out what kind
					if (req.responseJSON.errors && 
						req.responseJSON.errors[0].detail) {
			
						if (req.responseJSON.errors[0].detail === 'This account is not licensed to access peers') { // good to know - let's get started anyway
							init();
						} else alert(error);
					} else alert(error);
				} else alert(error);
			}
		}
	);
}
//
// init - if we are here, it is all good - get started 
//
function init() {
	//
	// if relationships are disallowed - hide all things relationship related
	//
	if (!gRelationshipsLicensed) {
		$('.destination').hide();
		$('.relationshipListArea').hide();
	}
	//
	// if topics are disallowed - disable the topics from the peer dropdown
	//
	if (!gTopicsLicensed) {
		var option = $('select.relationship option').filter(function () { return $(this).html() == "Topic"; });
		option.attr('disabled', 'disabled');
	}
	loadFacets('authority');
	loadFacets('dest_authority');
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
	
	checkTopicsLicenseLevel();
}
//
// updateGrades - get the grades status and sync everything up
//
function updateGrades() {
	gGradeFilter = $('.filterGrade').prop('checked');
	//
	// Lock the controls if the function is disabled - then exit
	//
	if (!gGradeFilter) {
		$('.lowGrade').prop('disabled', true);
		$('.highGrade').prop('disabled', true);
		$('.filterGradeLabel').css('color', 'grey');
	} else {
		//
		// enable the controls
		//
		var lowSelect = $('.lowGrade');
		lowSelect.prop('disabled', false);
		var highSelect = $('.highGrade')
		highSelect.prop('disabled', false);
		$('.filterGradeLabel').css('color', 'black');
		//
		// if no standard is selected, bail out
		//
		if (!gCurrentSourceStandard) return;
		//
		// set the current values to the limits of the current standard
		//
		var low = '12';
		var high = 'K';
		for (var i=0; i < gCurrentSourceStandard.data.attributes.education_levels.grades.length; i++) {
			var grade = gCurrentSourceStandard.data.attributes.education_levels.grades[i].code;
			if (grade === 'K') {
				low = 'K';
			} else if (Number(grade) < Number(low)) {
				low = grade;
			}
			if (high === 'K') {
				high = grade;
			} else if (grade != 'K') {
				if (Number(grade) > Number(high)) {
					high = grade;
				}
			}
		}
		lowSelect.val(low);
		highSelect.val(high);
	}
}
//
// forceSiblingRefresh - reload the sibling list
//
function forceSiblingRefresh() {
	gDestDoc = null;
	gRelationshipType = null;
	loadSiblings(); // update the siblings too
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
