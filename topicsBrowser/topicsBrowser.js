// URLs
const HOST = 'https://api.abconnect.certicaconnect.com';
const STANDARDS_URL = HOST + '/rest/v4.1/standards';
const TOPICS_URL = HOST + '/rest/v4.1/topics';

// Grade selectors
const GRADE_CLASS = '.gradeSelect';
const GRADE_SELECT_ELEMENT = `${GRADE_CLASS} select`;
const GRADE_OPTION_ELEMENTS = `${GRADE_SELECT_ELEMENT} option`;
const SUBJECT_CLASS = '.subjectSelect';

// Subject selectors
const SUBJECT_SELECT_ELEMENT = `${SUBJECT_CLASS} select`;
const SUBJECT_OPTION_ELEMENTS = `${SUBJECT_SELECT_ELEMENT} option`;
const SUBJECT_MDC_ELEMENT = `${SUBJECT_CLASS} .mdc-select`;

// Panel selectors
const HIGH_LEVEL_PANEL = '.highData';
const TOPIC_PANEL = '.topicData';
const DOCUMENT_PANEL = '.documentData';

// Results area selects
const RESULTS_PANEL = '.resultsArea';
const RESULTS_LIST = `${RESULTS_PANEL} .results .summary`;

// Topic selectors
const TOPIC_CLASS = '.topicSelect';
const TOPIC_SELECT_ELEMENT = `${TOPIC_CLASS} select`;
const TOPIC_OPTION_ELEMENTS = `${TOPIC_SELECT_ELEMENT} option`;

// Subtopic selectors
const SUBTOPIC_CLASS = '.subtopicSelect';
const SUBTOPIC_SELECT_ELEMENT = `${SUBTOPIC_CLASS} select`;
const SUBTOPIC_OPTION_ELEMENTS = `${SUBTOPIC_SELECT_ELEMENT} option`;

// Authority selectors
const AUTHORITY_CLASS = '.authoritySelect';
const AUTHORITY_SELECT_ELEMENT = `${AUTHORITY_CLASS} select`;
const AUTHORITY_OPTION_ELEMENTS = `${AUTHORITY_SELECT_ELEMENT} option`;

// Publication selectors
const PUBLICATION_CLASS = '.publicationSelect';
const PUBLICATION_SELECT_ELEMENT = `${PUBLICATION_CLASS} select`;
const PUBLICATION_OPTION_ELEMENTS = `${PUBLICATION_SELECT_ELEMENT} option`;

// Document selectors
const DOCUMENT_CLASS = '.documentSelect';
const DOCUMENT_SELECT_ELEMENT = `${DOCUMENT_CLASS} select`;
const DOCUMENT_OPTION_ELEMENTS = `${DOCUMENT_SELECT_ELEMENT} option`;

// The order that the dropdowns are enabled
const DROPDOWN_ORDER = [
  SUBJECT_CLASS,
  GRADE_CLASS,
  TOPIC_CLASS,
  SUBTOPIC_CLASS,
  AUTHORITY_CLASS,
  PUBLICATION_CLASS,
  DOCUMENT_CLASS
]

// Ajax constants
const DATA_TYPE = 'json';
const RETRY_LIMIT = 20;
const RETRY_LAG = 500;

// Set the default params to the AJAX requests
$.ajaxSetup({
  crossDomain: true,
  dataType: DATA_TYPE,
  tryCount: 0,
  retryLimit: RETRY_LIMIT,
  error: handleAPIErrors
})

// This pulls in the optional `fieldDefaults.js` file that can define initial
// values for the user/key values
var imported = document.createElement('script');
imported.src = 'fieldDefaults.js';
document.head.appendChild(imported);

// Once we're initialized, this holds the partner information
var gPartner = {};

