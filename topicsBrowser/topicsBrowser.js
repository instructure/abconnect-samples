const HOST = 'https://api.academicbenchmarks.com';
//const HOST = 'http://dev.academicbenchmarks.com:39002';
const STANDARDS_URL = HOST + '/rest/v4/standards';
const TOPICS_URL = HOST + '/rest/v4/topics';

const DATA_TYPE = 'json';

const GRADE_CLASS = '.gradeSelect';
const GRADE_SELECT_ELEMENT = `${GRADE_CLASS} select`;
const GRADE_OPTION_ELEMENTS = `${GRADE_SELECT_ELEMENT} option`;
const SUBJECT_CLASS = '.subjectSelect';

const SUBJECT_SELECT_ELEMENT = `${SUBJECT_CLASS} select`;
const SUBJECT_OPTION_ELEMENTS = `${SUBJECT_SELECT_ELEMENT} option`;
const SUBJECT_MDC_ELEMENT = `${SUBJECT_CLASS} .mdc-select`;

const HIGH_LEVEL_PANEL = '.highData';
const TOPIC_PANEL = '.topicData';
const DOCUMENT_PANEL = '.documentData';

const RESULTS_PANEL = '.resultsArea';
const RESULTS_LIST = `${RESULTS_PANEL} .results .summary`;

const TOPIC_CLASS = '.topicSelect';
const TOPIC_SELECT_ELEMENT = `${TOPIC_CLASS} select`;
const TOPIC_OPTION_ELEMENTS = `${TOPIC_SELECT_ELEMENT} option`;

const SUBTOPIC_CLASS = '.subtopicSelect';
const SUBTOPIC_SELECT_ELEMENT = `${SUBTOPIC_CLASS} select`;
const SUBTOPIC_OPTION_ELEMENTS = `${SUBTOPIC_SELECT_ELEMENT} option`;

const AUTHORITY_CLASS = '.authoritySelect';
const AUTHORITY_SELECT_ELEMENT = `${AUTHORITY_CLASS} select`;
const AUTHORITY_OPTION_ELEMENTS = `${AUTHORITY_SELECT_ELEMENT} option`;

const PUBLICATION_CLASS = '.publicationSelect';
const PUBLICATION_SELECT_ELEMENT = `${PUBLICATION_CLASS} select`;
const PUBLICATION_OPTION_ELEMENTS = `${PUBLICATION_SELECT_ELEMENT} option`;

const DOCUMENT_CLASS = '.documentSelect';
const DOCUMENT_SELECT_ELEMENT = `${DOCUMENT_CLASS} select`;
const DOCUMENT_OPTION_ELEMENTS = `${DOCUMENT_SELECT_ELEMENT} option`;

const RETRY_LIMIT = 5;
const RETRY_LAG = 200;

// Set the default params to the AJAX requests
$.ajaxSetup({
  crossDomain: true,
  dataType: DATA_TYPE,
  tryCount: 0,
  retryLimit: RETRY_LIMIT,
  error: handleAPIErrors
})

// Pull in a file that could be used to pre-populate fields.
var imported = document.createElement('script');
imported.src = 'fieldDefaults.js';
document.head.appendChild(imported);
//
// setup base global stuff
//
var gPartner = {}; // the destination partner details

//
// init - initialize the setup so we can get started.  It sets up the signature and screen basics
//
function init() {
  gPartner = buildAuth($('.partnerID').val().trim(), $('.partnerKey').val().trim()); // setup the destination partner credentials
  //
  // Clear the owner dropdown
  //
  $(SUBJECT_SELECT_ELEMENT)
    .find('option')
    .remove()
    .end()
    .append('<option value="" disabled selected></option>');
  //
  // setup the context sensitivity of the UI
  //
  enableDropdown(SUBJECT_CLASS);
  enablePanels();
  //
  // if we are ready, get started
  //
  if (gPartner) {
    initTopicSubject();
  }
}

