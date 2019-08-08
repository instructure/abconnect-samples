const MAX_ARTIFACT_FACET = 100000;

var gArtifactFacets = {}; // hashmap of cached artifacts
var gArtifactFacetUpdateCount = 0; // count of facet requests - we track them so we don't process until the last one comes in
//
// addArtifactChip - add the object to the list of chips for the cloud widget
//  guid - the object to add
//
function addArtifactChip(guid){
  var object = gArtifactFacets[guid];
  
  var selected = $(".artifacts .chips .mdl-chip__text"); // grab the chips
  
  for (var i = 0; i < selected.length; i++) { // review the existing chips
    if (selected[i].getAttribute('value') === guid) return; // if we found the chip we were going to add, skip adding it
  }
  
  var chips = `
    <span class="mdl-chip mdl-chip--deletable">
        <span class="mdl-chip__text" value="${object.data.guid}">${object.data.descr} (${object.count})</span>
        <button type="button" class="mdl-chip__action" value="${object.data.guid}" onclick="dropArtifactChip();"><i class="material-icons">cancel</i></button>
    </span>`;
  
  var chipSpace = $('.artifacts .chips');
  chipSpace.html(chipSpace.html() + chips);
  //
  // Refresh the list
  //
  updateDisplay();
}
//
// updateArtifactChips - update the asset count on the chips
//
function updateArtifactChips(){
  
  var selected = $(".artifacts .chips .mdl-chip__text"); // grab the chips
  for (var i = 0; i < selected.length; i++) { // review the existing chips
    var object = gArtifactFacets[selected[i].getAttribute('value')]; // get the artifact related to this chip
    
    selected[i].textContent = `${object.data.descr} (${object.count})`; // update the count
  }
}
//
// dropArtifactChip - drop the chip to the list of chips
//
function dropArtifactChip(){
  event.target.parentNode.parentNode.parentNode.removeChild(event.target.parentNode.parentNode); // remove the chip.  I hate this notation.  :0
  
  updateDisplay();
}
//
// updateArtifactFaceting - Get the artifact facets
//
function updateArtifactFaceting() {
  if (!gArtifactsLicensed) return;
  //
  // Grab the artifact types from the facets
  //
  sourceUrl = ASSETS_URL + '?limit=0&facet=artifacts.artifact_type&facet_summary=artifacts.artifact_type' + buildFilter('artifacts');

  setArtifactsWidgetToProcessing(PROCESSING);

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
      success: function(data,status,response)
        {
        recordArtifacts(data,response);
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
            alert(`Error getting the artifacts from AB Connect. ${xhr.responseText}`);
        } 
      } 
    } 
  ); 
}
//
// recordArtifacts - record the artifacts
//    data - AJAX response
//    response - 
//
function recordArtifacts(data, response) {
  //
  // start fresh (in case there were multiple lookups)
  //
  gArtifactFacets = {};

  if (data.meta.facets[0].details.length === 0) { // nothing to display
    return;
  }
  //
  // Loop over the artifacts.  We store these in globals for use in tag clouds.  The structures are as follows:
  //
  //  gArtifactFacets - hashmap - key is the artifact asset GUID and the value is the artifact asset object with properties id, type, count (number of associated assets), attributes.title, attributes.unbound_concepts__id
  //
  for (var i=0; i < data.meta.facets[0].details.length; i++) {
    gArtifactFacets[data.meta.facets[0].details[i].data.guid] = data.meta.facets[0].details[i];
  }
  
  renderArtifactFaceting(); // now that we are loaded, get the counts
}
//
// renderArtifactFaceting - Count and record the artifacts.
//
function renderArtifactFaceting() {
  if (!gArtifactsLicensed) return;
  
  readyArtifactsWidget(); // reset the widget
  if (Object.keys(gArtifactFacets).length === 0) {
    return; // skip processing if we don't have any artifacts in memory to work with
  }
  //
  // update the clouds
  //
  renderArtifactCloudTopX(TOP_COUNT); // tag cloud of top X artifacts with expander to full list
  //
  // update the chips
  //
  updateArtifactChips();
}
//
// renderArtifactCloudTopX - render the artifact cloud listing only the top X artifacts
//    countSize - the number of elements to show
//
function renderArtifactCloudTopX(countSize) {
  
  $(".artifacts .common").hide();
  
  var list = Object.keys(gArtifactFacets);

  if (list.length === 0) { // if the list is empty, nothing to show
    var details = $(".artifacts .common").closest('details').parent().hide();
    return;
  }
  if (list.length < countSize) countSize = list.length; // if the list is small, show the whole thing
  //
  // sort by frequency of occurrence
  //
  list.sort(function(a,b) {
    return gArtifactFacets[a].count - gArtifactFacets[b].count;
    });
  //
  // Figure out the tag cloud font scale.  The largest is maxRefCount.  The smallest is minRefCount.  If there are 0s, the are considered off the bottom of
  // the scale so the next smallest is larger than 0.  This has a slightly nicer visual appeal.
  //
  var maxRefCount = gArtifactFacets[list[list.length - 1]].count;
  var minRefCount = 0;
  //
  // set the minimum cloud element size to the smallest element size in the list UNLESS the smallest and largest elements are the same size.  Then leave the smallest at 0.
  //
  if (gArtifactFacets[list[list.length - countSize]].count !== maxRefCount) {
    minRefCount = gArtifactFacets[list[list.length - countSize]].count;
  }
  //
  // now we have all of the data, setup the cloud
  //
  var commonTags = $(".artifacts .common ul");
  commonTags.empty(); // clear out the list
  for (var i=list.length - countSize; i< list.length; i++) {
    var guid = list[i];
    //
    // Add the object to the cloud by scaling the font.  0s are at 100% font size.  The next larger (assuming it isn't 0 or the max), is 125% scale.  The max is 200%.
    //
    var scale = 100;
    var count = gArtifactFacets[guid].count;
    if (count > 0) {
      scale = Math.floor((count - minRefCount) / (maxRefCount - minRefCount) * 75) + 125;
    }

    var properties = {
      style: "font-size: " + scale + "%;",
      onclick: "addArtifactChip('" + guid + "')"
    };
    if (gArtifactFacets[guid].count > 0) { // only show the artifacts that are relevant
      commonTags.append($("<li />").attr(properties).text(gArtifactFacets[guid].data.descr + ` (${gArtifactFacets[guid].count})`)); // add the artifact to the cloud
    }
  }
  //
  // Finish off the tag clouds
  //
  $(".artifacts .common ul li").tsort({order: "asc"}); // sort them
  var content = $(".artifacts .common");
  content.show(); // make sure the main one is visible
  var details = $(content).closest('details').get(0);
  //
  // set the more/less link
  //
  if(!content.next().hasClass("morelink")) { // if we haven't setup the morelink yet, do it
    const moretext = "More...";
    content.after('<a href="" class="morelink">' + moretext + '</a>'); // add the more... link
    content.parent().find(".morelink").click(function(){
      if($(this).hasClass("less")) {
        $(this).removeClass("less");
        $(this).html(moretext);
        renderArtifactCloudTopX(TOP_COUNT);
      } else {
        $(this).addClass("less");
        $(this).html("Less...");
        renderArtifactCloudTopX(list.length);
      }
      return false;
    });
  }
}
//
// setArtifactsWidgetToProcessing - clear everything with the concepts and topics widgets and data models to get it ready to recieve a new set of facets
//  message - the message to display while waiting
//
function setArtifactsWidgetToProcessing(message) {
  //
  // clear the memory cache
  //
  gArtifactFlatList = [];
  //
  // handle the clouds - clear the clouds, post the message, disable the field, remove the "More..." link if it exists, resize the widget if necessary
  //
  $('.artifacts').show();
  var commonTags = $(".artifacts .common ul");
  commonTags.empty(); // clear the cloud to get started
  commonTags.html('<p style="font-size: 14px">' + message + '</p>');
  commonTags.addClass('disabledDiv');
  $('.artifacts .common').removeAttr('style'); // remove the height restriction
  $('.artifacts .more .morelink').remove(); // get rid of the more link
}
//
// readyArtifactsWidget - re-enable the UI and remove messages
//
function readyArtifactsWidget() {
  var commonTags = $(".artifacts .common ul");
  commonTags.removeClass("disabledDiv");
  commonTags.empty(); // clear the cloud to get started
}