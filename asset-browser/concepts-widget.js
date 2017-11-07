const TOP_COUNT = 20;
var gTopicsFacets = {};
var gConceptsFacets = {};
var gConceptsFlatList = [];
var gTopicsFlatList = [];
//
// addCloud - add the object to the list of chips for the cloud widget
//  className - parent class name
//  guid - the object to add
//
function addCloud(className, guid){
  var object;
  var title = '';
  if (className === 'conceptsCloud') {
    object = gConceptsFacets[guid];
    title = object.context;
  } else {
    object = gTopicsFacets[guid];    
    title = object.parent_descr;
  }
  
  var selected = $("." + className + " .chips .mdl-chip__text"); // grab the chips
  
  for (var i = 0; i < selected.length; i++) { // review the existing chips
    if (selected[i].getAttribute('value') === guid) return; // if we found the chip we were going to add, skip adding it
  }
  //
  // create the chip markup
  //
  var chips = `
    <span class="mdl-chip mdl-chip--deletable">
        <span class="mdl-chip__text" title="${title}" value="${object.guid}">${object.descr} (${object.count})</span>
        <button type="button" class="mdl-chip__action" value="${object.guid}" onclick="dropChip(event);"><i class="material-icons">cancel</i></button>
    </span>`;
  
  var chipSpace = $('.' + className + ' .chips');
  chipSpace.html(chipSpace.html() + chips);
  //
  // Refresh the list
  //
  updateDisplay();
}
//
// updateCloudAssetCount - update the asset count on the chips
//  className - parent class name
//
function updateCloudAssetCount(className){
  var cache;
  if (className === 'conceptsCloud') {
    cache = gConceptsFacets;
  } else {
    cache = gTopicsFacets;    
  }
  
  var selected = $("." + className + " .chips .mdl-chip__text"); // grab the chips
  for (var i = 0; i < selected.length; i++) { // review the existing chips
    var object = cache[selected[i].getAttribute('value')]; // get the object (concept or topic) related to this chip
    
    selected[i].textContent = `${object.descr} (${object.count})`; // update the count
  }
}
//
// dropChip - drop the chip to the list of chips
//
function dropChip(ev){
  ev.target.parentNode.parentNode.parentNode.removeChild(ev.target.parentNode.parentNode); // remove the chip.  I hate this notation.  :0
  
  updateDisplay();
}
//
// initCloudCounts - setup the initial cloud widgets
//
function initCloudCounts() {
  updateCloudCounts('conceptsCloud');
  updateCloudCounts('topicsCloud');
}
//
// updateCloudCounts - update the facetting on the topics and concept clouds
//  className - parent class name
//
function updateCloudCounts(className) {
  //
  // request the relevant facets
  //
  var facet = '&facet=';
  var facetName = '';
  if (className === 'conceptsCloud') {
    facetName = 'concepts';
    //
    // clear out the UI and lock it pending the update
    //
    setConceptsWidgetToProcessing(PROCESSING);
  } else {
    facetName = 'topics';
    //
    // clear out the UI and lock it pending the update
    //
    setTopicsWidgetToProcessing(PROCESSING);
  }
  facet += facetName;
  //
  // construct the URL to retreive the facets
  //
  var sourceUrl = ASSETS_URL + '?limit=0' + buildFilter([className]) + facet + authenticationParameters(); // do the auth bit
  //
  // request the data
  $.ajax(
    {
    url: sourceUrl,
    crossDomain: true,
    dataType: 'json',
    success: function(data,status)
      {
      countConceptsAndTopics(data, className);
      },
    error: function(req, status, error)
      {
      alert('Error updating the topics/concepts counts from AB Connect. ' + req.responseText);
      }
    });
}
//
// countConceptsAndTopics - Count and record the Concepts and Topics.
//    data - AJAX response
//    className - class of the widget we are updating
//
function countConceptsAndTopics(data, className) {
  //
  // start fresh (in case there were multiple lookups)
  //
  var flatList;
  var facetMap;
  var facet;
  if (className === 'conceptsCloud') {
    gConceptsFlatList = [];
    flatList = gConceptsFlatList;
    facetMap = gConceptsFacets;
    facet = 'concepts';
  } else {
    gTopicsFlatList = [];
    flatList = gTopicsFlatList;
    facetMap = gTopicsFacets;
    facet = 'topics';
  }
  //
  // Loop over the include and build lists of topics, concepts and counts.  We store these in globals for use in tag clouds.  The structures are as follows:
  //
  //  gConceptsFacets (facetMap) - hashmap - key is the Concept GUID and the value is the Concept object with properties id, type, count (number of associated assets), attributes.descr, attributes.context
  //  gConceptsFlatList (flatList) - list of objects - objec.descr is Concept descr + (asset count), value is the related GUID.  This is used for the tag cloud where multiple entries with the same name can be differentiated by hover
  //    text holding the context
  //
  //  gTopic* - same as above but for topics
  //
  for (var i=0; i < data.meta.facets.length; i++) { // loop over the facets in the meta response
    var metaObject = data.meta.facets[i];
    if (metaObject.facet !== facet) continue; // this is not the facet of interest, skip it
    //
    // we found the concept/topic
    // Loop over the facet and build a map from the details
    //
    for (var j=0; j < metaObject.details.length; j++) {
      var facetObj = metaObject.details[j].data;
      facetObj.count = metaObject.details[j].count; // collapse the object
      facetMap[facetObj.guid] = facetObj; // store the object in the map
      flatList.push({descr: facetObj.descr + ` (${facetObj.count})`, guid: facetObj.guid});
    }
    break; // we are done with the facets, skip out
  }
  //
  // update the cloud widgets
  //
  if (className === 'conceptsCloud') {
    readyConceptsWidget();
  } else {
    readyTopicsWidget();
  }
  //
  // update the clouds
  //
  renderCloud(className, TOP_COUNT);
  //
  // update the chips
  //
  updateCloudAssetCount(className);
}
//
// renderCloud - render the concept cloud
//  className - the class tag for the type of cloud we are rendering
//  countSize - the number of elements to show
//
function renderCloud(className, countSize) {
  
  $("." + className + " .common").hide();
  //
  // grab the right data, lists and elements based on the supplied className
  //
  var list;
  var facets;
  if (className === 'conceptsCloud') {
    list = gConceptsFlatList;
    facets = gConceptsFacets;
  } else {
    list = gTopicsFlatList;
    facets = gTopicsFacets;
  }
  if (list.length === 0) { // if the list is empty, nothing to show
    $("." + className).hide();
    return;
  }
  
  if (list.length < countSize) countSize = list.length; // if the list is small, show the whole thing
  //
  // sort the concepts by frequency of occurrence
  //
  list.sort(function(a,b) {
    return facets[a.guid].count - facets[b.guid].count;
    });
  //
  // Figure out the tag cloud font scale.  The largest is maxRefCount.  The smallest is minRefCount.  If there are 0s, the are considered off the bottom of
  // the scale so the next smallest is larger than 0.  This has a slightly nicer visual appeal.
  //
  var maxRefCount = facets[list[list.length - 1].guid].count;
  var minRefCount = 0;
  //
  // set the minimum cloud element size to the smallest element size in the list UNLESS the smallest and largest elements are the same size.  Then leave the smallest at 0.
  //
  if (facets[list[list.length - countSize].guid].count !== maxRefCount) {
    minRefCount = facets[list[list.length - countSize].guid].count;
  }
  //
  // now we have all of the concept data, setup the cloud
  //
  var commonTags = $("." + className + " .common ul");
  commonTags.empty(); // clear out the list
  for (var i=list.length - countSize; i< list.length; i++) {
    var object = list[i];
    //
    // Add the object to the cloud by scaling the font.  0s are at 100% font size.  The next larger (assuming it isn't 0 or the max), is 125% scale.  The max is 200%.
    //
    var scale = 100;
    var count = facets[object.guid].count;
    if (count > 0) {
      scale = Math.floor((count - minRefCount) / (maxRefCount - minRefCount) * 75) + 125;
    }
    //
    // add the item to the tag cloud
    //
    var title = '';
    if (className === 'conceptsCloud') {
      title = facets[object.guid].context;
    } else {
      title = facets[object.guid].parent_descr; // TODO: replace with section title which is more descriptive when differentiating topics - see https://certicasolutions.atlassian.net/browse/AC-736
    }

    commonTags.append($("<li />").attr({style: "font-size: " + scale + "%;", title: title,
      onclick: "addCloud('" + className + "','" + object.guid + "')"}).text(object.descr));
  }
  //
  // Finish off the tag clouds
  //
  $("." + className + " .common ul li").tsort({order: "asc"}); // sort them
  var content = $("." + className + " .common");
  content.show(); // make sure the main one is visible
  var details = $(content).closest('details').get(0);
  //
  // set the more/less link
  //
  content.parent().find(".morelink").remove();
  if(list.length > TOP_COUNT) { // if the more list is required
    const moretext = "More...";
    content.after('<a href="" class="morelink">' + moretext + '</a>'); // add the more... link
    //
    // setup the links and actions
    //
    content.parent().find(".morelink").click(function(){
      if($(this).hasClass("less")) {
        renderCloud(className, TOP_COUNT);
      } else {
        var localList;
        if (className === 'conceptsCloud') {
          localList = gConceptsFlatList;
        } else {
          localList = gTopicsFlatList;
        }
        renderCloud(className, localList.length);
      }
      return false;
    });
    //
    // set it to it's proper state
    //
    if (countSize === list.length) { // if we are in the "More" state
      content.parent().find(".morelink").addClass("less"); // set the link to "Less"
      content.parent().find(".morelink").html("Less...");
    }
  }
}
//
// setConceptsWidgetsToProcessing - clear everything with the concepts widget and data models to get it ready to recieve a new set of facets
//  message - the message to display while waiting
//
function setConceptsWidgetToProcessing(message) {
  //
  // clear the memory cache
  //
  gConceptsFlatList = [];
  //
  // handle the clouds - clear the clouds, post the message, disable the field, remove the "More..." link if it exists, resize the widget if necessary
  //
  $('.conceptsCloud').show();
  var commonTags = $(".conceptsCloud .common ul");
  commonTags.empty(); // clear the cloud to get started
  commonTags.html('<p style="font-size: 14px">' + message + '</p>');
  commonTags.addClass('disabledDiv');
  $('.conceptsCloud .common').removeAttr('style'); // remove the height restriction
  $('.conceptsCloud .more .morelink').remove(); // get rid of the more link
}
//
// setTopicsWidgetsToProcessing - clear everything with the topics widgets and data models to get it ready to recieve a new set of facets
//  message - the message to display while waiting
//
function setTopicsWidgetToProcessing(message) {
  //
  // clear the memory cache
  //
  gTopicsFlatList = [];
  //
  // handle the clouds - clear the clouds, post the message, disable the field, remove the "More..." link if it exists, resize the widget if necessary
  //
  $('.topicsCloud').show();
  commonTags = $(".topicsCloud .common ul");
  commonTags.empty(); // clear the cloud to get started
  commonTags.html('<p style="font-size: 14px">' + message + '</p>');
  commonTags.addClass('disabledDiv');
  $('.topicsCloud .common').removeAttr('style'); // remove the height restriction
  $('.topicsCloud .more .morelink').remove(); // get rid of the more link
}
//
// readyConceptsWidget - re-enable the UI and remove messages
//
function readyConceptsWidget() {
  var commonTags = $(".conceptsCloud .common ul");
  commonTags.removeClass("disabledDiv");
  commonTags.empty(); // clear the cloud to get started
}
//
// readyTopicsWidget - re-enable the UI and remove messages
//
function readyTopicsWidget() {
  var commonTags = $(".topicsCloud .common ul");
  commonTags.removeClass("disabledDiv");
  commonTags.empty(); // clear the cloud to get started
}