function handleAPIErrors(xhr, status, error) {
  switch (xhr.status) {
    case 401: // authorization error - let's figure out what kind
      if (xhr.responseJSON.errors &&
        xhr.responseJSON.errors[0].detail) {

        if (xhr.responseJSON.errors[0].detail === 'Signature is not authorized.') {
          alert('Invalid partner ID or key.');
        } else if (xhr.responseJSON.errors[0].detail === 'This account is not licensed to access Topics') { // not going to do the Topic thing

          let details = '';
          if (jqXHR.responseJSON && jqXHR.responseJSON.errors && jqXHR.responseJSON.errors.length > 0 && jqXHR.responseJSON.errors[0].detail) {
            details = '  ' + jqXHR.responseJSON.errors[0].detail;
          }

          alert(`Your account does not have access to Topics. ${details}  Please check the credentials and license level.`);
        } else alert(`Unexpected error: ${xhr.responseText}`);
      } else alert(`Unexpected error: ${xhr.responseText}`);
      $('.partnerID').focus();
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
      alert(`An unexpected error occurred while checking the topic license status: ${xhr.responseText}`);
  }
}

//
// initTopicSubject - Flesh out the subject drop down 
//
function initTopicSubject() {
  //
  // setup the UI with the acceptable subjects
  //
  $(SUBJECT_SELECT_ELEMENT).empty();
  //
  // Now let's load the subject information
  //
  let Url = `${TOPICS_URL}?facet=document&limit=0&facet_summary=_none&${authenticationParameters()}`; // get the topics subjects list

  $.ajax(
    {
      url: Url,
      success: processSubjects
    }
  );
}
//
// processSubjects - read the subject information and setup the UI with the proper options
//    data - the API call response
//
function processSubjects(data) {
  //
  // load the drop down with the subjects
  //
  var sel = $(SUBJECT_SELECT_ELEMENT);
  sel.append($('<option value="" disabled selected></option>')); // set the default to be no selection
  for (var i = 0; i < data.meta.facets[0].details.length; i++) {
    var subject = data.meta.facets[0].details[i].data;
    sel
      .append($("<option></option>")
        .attr("value", subject.guid)
        .text(subject.descr));
  }

  $(SUBJECT_OPTION_ELEMENTS).tsort({ order: "asc" });
  enableDropdown(SUBJECT_CLASS);
  enableDropdown(GRADE_CLASS);
  enableDropdown(TOPIC_CLASS);
  enableDropdown(SUBTOPIC_CLASS);
  enableDropdown(AUTHORITY_CLASS);
  enableDropdown(PUBLICATION_CLASS);
  enableDropdown(DOCUMENT_CLASS);
  enablePanels();
}
//
// updateSubject - update the UI based on the current subject selection
//
function updateSubject() {
  enableDropdown(SUBJECT_CLASS);
  enableDropdown(GRADE_CLASS);
  enableDropdown(TOPIC_CLASS);
  enableDropdown(SUBTOPIC_CLASS);
  enableDropdown(AUTHORITY_CLASS);
  enableDropdown(PUBLICATION_CLASS);
  enableDropdown(DOCUMENT_CLASS);
  initTopicGradeBand(); // get the grade band data
}
//
// initTopicGradeBand - Flesh out the grade band drop down 
//
function initTopicGradeBand() {
  //
  // setup the UI with the acceptable grades
  //
  $(GRADE_SELECT_ELEMENT).empty();
  $(TOPIC_SELECT_ELEMENT).empty();
  $(SUBTOPIC_SELECT_ELEMENT).empty();
  $(AUTHORITY_SELECT_ELEMENT).empty();
  $(PUBLICATION_SELECT_ELEMENT).empty();
  $(DOCUMENT_SELECT_ELEMENT).empty();
  //
  // Now let's load the grade band information
  //
  let subject = $(SUBJECT_SELECT_ELEMENT).find(":selected").val();
  let Url = `${TOPICS_URL}?filter[topics]=document.guid eq '${subject}'&facet=section&limit=0&facet_summary=_none&${authenticationParameters()}`; // get the topics grade band list

  $.ajax({
    url: Url,
    success: processGrades
  });
}
//
// processGrades - read the grade information and setup the UI with the proper options
//    data - the API call response
//
function processGrades(data) {
  //
  // load the UI with the grade data
  //
  var sel = $(GRADE_SELECT_ELEMENT);
  sel.append($('<option value="" disabled selected></option>')); // set the default to be no selection
  for (var i = 0; i < data.meta.facets[0].details.length; i++) {
    var gradeBand = data.meta.facets[0].details[i].data;
    sel
      .append($("<option></option>")
        .attr("value", gradeBand.guid)
        .attr("seq", gradeBand.seq)
        .text(gradeBand.descr));
  }

  $(GRADE_OPTION_ELEMENTS).tsort({ order: "asc", attr: "seq" });
  enableDropdown(GRADE_CLASS);
  enableDropdown(TOPIC_CLASS);
  enableDropdown(SUBTOPIC_CLASS);
  enableDropdown(AUTHORITY_CLASS);
  enableDropdown(PUBLICATION_CLASS);
  enableDropdown(DOCUMENT_CLASS);
  enablePanels();
}
//
// updateGrade - update the UI based on the current grade band selection
//
function updateGrade() {
  enableDropdown(GRADE_CLASS);
  enableDropdown(TOPIC_CLASS);
  enableDropdown(SUBTOPIC_CLASS);
  enableDropdown(AUTHORITY_CLASS);
  enableDropdown(PUBLICATION_CLASS);
  enableDropdown(DOCUMENT_CLASS);
  initTopic(); // get the top level topic data
}
//
// initTopic - Flesh out the topic drop down 
//
function initTopic() {
  //
  // setup the UI with the acceptable topics
  //
  $(TOPIC_SELECT_ELEMENT).empty();
  $(SUBTOPIC_SELECT_ELEMENT).empty();
  $(AUTHORITY_SELECT_ELEMENT).empty();
  $(PUBLICATION_SELECT_ELEMENT).empty();
  $(DOCUMENT_SELECT_ELEMENT).empty();
  //
  // Now let's load the topics
  //
  let gradeBand = $(GRADE_SELECT_ELEMENT).find(":selected").val();
  let Url = `${TOPICS_URL}?filter[topics]=section.guid eq '${gradeBand}' and level eq 1&fields[topics]=descr,seq&limit=100&sort[topics]=seq&facet_summary=_none&${authenticationParameters()}`; // get the topics

  $.ajax({
    url: Url,
    success: processTopics
  });
}
//
// processTopics - read the topic information and setup the UI with the proper options
//    data - the API call response
//
function processTopics(data) {
  //
  // load the UI with the topic
  //
  var sel = $(TOPIC_SELECT_ELEMENT);
  sel.append($('<option value="" disabled selected></option>')); // set the default to be no selection
  for (var i = 0; i < data.data.length; i++) {
    var topic = data.data[i];
    sel.append($("<option></option>")
      .attr("value", topic.id)
      .attr("seq", topic.attributes.seq)
      .text(topic.attributes.descr));
  }

  enableDropdown(TOPIC_CLASS);
  enableDropdown(SUBTOPIC_CLASS);
  enableDropdown(AUTHORITY_CLASS);
  enableDropdown(PUBLICATION_CLASS);
  enableDropdown(DOCUMENT_CLASS);
  enablePanels();
}
//
// updateTopic - update the UI based on the current topic selection
//
function updateTopic() {
  enableDropdown(TOPIC_CLASS);
  enableDropdown(SUBTOPIC_CLASS);
  enableDropdown(AUTHORITY_CLASS);
  enableDropdown(PUBLICATION_CLASS);
  enableDropdown(DOCUMENT_CLASS);
  initSubtopic(); // get the subtopic data
}
//
// initSubtopic - Flesh out the subtopic drop down 
//
function initSubtopic() {
  //
  // setup the UI with the acceptable subtopics
  //
  $(SUBTOPIC_SELECT_ELEMENT).empty();
  $(AUTHORITY_SELECT_ELEMENT).empty();
  $(PUBLICATION_SELECT_ELEMENT).empty();
  $(DOCUMENT_SELECT_ELEMENT).empty();
  //
  // Now let's load the subtopics
  //
  let topic = $(TOPIC_SELECT_ELEMENT).find(":selected").val();
  let Url = `${TOPICS_URL}?filter[topics]=parent.id eq '${topic}'&fields[topics]=descr,seq&limit=100&sort[topics]=seq&facet_summary=_none&${authenticationParameters()}`; // get the subtopics

  $.ajax(
    {
      url: Url,
      success: processSubtopics
    }
  );
}
//
// processSubtopics - read the subtopic information and setup the UI with the proper options
//    data - the API call response
//
function processSubtopics(data) {
  //
  // load the UI with the subtopic data
  //
  var sel = $(SUBTOPIC_SELECT_ELEMENT);
  sel.append($('<option value="" disabled selected></option>')); // set the default to be no selection
  for (var i = 0; i < data.data.length; i++) {
    var topic = data.data[i];
    sel.append($("<option></option>")
      .attr("value", topic.id)
      .attr("seq", topic.attributes.seq)
      .text(topic.attributes.descr));
  }

  enableDropdown(SUBTOPIC_CLASS);
  enableDropdown(AUTHORITY_CLASS);
  enableDropdown(PUBLICATION_CLASS);
  enableDropdown(DOCUMENT_CLASS);
  enablePanels();
}
//
// updateSubtopic - update the UI based on the current subtopic selection
//
function updateSubtopic() {
  enableDropdown(SUBTOPIC_CLASS);
  enableDropdown(AUTHORITY_CLASS);
  enableDropdown(PUBLICATION_CLASS);
  enableDropdown(DOCUMENT_CLASS);
  initAuthorities(); // get the authority data
}
//
// initAuthorities - Flesh out the authorities drop down 
//
function initAuthorities() {
  //
  // setup the UI with the acceptable subtopics
  //
  $(AUTHORITY_SELECT_ELEMENT).empty();
  $(PUBLICATION_SELECT_ELEMENT).empty();
  $(DOCUMENT_SELECT_ELEMENT).empty();
  //
  // Now let's load the authorities
  //
  let subtopic = $(SUBTOPIC_SELECT_ELEMENT).find(":selected").val();
  let Url = `${STANDARDS_URL}?filter[standards]=topics.id eq '${subtopic}'&facet=document.publication.authorities&limit=0&facet_summary=_none&${authenticationParameters()}`; // get the authorities

  $.ajax(
    {
      url: Url,
      success: processAuthorities
    }
  );
}
//
// processAuthorities - read the authority information and setup the UI with the proper options
//    data - the API call response
//
function processAuthorities(data) {
  //
  // load the UI with the authority data
  //
  var sel = $(AUTHORITY_SELECT_ELEMENT);
  sel.append($('<option value="" disabled selected></option>')); // set the default to be no selection
  for (var i = 0; i < data.meta.facets[0].details.length; i++) {
    var authority = data.meta.facets[0].details[i].data;
    sel
      .append($("<option></option>")
        .attr("value", authority.guid)
        .text(authority.descr));
  }

  $(AUTHORITY_OPTION_ELEMENTS).tsort({ order: "asc" });
  enableDropdown(AUTHORITY_CLASS);
  enableDropdown(PUBLICATION_CLASS);
  enableDropdown(DOCUMENT_CLASS);
  enablePanels();
  //
  // If there is only one authority, select it and load the publications
  //
  if (data.meta.facets[0].details.length === 1) {
    $(`${AUTHORITY_SELECT_ELEMENT} option:eq(1)`).prop('selected', true);
    updateAuthority();
  }
}
//
// updateAuthority - update the UI based on the current authority selection
//
function updateAuthority() {
  enableDropdown(AUTHORITY_CLASS);
  enableDropdown(PUBLICATION_CLASS);
  enableDropdown(DOCUMENT_CLASS);
  initPublication(); // get the publication data
}
//
// initPublication - Flesh out the publication drop down 
//
function initPublication() {
  //
  // setup the UI with the acceptable publications
  //
  $(PUBLICATION_SELECT_ELEMENT).empty();
  $(DOCUMENT_SELECT_ELEMENT).empty();
  //
  // Now let's load the publications
  //
  let subtopic = $(SUBTOPIC_SELECT_ELEMENT).find(":selected").val();
  let authority = $(AUTHORITY_SELECT_ELEMENT).find(":selected").val();
  let Url = `${STANDARDS_URL}?filter[standards]=topics.id eq '${subtopic}' and document.publication.authorities.guid eq '${authority}'&facet=document.publication&limit=0&facet_summary=_none&${authenticationParameters()}`; // get the publications

  $.ajax(
    {
      url: Url,
      success: processPublications
    }
  );
}
//
// processPublications - read the publication information and setup the UI with the proper options
//    data - the API call response
//
function processPublications(data) {
  //
  // load the UI with the publication data
  //
  var sel = $(PUBLICATION_SELECT_ELEMENT);
  sel.append($('<option value="" disabled selected></option>')); // set the default to be no selection
  for (var i = 0; i < data.meta.facets[0].details.length; i++) {
    var publication = data.meta.facets[0].details[i].data;
    sel
      .append($("<option></option>")
        .attr("value", publication.guid)
        .text(publication.descr));
  }

  $(PUBLICATION_OPTION_ELEMENTS).tsort({ order: "asc" });
  enableDropdown(PUBLICATION_CLASS);
  enableDropdown(DOCUMENT_CLASS);
  enablePanels();
  //
  // If there is only one publication, select it and load the documents
  //
  if (data.meta.facets[0].details.length === 1) {
    $(`${PUBLICATION_SELECT_ELEMENT} option:eq(1)`).prop('selected', true);
    updatePublication();
  }
}
//
// updatePublication - update the UI based on the current publication selection
//
function updatePublication() {
  enableDropdown(PUBLICATION_CLASS);
  enableDropdown(DOCUMENT_CLASS);
  initDocument(); // get the document data
}
//
// initDocument - Flesh out the document drop down 
//
function initDocument() {
  //
  // setup the UI with the acceptable document
  //
  $(DOCUMENT_SELECT_ELEMENT).empty();
  //
  // Now let's load the documents
  //
  let subtopic = $(SUBTOPIC_SELECT_ELEMENT).find(":selected").val();
  let publication = $(PUBLICATION_SELECT_ELEMENT).find(":selected").val();
  let Url = `${STANDARDS_URL}?filter[standards]=topics.id eq '${subtopic}' and document.publication.guid eq '${publication}'&facet=document&limit=0&facet_summary=_none&${authenticationParameters()}`; // get the documents

  $.ajax(
    {
      url: Url,
      success: processDocuments
    }
  );
}
//
// processDocuments - read the document information and setup the UI with the proper options
//    data - the API call response
//
function processDocuments(data) {
  //
  // load the UI with the document data
  //
  var sel = $(DOCUMENT_SELECT_ELEMENT);
  sel.append($('<option value="" disabled selected></option>')); // set the default to be no selection
  for (var i = 0; i < data.meta.facets[0].details.length; i++) {
    var document = data.meta.facets[0].details[i].data;
    sel
      .append($("<option></option>")
        .attr("value", document.guid)
        .text(`${document.descr} (${document.adopt_year})`));
  }

  $(DOCUMENT_OPTION_ELEMENTS).tsort({ order: "asc" });
  enableDropdown(DOCUMENT_CLASS);
  enablePanels();
  //
  // If there is only one document, select it and load the standards
  //
  if (data.meta.facets[0].details.length === 1) {
    $(`${DOCUMENT_SELECT_ELEMENT} option:eq(1)`).prop('selected', true);
    updateDocument();
  }
}
//
// updateDocument - update the UI based on the current document selection
//
function updateDocument() {
  enableDropdown(DOCUMENT_CLASS);
  getStandards(); // get the matching standards
}
//
// getStandards - retrieve matching standards and show them
//
function getStandards() {
  //
  // setup the UI with the acceptable document
  //
  $(RESULTS_LIST).empty();
  //
  // Now let's load the documents
  //
  let subtopic = $(SUBTOPIC_SELECT_ELEMENT).find(":selected").val();
  let doc = $(DOCUMENT_SELECT_ELEMENT).find(":selected").val();
  let Url = `${STANDARDS_URL}?filter[standards]=topics.id eq '${subtopic}' and document.guid eq '${doc}'&sort[standards]=section.descr,number.enhanced&fields[standards]=statement,section,number&facet_summary=_none&${authenticationParameters()}`; // get the standards

  $.ajax(
    {
      url: Url,
      success: processStandards
    }
  );
}
//
// processStandards - display the standards
//    data - the API call response
//
function processStandards(data) {
  //
  // load the UI with the document data
  //
  var list = $(RESULTS_LIST);
  for (var i = 0; i < data.data.length; i++) {
    var standard = data.data[i];
    list.append(`<div class="lineItem">
          <div class="sectionName">${standard.attributes.section.descr}</div>
          <div class="standardDetails">
            <div class="number">${standard.attributes.number.enhanced}</div>
            <div class="statement">${standard.attributes.statement.combined_descr}</div>
          </div>
        </div>`);
  }
  //
  // if there is more data, load it
  //
  if (data.links.next) {
    var Url = `${data.links.next}&${authenticationParameters()}`; // get the next page

    $.ajax(
      {
        url: Url,
        success: processStandards
      }
    );
  }

  enablePanels();
}
//
// enableDropdown - set the context sensitivity of the specified dropdown
//  selector - the drop down div selector
//
function enableDropdown(selector) {
  if ($(`${selector} select option`).length > 1) { // if the subject list is populated, enable the dropdown
    $(`${selector} .mdc-select`).removeClass('mdc-select--disabled');
    $(`${selector} select`).removeAttr('disabled');
  } else {
    $(`${selector} .mdc-select`).addClass('mdc-select--disabled');
    $(`${selector} select`).attr('disabled', 'disabled');
  }
  if (itemIsSelected(`${selector} select`)) { // if something is selected, move the label above
    $(`${selector} .mdc-select label`).addClass('mdc-floating-label--float-above');
  } else {
    $(`${selector} .mdc-select label`).removeClass('mdc-floating-label--float-above');
  }
}
//
// enablePanels - set the context sensitivity of the panels
//
function enablePanels() {
  if (itemIsSelected(GRADE_SELECT_ELEMENT)) { // a grade band is selected
    $(TOPIC_PANEL).show(); // show the topics panel
  } else {
    $(TOPIC_PANEL).hide(); // hide the topics panel
  }
  if (itemIsSelected(SUBTOPIC_SELECT_ELEMENT)) { // a subtopic is selected
    $(DOCUMENT_PANEL).show(); // show the document panel
  } else {
    $(DOCUMENT_PANEL).hide(); // hide the document panel
  }
  if (itemIsSelected(DOCUMENT_SELECT_ELEMENT)) { // a publication is selected
    $(RESULTS_PANEL).show(); // show the results panel
  } else {
    $(RESULTS_PANEL).hide(); // hide the results panel
  }
}
//
// itemIsSelected - check to see if there is a valid item selected in the specified select object
//  selector - the select object selector
//  returns true if there is an item selected.  False if there is not or the selector doesn't exist or is empty
//
function itemIsSelected(selector) {
  return $(selector).length > 0 && $(selector).find(":selected").length > 0 && $(selector).find(":selected").val() && $(selector).find(":selected").val().length > 0;
}
//
// authenticationParameters - retrieve the authentication parameters
//
function authenticationParameters(partner) {
  if (!partner) { // if not defined
    partner = gPartner; // assume the destination partner
  }
  return `partner.id=${partner.id}&auth.signature=${encodeURIComponent(partner.signature)}&auth.expires=${partner.expiration}`;
}
//
// buildAuth - build the authentication details from the supplied values.  Returns the partner object or null if the credentials are missing.
//  partnerID
//  partnerKey
//
function buildAuth(partnerID, partnerKey) {
  var partner = {};
  if (!partnerID || !partnerKey) return null; // skip if there isn't anything to work on

  partner.id = partnerID;

  partner.expiration = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 1 day lifespan (in seconds)
  //
  // Build the signature
  //
  var message = '' + partner.expiration + "\n";
  //
  // Build the token
  //
  var hash = CryptoJS.HmacSHA256(message, partnerKey);
  partner.signature = CryptoJS.enc.Base64.stringify(hash);

  return partner;
}