// Initialize the partner & reset the UI
function init() {
  gPartner = buildAuth(
    $('.partnerID').val().trim(),
    $('.partnerKey').val().trim()
  );

  // Clear the owner dropdown
  $(SUBJECT_SELECT_ELEMENT)
    .find('option')
    .remove()
    .end()
    .append('<option value="" disabled selected></option>');

  // Set up the context sensitivity of the UI
  enableDropdown(SUBJECT_CLASS);
  enablePanels();

  // if we are ready, let's get started
  if (gPartner) {
    initTopicSubject();
  }
}

/*
 Read the API response and setup the UI with the proper options

 Params:
    data - An API call response containing facet data
*/
function processAPIDropdownResponse(selector, data) {
  let $dropdown = $(selector).find('select');

  fillDropdownWithData($dropdown, data);

  $(selector).find('option').tsort({order: 'asc', attr: 'orderBy'})

  checkEnableDropdown(selector);
  enablePanels();
}

// This function alerts the user if there were problems connecting to the ABAPI
function handleAPIErrors(xhr) {
  switch (xhr.status) {

    // authorization error - let's figure out what kind
    case 401:
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

    // Various resource issues. Let's retry
    case 503:
    case 504:
    case 408:
    case 429:
      this.tryCount++;

      if (this.tryCount <= this.retryLimit) {
        var ajaxContext = this;
        setTimeout($.ajax.bind(null, ajaxContext), this.tryCount * RETRY_LAG);
      }
      else {
        alert(`The system appears to be busy right now.  Wait for a short period and try again.`);
      }
      return;
    default:
      alert(`An unexpected error occurred: ${xhr.responseText}`);
  }
}

/*
 Returns the class selectors for all dropdowns AFTER and including the supplied
 selector. The order of the selectors is based on the order they should be
 enabled, which is based on the DROPDOWN_ORDER constant.

 This is used to calculate which dropdowns need to be enabled/cleared after a
 user selects another dropdown. See checkEnableDropdown().

 Params:
   class_selector - The selector to use in the calculation
*/
function getFollowingDropdowns(class_selector) {
  let index = DROPDOWN_ORDER.indexOf(class_selector);

  // This should never happen if the code is correct
  if (index == -1) {
    alert("Bad selector passed to getFollowingDropdowns()!");
    return [];
  }

  return DROPDOWN_ORDER.slice(index);
}

/*
  Check if the dropdowns after the provided dropdown need to be enabled or
  styled.

  Params:
    class_selector - The selector to use in the calculation
*/
function checkEnableDropdown(class_selector) {
  let selectors = getFollowingDropdowns(class_selector);

  selectors.forEach(selector => {
    enableDropdown(selector);
  })
}

function clearFollowingDropdowns(class_selector) {
  getFollowingDropdowns(class_selector)
    .forEach(selector => $(selector).find('select').empty());
}

/*
  Use the provided data to fill the provided dropdown

  If we only have 1 datum, it should be autoselected
*/
function fillDropdownWithData($dropdown, data) {
  // Create a blank option as the default
  $dropdown.append($(`
    <option 
      value = ""
      disabled
      selected
    />
  `));

  // Append a dropdown per datum. If there's a seq, use it
  data.forEach(datum => {
    $dropdown.append($(`
      <option
        value = "${datum.value}"
        orderBy = "${datum.orderBy}"
      > ${datum.descr} </option>
    `))
  });

  // If we only have 1 datum, auto-select it
  if(data.length == 1){
    $dropdown.find(`option:eq(1)`)
      .attr('selected', true)
      .change();
  }
}

// Set up the UI with appropriate subjects
function initTopicSubject() {

  // First we empty the dropdown
  $(SUBJECT_SELECT_ELEMENT).empty();

  // Then we fill it using the ABAPI's faceting capability
  let url = commonTags.oneLineTrim`
    ${TOPICS_URL}
    ?facet=document
    &limit=0
    &facet_summary=_none
    &${authenticationParameters()}
  `;

  $.ajax({
    url: url,
    success: processTopicSubjectResponse
  });
}

