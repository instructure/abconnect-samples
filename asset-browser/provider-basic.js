//
// Define the minimum required provider methods.  These methods are fairly generic and don't do anything truly provider specific.
//
Provider.getBasicItem = getBasicItem;
Provider.getExpandItem = getExpandItem;
Provider.getTileItem = getTileItem;
Provider.getImageClass = getImageClass;
Provider.getAssetFields = getAssetFields;
Provider.authenticate = auth;
Provider.buildFilter = function(){return ''};
/*
How to disable a facet like the asset type

delete KEY_FACETS.asset_types;
var index = FACET_WIDGET_ORDER.indexOf('asset_types');
if (index >= 0) {
  FACET_WIDGET_ORDER.splice(index, 1);
}

You can also narrow searches using buildFilter.  E.g. if you want to hard code the asset type after hiding the widget
Provider.buildFilter = function(){return "asset_type eq 'Item' AND "}; // always finish with " AND "

How to add custom property facets to the list:
KEY_FACETS['depth_of_knowledge'] = { // The KEY_FACETS property name is the AB Connect custom property name.
    'class': '.dok', // the HTML class where we'll stick this facet - the system creates this for you. Just make sure it doesn't conflict with other classes in your file.
    'title': 'Depth of Knowledge', // the user label for this facet widget
    'custom': true // must be set to true for custom property facets, but could be ignored otherwise
  };
FACET_WIDGET_ORDER.push('depth_of_knowledge'); // add a widget to the bottom of the lists of general facets

*/
auth(); // grab the initial credentials so we can get started.  The implementaiton of this function will be specific to your situation.
checkImageAndContentURL(); // see if the image_url and content_url are available - note that this calls "authenticate" once it's ready. That function gets the whole page started.
//
// auth - grab a read-only signature and store the required AB Connect auth values.  This implementation will be provider specific.
//  WARNING!!!! Do NOT embed your partner key in the JavaScript or HTML.  Either create a read-only signature and expires and embed it in the file before serving it to the clientID
//              or use this function to retrieve the signature and expires from a microservice.
//  A Note on Using the Microservice Model: You may want to launch the microservice request as part of the load of this script in order to give your system time to respond while the page is loading.
//    Then in the response handler, you'd want to put the credential details into Provider.signature, etc. and call checkImageAndContentURL.
//
function auth() {
  //
  // The server side process should store the ID, signature and expires here or this method should call a microservice it authenticates against in some other manner in order to retreive the signature and details
  //
  Provider.ID = 'partner ID';
  Provider.signature = 'some signature';
  Provider.expires = 123;
}
//
// getBasicItem - get the mark up for a basic list
//  asset - the asset object from the API lookup
//  title - the asset title
//  subjects - the list of subjects (as a CSV string)
//  grades - the list of grades (as a CSV string)
//  returns formatted markup
//
function getBasicItem(asset, title, subjects, grades) {
  //
  // add links to the content - but only if the link is available
  //
  var contentLink = '';
  if (asset.attributes.content_url && asset.attributes.content_url.length) {
    contentLink = `onclick="showContent('${asset.attributes.content_url[0]}');" style="cursor: pointer;"`;
  }
  return `
  <li class="mdc-list-item">
    <span class="mdc-list-item__text">
      <div class="titleRow"><div class="clientID">${asset.attributes.client_id}</div><div class="ABTitle" value="${asset.id}" ${contentLink} title="${title}">${title}</div></div>
      <span class="mdc-list-item__text__secondary" title="${subjects} ${grades}"><div class="ABSubject">${subjects}</div><div class="ABGrade">${grades}</div></span>
    </span>
      <a href="#" class="mdc-list-item__end-detail material-icons"
         aria-label="More Information" title="More Information" value="${asset.id}" onclick="showAsset(event, '${asset.id}');">
        info
      </a>
  </li>`;
}
//
// getExpandItem - get the item mark up for a expandable list - this shows the asset description when opened.  If content_url is available, clicking on the asset title on the page
//    launches a dialog showing the content.
//  asset - the asset object from the API lookup
//  title - the asset title
//  subjects - the list of subjects (as a CSV string)
//  grades - the list of grades (as a CSV string)
//  returns formatted markup
//
function getExpandItem(asset, title, subjects, grades) {
  var contentLink = '';
  if (asset.attributes.content_url && asset.attributes.content_url.length) {
    contentLink = `onclick="showContent('${asset.attributes.content_url[0]}');" style="cursor: pointer;"`;
  }
  //
  // support for Microsoft Edge which doesn't support the <details> tag yet
  //
  var closeDetails = '';
  var icon = '';
  if (!$.fn.details.support) {
    closeDetails = 'style="display: none;"';
    icon = '<i title="More Information" class="mdc-grid-tile__icon material-icons" style="right: 16px;" aria-label="More Information">keyboard_arrow_down</i>';
  }
  return `
    <details onclick="showAsset(event, '${asset.id}')">
      <summary>
         <ul>
             <li class="titleName"><div class="ABTitle" value="${asset.id}" ${contentLink} title="${title}">${title}</div></li>
             <li></li>
         </ul>
         ${icon}
      </summary>
      <div class="content" ${closeDetails}>
        <section>
        </section>
      </div>
  </details>`;
}
//
// getTileItem - get the item mark up for a tile list
//  asset - the asset object from the API lookup
//  title - the asset title
//  subjects - the list of subjects (as a CSV string)
//  grades - the list of grades (as a CSV string)
//  i - the item number in the list which is used for the tile thumbnail class name
//  returns formatted markup
//
function getTileItem(asset, title, subjects, grades, i) {
  var contentLink = '';
  if (asset.attributes.content_url && asset.attributes.content_url.length) {
    contentLink = `onclick="showContent('${asset.attributes.content_url[0]}');" style="cursor: pointer;"`;
  }
  return `
    <li class="mdc-grid-tile">
      <div class="mdc-grid-tile__primary">
        <div class="mdc-grid-tile__primary-content ${Provider.getImageClass(asset, i)}"></div>
      </div>
      <span class="mdc-grid-tile__secondary">
        <i class="mdc-grid-tile__icon material-icons" aria-label="More Information" title="More Information" value="${asset.id}" onclick="showAsset(event, '${asset.id}');">info</i>
        <span class="mdc-grid-tile__title"><div class="ABTitle" value="${asset.id}"  ${contentLink} title="${title}">${title}</div></span>
        <span class="mdc-grid-tile__support-text" title="${subjects} ${grades}"><div class="ABSubject">${subjects}</div><div class="ABGrade">${grades}</div></span>
      </span>
    </li>`;
}
//
// getImageClass - get the of the image class for this asset.  We pull this from the asset property named "image_url" if it exists.
//  asset - the asset object from the API lookup
//  number - the number of this asset in the list - we give each grid item a unique class
//  returns the name of the related class
//
function getImageClass(asset, number) {
  var imageUrl = '';
  
  if (asset.attributes.image_url && asset.attributes.image_url.length > 0 &&
      asset.attributes.image_url[0] && asset.attributes.image_url[0].length > 0) {  // if there is a proper definition in AB Connect, use it
    imageUrl = `url(${asset.attributes.image_url[0]}), url(img/certica.gif)`;
  } else {                                                                  // fallback to the certica logo
    imageUrl = `url(img/certica.gif)`;
  }
  var className = 'AB-asset-image-' + number;
  
  if ($("." + className)[0]){ // the class exists
    $("." + className).css('background-image', imageUrl); // update the related image
  } else {
    $("<style type='text/css'> ." + className + " {background-image: " + imageUrl + ";} </style>").appendTo("head"); // create the class
  }
  
  return className;
}
//
// showContent - pop up the content
//  URL - render URL
//
function showContent(URL) {
  if (!URL) return; // bail if there is no content to work from
  
  parentElement = $('.ab-sample-dialog')
  
  parentElement.find('section').html(`<iframe width="610" height="400" src="${URL}">`);
  
  var dialog = mdc.dialog.MDCDialog.attachTo(document.querySelector('.ab-sample-dialog'));
  
  dialog.show();
}
//
// getAssetFields - returns the additional asset properties required for this provider.  This can be used to pull back additional asset attributes for display or inclusion in fleshing out links, images or
//    other provider-specific functionality
//   returns a CSV list of properties to be retrieved with the asset definitions.  Must start with a comma if any values are returned.
//
function getAssetFields() {
  
  if (gImageAndContentAvailable) { // image and content fields are available
    return ',image_url,content_url';
  } else { 
    return '';
  }
}
//
// showAsset - display the asset metadata profile - it is shown in a dialog if the list type is basic or tile.  The expander shows the details in the expander area.
//  event - the onclick event
//  guid - the GUID of the item in question
//
function showAsset(event, guid) {
  if (!guid) return; // bail if there is no item ID to work from
  var asset = gAssets[guid]; // grab the asset definition from the cache
  
  var parentElement;
  var bDialogMode = false;
  parentElement = $(event.target).closest('details'); // get the element where we will display the details - this works for the expander list display - otherwise it is null

  if (parentElement && parentElement.length > 0) { // if this is in response to an expander
    if ( $.fn.details.support && parentElement.open) { // details are supported and the parent is open
      return;  // the element is closing, simply exit
    }
    //
    // Microsoft Edge support (doesn't support the <details> tag natively)
    //
    if (!$.fn.details.support) { // details are not supported, so do the work manually
      if ( parentElement.hasClass('open')) { // the element is closing
        parentElement.removeClass('open');
        parentElement.removeAttr('open');
        parentElement.find('summary').next().hide(); // hide the summary
        parentElement.find('summary i').text('keyboard_arrow_down');
        return;  // the element is closing, simply exit
      } else { // the element is opening
        parentElement.addClass('open');
        parentElement.attr('open', true);
        parentElement.find('summary').next().show();
        parentElement.find('summary i').text('keyboard_arrow_up');
      }
    }
    
    if (parentElement.find('.asset-attribute-title').length > 0) { // this particular asset expander is already populated with content, just exit
      return;
    }
  } else { // this is a tile or basic list item - show the details in a dialog
    bDialogMode = true;
    parentElement = $('.ab-details-dialog')
  }

  parentElement.find('header h2').text(asset.attributes.title); // add the asset title to the dialog
  //
  // build what we can of the body
  //
  var body = formatPropertyList(asset.attributes.disciplines); // flesh out the disciplines (subjects, strands, etc.)
  body += formatPropertyList(asset.attributes.education_levels); // flesh out the education levels (grades, ages)
  if (gTopicsConceptsLicensed) { // if topics and concepts are licensed by this account, create placeholders for them
    body += `
      <div class="topics-table">
        <div class="asset-attribute-title">Topics</div>
        <div class="asset-attribute-value-list">${PROCESSING}</div>
      </div>
      <div class="concepts-table">
        <div class="asset-attribute-title">Concepts</div>
        <div class="asset-attribute-value-list">${PROCESSING}</div>
      </div>
    `;
    //
    // request the concepts and add it to the display
    //
    sourceUrl = ASSETS_URL + '/' + asset.id + '?fields[assets]=concepts&include=concepts';
    sourceUrl += authenticationParameters(); // add the auth stuff
    $.ajax(
      {
      url: sourceUrl,
      crossDomain: true,
      dataType: 'json',
      success: function(data,status)
        {
        populateConcepts(data, parentElement);
        },
      error: function(req, status, error)
        {
        alert(error);
        }
      });
    //
    // request the topics and add it to the display
    //
    sourceUrl = ASSETS_URL + '/' + asset.id + '?fields[assets]=topics&include=topics';
    sourceUrl += authenticationParameters(); // add the auth stuff
    $.ajax(
      {
      url: sourceUrl,
      crossDomain: true,
      dataType: 'json',
      success: function(data,status)
        {
        populateTopics(data, parentElement);
        },
      error: function(req, status, error)
        {
        alert(error);
        }
      });
  }
  //
  // add a placeholder for the alignments
  //
  body += `
    <div class="alignments-table">
      <div class="asset-attribute-title">Alignments</div>
      <div class="asset-attribute-value">${PROCESSING}</div>
    </div>
  `;
  //
  // request the standards and add it to the display
  //
  sourceUrl = ASSETS_URL + '/' + asset.id + "?include=standards&fields[assets]=standards&fields[standards]=statement,number,document";
  sourceUrl += authenticationParameters(); // add the auth stuff
  $.ajax(
    {
    url: sourceUrl,
    crossDomain: true,
    dataType: 'json',
    success: function(data,status)
      {
      populateAlignments(data, parentElement);
      },
    error: function(req, status, error)
      {
      alert(error);
      }
    });
  //
  // load the details screen and if it is a dialog, pop the dialog open
  //
  parentElement.find('section').html(body);
  
  if (bDialogMode) {
    var dialog = mdc.dialog.MDCDialog.attachTo(document.querySelector('.ab-details-dialog'));
    
    dialog.show();
  }
}
//
// populateConcepts - The API got back to us with the Concepts.  Format the concepts and display them
//  data - response from the API call
//  parentElement - the parent of the item we are updating.  This is particularly important for locating details sections in the expansion list.
//
function populateConcepts(data, parentElement) {
  var table = parentElement.find('.concepts-table .asset-attribute-value-list'); // find the HTML element where we are going to dump the stuff
  table.empty(); // start with a blank slate

  if (!data.included || !data.included.length) { // if there is no data in response
    parentElement.find('.concepts-table').empty(); // just remove the placeholder
    return;
  }
  //
  // loop over the concepts and build a display
  //
  var listConcepts = [];
  for (var i=0; i < data.included.length; i++) {
    var concept = data.included[i];
    
    if (concept.attributes.context) { // if the concept had a context, add it to the list
      listConcepts.push(`${concept.attributes.context} > ${concept.attributes.descr}`);
    } else { // otherwise just add the raw concept
      listConcepts.push(concept.attributes.descr);
    }
  }
  listConcepts.sort(); // sort alphabetically so it looks tidy
  //
  // loop over the concepts and add them to the page
  //
  var body = '';
  for (var i=0; i < listConcepts.length; i++) {
    var concept = listConcepts[i];
    
    body += `
      <div class="asset-attribute">
        <div class="asset-attribute-value">${htmlEncode(concept)}</div>
      </div>
    `;
  }
  //
  // add the concepts to the dialog
  //
  table.append(body);
}
//
// populateTopics - format the topics and display them
//  data - response from the API call
//  parentElement - the parent of the item we are updating.  This is particularly important for locating details sections in the expansion list
//
function populateTopics(data, parentElement) {
  var table = parentElement.find('.topics-table .asset-attribute-value-list');
  table.empty();

  if (!data.included || !data.included.length) { // only process and show if there is some data
    parentElement.find('.topics-table').empty();
    return;
  }
  //
  // loop over the topics and build a display
  //
  var body = '';
  var listTopics = [];
  for (var i=0; i < data.included.length; i++) {
    var topic = data.included[i];
    
    listTopics.push(`${topic.attributes.section.descr} > ${topic.attributes.descr}`);
  }
  listTopics.sort();
  
  for (var i=0; i < listTopics.length; i++) {
    var topic = listTopics[i];
    
    body += `
      <div class="asset-attribute">
        <div class="asset-attribute-value">${htmlEncode(topic)}</div>
      </div>
    `;
  }
  //
  // add the topics to the dialog
  //
  table.append(body);
}
//
// populateAlignments - process the response from the alignment request
//  data - response from the API call
//  parentElement - the parent of the item we are updating.  This is particularly important for locating details sections in the expansion list
//
function populateAlignments(data, parentElement) {
  var table = parentElement.find('.alignments-table .asset-attribute-value');
  table.empty();

  if (!data.included || !data.included.length) { // only process if there is some data
    if (table.text() === '') {
      table.text(NO_ALIGNMENTS); // since alignments are typically critical, we explicitly call it out if the alignments don't exist
    }
    return;
  }
  //
  // Loop over the alignments recording rejected standards
  //
  var badStandards = {};
  for (var i=0; i < data.data.relationships.standards.data.length; i++) {
    var standard = data.data.relationships.standards.data[i];
    if (standard.meta.disposition === 'rejected') {
      badStandards[standard.id] = true;
    }
  }
  //
  // Loop over the alignments constructing the resulting object filtered by authority if appropriate.
  //      The alignment list is an object (Map) of objects. Each key in the map is the authority name and the value is a list of standards objects.  Each standard object
  //        has a number and descr property.
  //
  var alignments = {};
  for (var i=0; i < data.included.length; i++) {
    var standard = data.included[i];
    if (badStandards.hasOwnProperty(standard.id)) continue; // skip rejected standards
    //
    // Handle the funny situations where we don't have proper authorities setup yet.
    //
    var groupLabel;
    if (standard.attributes.document.publication.authorities.length === 0) {
      groupLabel = standard.attributes.document.publication.descr;
    } else {
      groupLabel = standard.attributes.document.publication.authorities[0].descr;
    }
    if (!alignments.hasOwnProperty(groupLabel)) { // create authority
      alignments[groupLabel] = [];
    }
    //
    // Add this standard to the authority
    //
    if (standard.attributes.number) {
      alignments[groupLabel].push({
        number: standard.attributes.number.enhanced,
        descr: standard.attributes.statement.combined_descr}
        );
    } else {
      alignments[groupLabel].push({
        number: standard.attributes.statement.combined_descr.substr(0,20) + "...",
        descr: standard.attributes.statement.combined_descr}
        );
    }
  }
  
  var authorities = Object.keys(alignments); // sort the authorities list alphabetically so it looks tidy
  authorities.sort();
  //
  // loop over the authorities and display each standard on each authority
  //
  for (var i=0; i<authorities.length; i++) {
    var authorityBody = '';
    authorityBody += '<div class="authority">' + authorities[i] + '</div><div class="standardList">';
    //
    // loop over the standards in this authority and add them to the list.
    //
    for (var j=0; j<alignments[authorities[i]].length; j++) {
      var standard = alignments[authorities[i]][j];
      authorityBody += '<div class="standard" title="' + htmlEncode(standard.descr) + '">' + standard.number + '</div> ';
    }
    
    authorityBody += '</div>';
    
    table.append(authorityBody);
  }

  $(".standard").tsort({order: "asc"}); // sort the standards
}
//
// formatPropertyList - format the list of properties in the supplied education level or discipline list
//  object - education levels or disciplines object
//  returns the formatted HTML
//
function formatPropertyList(object) {
  var body = '';
  for (var property in object) { // loop over the properties of the object (e.g. if the object is disciplines, the properties are subjects, strands, etc.)
    if (!object.hasOwnProperty(property)) continue;
    
    var header = property.replace(/\b\w/g, function(l){ return l.toUpperCase() }); // capitalize property name so we can use it as a title on the page
    
    var values = '';
    for (var i=0; i < object[property].length; i++) { // add the values to this property (e.g. for grades this is 'Kindergarten', '1st Grade', etc.)
      values += object[property][i].descr + ', ';
    }
    if (!values) continue; // no values - skip out
    
    values = values.substr(0, values.length-2); // strip the trailing comma
    
    body += `
      <div class="asset-attribute-title">${header}</div>
      <div class="asset-attribute-value-list"><div class="asset-attribute-value">${values}</div></div>
    `;
  }
  return body;
}
//
// checkImageAndContentURL - see if this account has image and content URLs so we may be able to use them
//
var gImageAndContentAvailable = false;
function checkImageAndContentURL() {
  //
  // request the image_url and content_url fields for an asset
  //
  var sourceUrl = `https://api.academicbenchmarks.com/rest/v4/assets?limit=1&fields[assets]=image_url,content_url&partner.id=${Provider.ID}&auth.signature=${encodeURIComponent(Provider.signature)}&auth.expires=${Provider.expires}`;
  //
  // request the data
  //
  $.ajax(
    {
    url: sourceUrl,
    crossDomain: true,
    dataType: 'json',
    success: function(data,status) {
        gImageAndContentAvailable = true; // note we can use the URL fields
        
        if (authenticate) {  // if the auth function is loaded, initialize the launch process
          authenticate();
        } else {              // ask the system to launch it on page load
          window.onload = function() {
            authenticate();
          };
        }
      },
    error: function(req, status, error) { // whatever the error, just don't use images
        if (authenticate) {  // if the auth function is loaded, initialize the launch process
          authenticate();
        } else {              // ask the system to launch it on page load
          window.onload = function() {
            authenticate();
          };
        }
      }
    }
  );
}