function processTopicSubjectResponse(res) {
  let data = res.meta.facets[0].details.map(
    detail => ({
      value: detail.data.guid,
      orderBy: detail.data.descr,
      descr: detail.data.descr
    })
  );

  processAPIDropdownResponse(SUBJECT_CLASS, data);
}

// Update the UI based on the current subject selection
function updateSubject() {
  checkEnableDropdown(SUBJECT_CLASS);
  initTopicGradeBand();
}

// Flesh out the grade band drop down 
function initTopicGradeBand() {

  clearFollowingDropdowns(GRADE_CLASS);

  // Load the grade band information using the provided subject, which is
  // represented as a document in the ABAPI
  let subject = $(SUBJECT_SELECT_ELEMENT).find(":selected").val();
  let url = commonTags.oneLineTrim`
    ${TOPICS_URL}
    ?filter[topics]=(document.guid eq '${subject}')
    &facet=section
    &limit=0
    &facet_summary=_none
    &${authenticationParameters()}
  `;

  $.ajax({
    url: url,
    success: processTopicGradeBandResponse
  });
}

function processTopicGradeBandResponse(res) {
  let data = res.meta.facets[0].details.map(
    detail => ({
      value: detail.data.guid,
      orderBy: detail.data.descr,
      descr: detail.data.descr
    })
  );

  processAPIDropdownResponse(GRADE_CLASS, data);
}

// Update the UI based on the current grade band selection
function updateGrade() {
  checkEnableDropdown(GRADE_CLASS);
  initTopic();
}

// Flesh out the topic drop down 
function initTopic() {

  clearFollowingDropdowns(TOPIC_CLASS);

  // Now load the topics from the ABAPI using the specified grade band
  let gradeBand = $(GRADE_SELECT_ELEMENT).find(":selected").val();
  let url = commonTags.oneLineTrim`
    ${TOPICS_URL}
    ?filter[topics]=(
      section.guid eq '${gradeBand}' and 
      level eq 1
    )
    &fields[topics]=descr,seq
    &limit=100
    &sort[topics]=seq
    &facet_summary=_none
    &${authenticationParameters()}
  `;

  $.ajax({
    url: url,
    success: processTopicResponse
  });
}

function processTopicResponse(res) {
  let data = res.data.map(
    datum => ({
      value: datum.id,
      orderBy: datum.attributes.seq,
      descr: datum.attributes.descr
    })
  );

  processAPIDropdownResponse(TOPIC_CLASS, data);
}

// Update the UI based on the current topic selection
function updateTopic() {
  checkEnableDropdown(TOPIC_CLASS);
  initSubtopic();
}

// Flesh out the subtopic drop down 
function initSubtopic() {
  clearFollowingDropdowns(SUBTOPIC_CLASS)

  // Now let's load the subtopics
  let topic = $(TOPIC_SELECT_ELEMENT).find(":selected").val();
  let url = commonTags.oneLineTrim`
    ${TOPICS_URL}
    ?filter[topics]=(parent.id eq '${topic}')
    &fields[topics]=descr,seq
    &limit=100
    &sort[topics]=seq
    &facet_summary=_none
    &${authenticationParameters()}
  `;

  $.ajax({
    url: url,
    success: processSubtopicResponse
  });
}

function processSubtopicResponse(res) {
  let data = res.data.map(
    datum => ({
      value: datum.id,
      orderBy: datum.attributes.seq,
      descr: datum.attributes.descr
    })
  );

  processAPIDropdownResponse(SUBTOPIC_CLASS, data);
}

// Update the UI based on the current subtopic selection
function updateSubtopic() {
  checkEnableDropdown(SUBTOPIC_CLASS);
  initAuthorities();
}

// Flesh out the authorities drop down 
function initAuthorities() {
  clearFollowingDropdowns(AUTHORITY_CLASS)

  // Now let's load the authorities
  let subtopic = $(SUBTOPIC_SELECT_ELEMENT).find(":selected").val();
  let url = commonTags.oneLineTrim`
    ${STANDARDS_URL}
    ?filter[standards]=(topics.id eq '${subtopic}')
    &facet=document.publication.authorities
    &limit=0
    &facet_summary=_none
    &${authenticationParameters()}
  `;

  $.ajax({
    url: url,
    success: processAuthorityResponse
  });
}

function processAuthorityResponse(res) {
  let data = res.meta.facets[0].details.map(
    detail => ({
      value: detail.data.guid,
      orderBy: detail.data.descr,
      descr: detail.data.descr
    })
  );

  processAPIDropdownResponse(AUTHORITY_CLASS, data);
}

// Update the UI based on the current authority selection
function updateAuthority() {
  checkEnableDropdown(AUTHORITY_CLASS);
  initPublication();
}

// Flesh out the publication drop down 
function initPublication() {
  clearFollowingDropdowns(PUBLICATION_CLASS);

  // Now let's load the publications
  let subtopic = $(SUBTOPIC_SELECT_ELEMENT).find(":selected").val();
  let authority = $(AUTHORITY_SELECT_ELEMENT).find(":selected").val();
  let url = commonTags.oneLineTrim`
    ${STANDARDS_URL}
    ?filter[standards]=(
      topics.id eq '${subtopic}' and 
      document.publication.authorities.guid eq '${authority}'
    )
    &facet=document.publication
    &limit=0
    &facet_summary=_none
    &${authenticationParameters()}
  `;

  $.ajax({
    url: url,
    success: processPublicationResponse
  });
}

function processPublicationResponse(res) {
  let data = res.meta.facets[0].details.map(
    detail => ({
      value: detail.data.guid,
      orderBy: detail.data.descr,
      descr: detail.data.descr
    })
  );

  processAPIDropdownResponse(PUBLICATION_CLASS, data);
}

// Update the UI based on the current publication selection
function updatePublication() {
  checkEnableDropdown(PUBLICATION_CLASS);
  initDocument();
}

// Flesh out the document drop down 
function initDocument() {
  clearFollowingDropdowns(DOCUMENT_CLASS);

  // Now let's load the documents
  let subtopic = $(SUBTOPIC_SELECT_ELEMENT).find(":selected").val();
  let publication = $(PUBLICATION_SELECT_ELEMENT).find(":selected").val();
  let url = commonTags.oneLineTrim`
    ${STANDARDS_URL}
    ?filter[standards]=(
      topics.id eq '${subtopic}' and 
      document.publication.guid eq '${publication}'
    )
    &facet=document
    &limit=0
    &facet_summary=_none
    &${authenticationParameters()}
  `;

  $.ajax({
    url: url,
    success: processDocumentResponse
  });
}

function processDocumentResponse(res) {
  let data = res.meta.facets[0].details.map(
    detail => ({
      value: detail.data.guid,
      orderBy: detail.data.descr,
      descr: detail.data.descr
    })
  );

  processAPIDropdownResponse(DOCUMENT_CLASS, data);
}

// Update the UI based on the current document selection
function updateDocument() {
  checkEnableDropdown(DOCUMENT_CLASS);
  getStandards();
}

// getStandards - retrieve matching standards and show them
function getStandards() {
  // Setup the UI with the acceptable document
  $(RESULTS_LIST).empty();
  //
  // Now let's load the documents
  //
  let subtopic = $(SUBTOPIC_SELECT_ELEMENT).find(":selected").val();
  let doc = $(DOCUMENT_SELECT_ELEMENT).find(":selected").val();
  let url = commonTags.oneLineTrim`
    ${STANDARDS_URL}
    ?filter[standards]=(
      topics.id eq '${subtopic}' and 
      document.guid eq '${doc}'
    )
    &sort[standards]=section.descr,number.enhanced
    &fields[standards]=statement,section,number
    &facet_summary=_none
    &${authenticationParameters()}
  `;

  $.ajax({
    url: url,
    success: processStandards
  });
}
/*
 Display the standards from the API response data
 
 Params: 
   data - the API call response
*/
function processStandards(data) {
  //
  // load the UI with the document data
  //
  var list = $(RESULTS_LIST);
  for (var i = 0; i < data.data.length; i++) {
    var standard = data.data[i];
    list.append(commonTags.safeHtml`
      <div class="lineItem">
        <div class="sectionName">${standard.attributes.section.descr}</div>
        <div class="standardDetails">
          <div class="number">${standard.attributes.number.enhanced}</div>
          <div class="statement">${standard.attributes.statement.combined_descr}</div>
        </div>
      </div>
    `);
  }

  // If there is more data to page through, load it
  if (data.links.next) {
    var Url = `${data.links.next}&${authenticationParameters()}`;

    $.ajax({
      url: Url,
      success: processStandards
    });
  }

  enablePanels();
}
/*
 Set the context sensitivity of the specified dropdown

 Params:
   selector - the drop down div selector
*/
function enableDropdown(selector) {

  // If the list is populated, enable the dropdown
  if ($(`${selector} select option`).length > 1) { 
    $(`${selector} .mdc-select`).removeClass('mdc-select--disabled');
    $(`${selector} select`).removeAttr('disabled');
  }
  else {
    $(`${selector} .mdc-select`).addClass('mdc-select--disabled');
    $(`${selector} select`).attr('disabled', 'disabled');
  }

  // If something is selected, move the label above
  if (itemIsSelected(`${selector} select`)) {
    $(`${selector} .mdc-select label`).addClass('mdc-floating-label--float-above');
  }
  else {
    $(`${selector} .mdc-select label`).removeClass('mdc-floating-label--float-above');
  }
}

/*
  Set the context sensitivity of the panels based on the selected elements
  When the last element from the previous panel is selected, we enable the
  next panel. 
*/ 
function enablePanels() {

  // Panel 1
  if (itemIsSelected(GRADE_SELECT_ELEMENT)) { 
    $(TOPIC_PANEL).show();
  }
  else {
    $(TOPIC_PANEL).hide();
  }

  // Panel 2
  if (itemIsSelected(SUBTOPIC_SELECT_ELEMENT)) {
    $(DOCUMENT_PANEL).show();
  }
  else {
    $(DOCUMENT_PANEL).hide();
  }

  // Panel 3
  if (itemIsSelected(DOCUMENT_SELECT_ELEMENT)) {
    $(RESULTS_PANEL).show();
  }
  else {
    $(RESULTS_PANEL).hide();
  }
}
/*
 Check to see if there is a valid item selected in the specified select object

 Params:
   selector - the select object selector
   
 Returns true if there is an item selected.  False if there is not or the 
 selector doesn't exist or is empty
*/
function itemIsSelected(selector) {
  return $(selector).length > 0 &&
    $(selector).find(":selected").length > 0 &&
    $(selector).find(":selected").val() &&
    $(selector).find(":selected").val().length > 0;
}

// Retrieve the authentication parameters for the ABAPI
function authenticationParameters(partner) {
  
  // We default to the globally specified partner
  if (!partner) {
    partner = gPartner;
  }

  return `partner.id=${partner.id}&auth.signature=${encodeURIComponent(partner.signature)}&auth.expires=${partner.expiration}`;
}
/*
  Build the authentication details from the supplied values.  
 
  Params: 
    partnerID
    partnerKey
   
  Returns the partner object or null if the credentials are missing.
*/
function buildAuth(partnerID, partnerKey) {
  var partner = {};

  // Skip if there isn't anything to work on
  if (!partnerID || !partnerKey) return null; 

  partner.id = partnerID;

  // 1 day lifespan (in seconds)
  partner.expiration = Math.floor(Date.now() / 1000) + 24 * 60 * 60; 

  // Build the 'message' to encrypt
  var message = '' + partner.expiration + "\n";

  // Hash the message with your partner key to create an auth signature
  var hash = CryptoJS.HmacSHA256(message, partnerKey);
  partner.signature = CryptoJS.enc.Base64.stringify(hash);

  return partner;
}