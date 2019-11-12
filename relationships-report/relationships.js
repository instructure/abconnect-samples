#!/usr/bin/env node

// TODO: relationship paging

'use strict';

var ASSERT = require('assert');
const Bottleneck = require("bottleneck");
var tools = require('./ABTools');
tools.init();
tools.setDelay(0);
///tools.LOGGER().level = 'debug';

const PEER = 'peer';
const DERIVATIVE = 'derivative';
const PEER_DERIVATIVE = 'peer_derivative';
const TOPIC = 'topic';
const ORIGIN = 'origin';
const NO = 'N';
const YES = 'Y';
const BASE_URL = 'https://api.academicbenchmarks.com';
const NOTHING = 0;
const SIBLINGS = 1;
const FINISH = 2;
const LIMIT = 10;
//
// Create the limiter
//
const limiter = new Bottleneck({
  maxConcurrent:1,
  minTime:100
});
//
// Read the arguments
//
var inputFile;
tools.arguments()
    .arguments('<input_filename>')
  .option('-a, --auth <authentication string>', 'The query string of the authentication information starting with &.  It must contain a value for partner.id, ' +
            'auth.signature and auth.expires.  The values must be properly URI encoded.  It may optionally include a value for user.id. Including authentication details is required.')
  .option('-d, --document <GUID>', 'The GUID of the destination document. Required.')
  .option('-t, --type <relationship_type>', 'The type of relationship you want to walk.  Options: peer, derivative, peer_derivative, origin, topic.', 'peer')
  .option('-o, --output <output_file>', 'The output filename. Default: out.xlsx', 'out.xlsx')
  .action(function(loc) {
  inputFile = loc;
  })
 .parse(process.argv);
//
// Abort if the required arguments are not present
//
if (!tools.arguments().auth || !tools.arguments().output || !inputFile || !tools.arguments().document ||
    !['peer', 'derivative', 'peer_derivative', 'origin', 'topic'].includes(tools.arguments().type)) {
  tools.arguments().help();
}
tools.LOGGER().debug('Auth: ' + tools.arguments().auth);
tools.LOGGER().debug('Output: ' + tools.arguments().output);
tools.LOGGER().debug('Relationship Type: ' + tools.arguments().type);
tools.LOGGER().debug('Input: ' + inputFile);
tools.LOGGER().debug('Document: ' + tools.arguments().document);
//
// Abort if the output file can't be written
//
const fs = require('fs');
const path = require('path');
try {
  fs.accessSync(path.dirname(tools.arguments().output), fs.W_OK);
}
catch (error) {
  tools.FatalError("Unable to write to the output file '" + tools.arguments().output + "'. Current working directory is " + process.cwd() + ". Error: " + error.message);
}
//
// Get the input file
//
try {
  fs.accessSync(inputFile, fs.R_OK);
}
catch (error) {
  tools.FatalError("Unable to access the input file '" + inputFile + "'. Current working directory is " + process.cwd() + ". Error: " + error.message);
}
//
// Open input file - this is used as a template for the output as well as the list of source GUIDs
//  Note that the file needs to contain two sheets.  The first sheet is the input.  The second sheet is the template for the output.
//  The first sheet:
//    Row 1 is column headers (which we ignore).
//    Column A is the source GUID.
//  The second sheet: This is just used as a template for the output.  The headers can be labeled anything, but the following is the output column purpose.
//    Column A is the source grade
//    Column B is the source number (enhanced)
//    Column C is the source standard (combined_descr)
//    Column D is the destination grade
//    Column E is the destination number (enhanced)
//    Column F is the destination standard (combined_descr)
//      Column G is the source GUID (repeated from the first worksheet).
//      Column H is the destination GUID.
//      Column I is the same_text flag - only used for derivative/origin/peer_derivative type relationships.
//      Column J is the same_concepts flag - only used for derivative/origin/peer_derivative type relationships.
//
var Excel = require('exceljs');
var gWorkbook = new Excel.Workbook();
try {
  gWorkbook.xlsx.readFile(inputFile).then(processFile);
} catch (e) {
  tools.FatalError("Unable to read the test file '" + inputFile + "'. Current working directory is " + process.cwd() + ". Error: " + e.message);
}
//
// processFile - do all of the work - we have a source/template file open in memory now.  Let's do the work.
//
function processFile() {
  let worksheet = gWorkbook.getWorksheet(1); // We only process the first worksheet
  let responses = {
    sources: {}, // the source standard definitions
    topics: {}, // the topics - only used if the crosswalk is via topics
    requested: {} // the sibling requests
  };
  worksheet.eachRow(function(row, rowNumber) {getSource(row, rowNumber, responses)});
}
//
// getSource - retrieve the source definition for the GUID in this row
//  row - the row source GUIDs in it
//  rowNumber - the row we are on
//  responses - the cumulative responses
//
function getSource(row, rowNumber, responses) {
  if (rowNumber === 1) return; // skip the header
  
  let guid = row.getCell(1).value; // source GUID
  //
  // Request the data for this standard
  //
  let sURL = BASE_URL + "/rest/v4/standards/" + guid + "?facet_summary=_none&fields[standards]=id,section,number,statement,origins,derivatives";
  if (tools.arguments().type === TOPIC) {
    sURL += ",topics";
  }
  sURL += tools.arguments().auth;

  limiter.schedule({id: guid}, tools.SpaceRequests, tools.GET, {}, sURL, receiveSources, [guid, rowNumber, responses]);
}
//
// receiveSources - process the source call response
//    data - JSON
//    response - raw data
//    guid - the AB GUID we are requesting
//    rowNumber - current processing row number
//    responses - the cumulative responses
//
function receiveSources(data, response, [guid, rowNumber, responses]) {
  //
  // server overload
  //
  if (response.statusCode === 503 ||
    response.statusCode === 408 ||
    response.statusCode === 429 ||
    response.statusCode === 504) {
    //
    // retry
    //
    tools.LOGGER().info("Received a " + response.statusCode + " when getting GUID " + guid + ". Trying again.");
    limiter.schedule({id: guid}, tools.SpaceRequests, tools.GET, {}, BASE_URL + response.req.path, receiveSources, [guid, rowNumber, responses]);
    return;
  //
  // invalid GUID
  //
  } else if (response.statusCode === 404) {
    tools.LOGGER().warn("Invalid standards GUID: " + guid);
    return;
  //
  // unlicensed GUID
  //
  } else if (response.statusCode === 403) {
    let message = "Unlicensed standards GUID: " + guid;
    if (data.errors[0].detail) message += ". " + data.errors[0].detail;
    tools.LOGGER().warn(message);
    return;
  //
  // other error - abort
  //
  } else if (response.statusCode !== 200) {
    tools.FatalError("receiveSources error response: " + response.statusCode + "-" + response.statusMessage);
    return;
  }
  
  if (!data) {
    tools.FatalError("No Data when receiving sources");
    return;
  }   
  //
  // Record the standard's metadata description
  //
  responses.sources[guid] = {};
  responses.sources[guid].source = null;
  if (data && data.data) {
    responses.sources[guid].source = data.data;
  } else {
    tools.FatalError("No Data for source: " + guid);
    return;
  }
  //
  // If we are using topics to map from source to sibling, then get a list of all standards related to each topic
  //
  if (tools.arguments().type === TOPIC) {
    //
    // request any new topics
    //
    for (let i=0; i < data.data.relationships.topics.data.length; i++) {
      getSibling(data.data.relationships.topics.data[i].id, responses);
    }
  } else { // get the siblings directly from this GUID
    getSibling(guid, responses);
  }
  
  if (Object.keys(responses.sources).length % 10 === 0) {
    tools.LOGGER().info(`Sources processed so far: ${Object.keys(responses.sources).length}`);
  }
}
//
// getSibling - retrieve the siblings
//    guid - the AB GUID we are requesting
//    responses - the cumulative responses
//
function getSibling(guid, responses) {
  //
  // don't re-request the same data
  //
  if (responses.requested.hasOwnProperty(guid)) { // if this relationship has already been requested, skip
    return;
  }
  //
  // Request the standards related to this entity
  //
  let sURL = BASE_URL + `/rest/v4/standards?fields[standards]=id,section,number,statement,origins,derivatives&facet_summary=_none&limit=${LIMIT}&filter[standards]=(${encodeURIComponent(`document.guid eq '${tools.arguments().document}' AND `)}`;
  if (tools.arguments().type === PEER) {
    sURL += "peers.id";
  } else if (tools.arguments().type === DERIVATIVE) {
    sURL += "origins.id";
  } else if (tools.arguments().type === ORIGIN) {
    sURL += "derivatives.id";
  } else if (tools.arguments().type === PEER_DERIVATIVE) {
    sURL += "peer_derivatives.id";
  } else if (tools.arguments().type === TOPIC) {
    sURL += "topics.id";
  }
  sURL += encodeURIComponent(" eq '" + guid + "'") + ")" + tools.arguments().auth;
  
  limiter.schedule({id: guid}, tools.SpaceRequests, tools.GET, {}, sURL, receiveSiblings, [guid, responses]);
  responses.requested[guid] = {pending: true};
}
//
// receiveSiblings - process the sibling call response
//  data - JSON
//  response - raw data
//  guid - the GUID of the standard whose siblings we want
//  responses - cumulative responses
//
function receiveSiblings(data, response, [guid, responses]) {
  //
  // server overload
  //
  if (response.statusCode === 503 ||
    response.statusCode === 408 ||
    response.statusCode === 429 ||
    response.statusCode === 504) {
    //
    // retry after a delay
    //
    tools.LOGGER().info("Received a " + response.statusCode + " when getting siblings to GUID " + guid + ". Trying again.");
    limiter.schedule({id: guid}, tools.SpaceRequests, tools.GET, {}, BASE_URL + response.req.path, receiveSiblings, [guid, responses]);
    return;
  //
  // other error - abort
  //
  } else if (response.statusCode !== 200) {
    tools.FatalError("receiveSiblings error response: " + response.statusCode + "-" + response.statusMessage);
    return;
  }

  if (!data) {
    tools.FatalError("No Data when receiving siblings");
    return;
  }   
  responses.requested[guid].pending = false;
  //
  // record the siblings if this was not a topics crosswalk.  The topics crosswalk maps related standards to topics and the relationship to the
  // source is resolved on output
  //
  if (tools.arguments().type === TOPIC) {
      if (data && data.data) {
        if (!responses.topics[guid].siblings) responses.topics[guid].siblings = [];
        
        responses.topics[guid].siblings = responses.topics[guid].siblings.concat(data.data); // sum up arrays to support paging
      }
  } else {
      if (data && data.data) {
        if (!responses.sources[guid].siblings) responses.sources[guid].siblings = [];
        responses.sources[guid].siblings = responses.sources[guid].siblings.concat(data.data); // sum up arrays to support paging
      }
  }
  //
  // get the next page of data
  //
  if (data.links.next) {
    limiter.schedule({id: guid}, tools.SpaceRequests, tools.GET, {}, data.links.next + tools.arguments().auth, receiveSiblings, [guid, responses]);
    responses.requested[guid] = {pending: true};
    return;
  }
  
  let completedCount = countCompletedRequests(responses);
  if (completedCount % 10 === 0) {
    tools.LOGGER().info(`Siblings processed: ${completedCount}`);
  }
  //
  // see if we are done
  //
  let pending = 0;
  const jobs = limiter.counts();
  pending = jobs.RECEIVED + jobs.QUEUED + jobs.RUNNING + jobs.EXECUTING;
  if (!pending) { // requests are all complete - let's see if we have the responses
    if (completedCount === Object.keys(responses.requested).length) { // we've recieved the responses - let's wrap up
      finalize(responses);
    }
  }
}
//
// countCompletedRequests - count the requests objects
//  responses - the cumulative responses
//  returns the number of completed requests
//
function countCompletedRequests(responses) {
  let count = 0;
  let requestList = Object.keys(responses.requested);
  requestList.forEach(function (guid) {
    if (!responses.requested[guid].pending) count++; // increment the count
  });
  return count;
}
//
// finalize - Confirm that all data has been received.  If it has, record the results
//  responses - the cumulative responses
//
function finalize(responses) {
  tools.LOGGER().info("Sibling data retrieved from AB");
  
  tools.LOGGER().info("Recording results");
  let worksheet = gWorkbook.getWorksheet(1); // We only process the first worksheet
  worksheet.getColumn(1).eachCell(function(cell, rowNumber) {recordResults(cell, rowNumber, responses)});
  
  tools.LOGGER().info("Saving the file");
  try {
    gWorkbook.xlsx.writeFile(tools.arguments().output).then(function() {
        tools.LOGGER().info("File saved");
    });
  } catch (e) {
    tools.FatalError("Unable to write the output file '" + tools.arguments().output + "'. Current working directory is " + process.cwd() + ". Error: " + e.message);
  }
  tools.LOGGER().info("Done");
}
//
// recordResults - Record the results in the Notes column of the worksheet
//  cell - the worksheet cell
//  rowNumber - the number of the row we are processing
//  responses - the cumulative responses 
//
function recordResults(cell, rowNumber, responses) {

  if (rowNumber === 1) {  // skip the header
    return;
  }

  let note = '';
  let GUID = cell.value;
  tools.LOGGER().debug("Record Results: GUID: " + GUID);

  if (!responses.sources[GUID]) return; // this was an invalid or unlicensed GUID - skip

  if (!responses.sources[GUID].source) { // no source ever came back
    //
    // make an artificial source
    //
    responses.sources[GUID].source = {};
    responses.sources[GUID].source.attributes = {};
    responses.sources[GUID].source.attributes.section = {};
    responses.sources[GUID].source.attributes.section.descr = '';
    responses.sources[GUID].source.attributes.section.number = '';
    responses.sources[GUID].source.attributes.number = {};
    responses.sources[GUID].source.attributes.number.enhanced = '';
    responses.sources[GUID].source.attributes.statement = {};
    responses.sources[GUID].source.attributes.statement.combined_descr = 'Source GUID not found: ' + GUID;
    responses.sources[GUID].source.relationships = {};
    responses.sources[GUID].source.relationships.origins = {};
    responses.sources[GUID].source.relationships.origins.data = [{}];
    responses.sources[GUID].source.relationships.origins.data[0].meta = {};
    responses.sources[GUID].source.relationships.origins.data[0].meta.same_text = NO;
    responses.sources[GUID].source.relationships.origins.data[0].meta.same_concepts = NO;
    responses.sources[GUID].source.relationships.topics = {};
    responses.sources[GUID].source.relationships.topics.data = [{}];
  }
  //
  // If we are working on a topics crosswalk, map the topics relationships back to siblings here
  //
  if (tools.arguments().type === TOPIC) {
    responses.sources[GUID].siblings = []; // prepare the siblings array
    //
    // loop over the topics related to the source standard
    //
    let siblings = {};
    for (let i=0; i < responses.sources[GUID].source.relationships.topics.data.length; i++) {
        
      let topicGUID = responses.sources[GUID].source.relationships.topics.data[i].id;
      //
      // loop over the standards that are related via the current topic and add them to an associative array
      // this drops duplicates
      //
      for (let j=0; j < responses.topics[topicGUID].siblings.length; j++) {
        siblings[responses.topics[topicGUID].siblings[j].id] = responses.topics[topicGUID].siblings[j];
      }
    }
    //
    // loop over the associative array and add the siblings to the list for this particular source standard
    //
    for (let sibGUID in siblings) {
      if (siblings.hasOwnProperty(sibGUID)) {
        responses.sources[GUID].siblings.push(siblings[sibGUID]);
      }
    }
  }
  //
  // Prepare the siblings data and record it to the file
  //
  if (responses.sources[GUID].siblings && responses.sources[GUID].siblings.length > 0) { // there is sibling data
    //
    // loop over the siblings and dump them
    //
    for (let i=0; i < responses.sources[GUID].siblings.length; i++) {
      tools.LOGGER().debug("Sibling: " + responses.sources[GUID].siblings[i].id);
      
      dumpRow(responses.sources[GUID].source,  responses.sources[GUID].siblings[i], GUID, responses.sources[GUID].siblings[i].id);
    }
  } else { // no siblings
    let sibling = {};
    sibling.attributes = {};
    sibling.attributes.section = {};
    sibling.attributes.section.descr = '';
    sibling.attributes.section.number = '';
    sibling.attributes.number = {};
    sibling.attributes.number.enhanced = '';
    sibling.attributes.statement = {};
    sibling.attributes.statement.combined_descr = '';
    sibling.relationships = {};
    sibling.relationships.origins = {};
    sibling.relationships.origins.data = [{}];
    sibling.relationships.origins.data[0].meta = {}
    sibling.relationships.origins.data[0].meta.same_text = NO;
    sibling.relationships.origins.data[0].meta.same_concepts = NO;
    sibling.relationships.derivatives = {};
    sibling.relationships.derivatives.data = [{}];
    sibling.relationships.derivatives.data[0].meta = {}
    sibling.relationships.derivatives.data[0].meta.same_text = NO;
    sibling.relationships.derivatives.data[0].meta.same_concepts = NO;
    
    dumpRow(responses.sources[GUID].source, sibling, GUID, '');
  }
}
//
// dumpRow - Format this one row
//  source - the source standard object
//  sibling - the sibling standard object
//  sourceGUID - source GUID
//  siblingGUID - sibling GUID
//
var gOutRow = 2;
var gOutSheet = null;
function dumpRow(source, sibling, sourceGUID, siblingGUID) {
  if (!gOutSheet) {
    gOutSheet = gWorkbook.getWorksheet(2); // Kick the results to two
  }

  let grade = '';
  if (source.attributes.section.number) {
    grade += source.attributes.section.number + ' ';
  }
  grade += source.attributes.section.descr
  gOutSheet.getCell(gOutRow,1).value = grade;
  let number = '';
  if (source.attributes.number.enhanced) {
    number = source.attributes.number.enhanced;
  }
  gOutSheet.getCell(gOutRow,2).value = number;
  gOutSheet.getCell(gOutRow,3).value = source.attributes.statement.combined_descr;
  grade = '';
  if (sibling.attributes.section.number) {
    grade += sibling.attributes.section.number + ' ';
  }
  grade += sibling.attributes.section.descr
  gOutSheet.getCell(gOutRow,4).value = grade;
  number = '';
  if (sibling.attributes.number.enhanced) {
    number = sibling.attributes.number.enhanced;
  }
  gOutSheet.getCell(gOutRow,5).value = sibling.attributes.number.enhanced;
  gOutSheet.getCell(gOutRow,6).value = sibling.attributes.statement.combined_descr;
  
  // log the GUIDs
  gOutSheet.getCell(gOutRow,7).value = sourceGUID;
  gOutSheet.getCell(gOutRow,8).value = siblingGUID;
  // log the same_text, same_concepts
  if (tools.arguments().type === PEER ||
        tools.arguments().type === TOPIC) { // concept doesn't exist for peers or topics
  } else if (tools.arguments().type === DERIVATIVE) { // if we are looking for derivatives, then we are only concerned about the sameness between the origin and this derivative
    gOutSheet.getCell(gOutRow,9).value = checkSameText(sibling.relationships.origins.data, source.id);
    gOutSheet.getCell(gOutRow,10).value = checkSameConcepts(sibling.relationships.origins.data, source.id);
  } else if (tools.arguments().type === ORIGIN) { // if we are looking for origins, then we are only concerned about the sameness between the origin and this derivative
    gOutSheet.getCell(gOutRow,9).value = checkSameText(sibling.relationships.derivatives.data, source.id);
    gOutSheet.getCell(gOutRow,10).value = checkSameConcepts(sibling.relationships.derivatives.data, source.id);
  } else if (tools.arguments().type === PEER_DERIVATIVE) {
    //
    // if we are looking for peer_derivatives, we are concerned about this standard's (what we call here the "source")
    // sameness with the true origin as well as the peer_derivative's sameness with origin
    //
    if (source.relationships.origins.data.length === 0 ||
      sibling.relationships.origins.data.length === 0) { // if there is no origin data on one or the other
      gOutSheet.getCell(gOutRow,9).value = NO; // it is not the same
    } else {
      let same = YES;
      let found = false;
      for (let i=0; i < source.relationships.origins.data.length; i++) { // loop over the source origins
        if (findStandardRelationship(sibling.relationships.origins.data, source.relationships.origins.data[i].id)) { // we found a match on the origins
          found = true; // we found at least one match
          if (source.relationships.origins.data[i].meta.same_text === NO || // if the source to origin same_text is a no or
            checkSameText(sibling.relationships.origins.data, source.relationships.origins.data[i].id) === NO) { // if the source's origin appears in sibling's origins is a no
            same = NO; // the sameness is no.  No is terminal so bail out
            break;
          }
        }
      }
      if (!found) same = NO; // if we never found a match, they don't match on concepts

      gOutSheet.getCell(gOutRow,9).value = same;
    }
    if (source.relationships.origins.data.length === 0 ||
      sibling.relationships.origins.data.length === 0) { // if there is no origin data on one or the other
      gOutSheet.getCell(gOutRow,10).value = NO; // their concepts don't match
    } else {
      let same = YES;
      let found = false;
      for (let i=0; i < source.relationships.origins.data.length; i++) { // loop over the source origins
        if (findStandardRelationship(sibling.relationships.origins.data, source.relationships.origins.data[i].id)) { // we found a match on the origins
          found = true; // we found at least one match
          if (source.relationships.origins.data[i].meta.same_concepts === NO || // if the source to origin same_concepts is a no or
            checkSameConcepts(sibling.relationships.origins.data, source.relationships.origins.data[i].id) === NO) { // if the source's origin appears in sibling's origins is a no
            same = NO; // the sameness is no.  No is terminal so bail out
            break;
          }
        }
      }
      if (!found) same = NO; // if we never found a match, they don't match on concepts
      
      gOutSheet.getCell(gOutRow,10).value = same;
    }
  }

  gOutRow++;
}
//
// checkSameText - check the same text indicator for this standard with respect to passed in list and supplied GUID.  It loops over the list of standards.  When it finds
//    the standard in the list (the source standard), it checks the "same_text" status.
//  list - list of related standards
//  sourceGUID - the source standard we are looking for
//
function checkSameText(list, sourceGUID) {
  return checkSameFlags(list, sourceGUID, 'same_text'); // return the indicator
}
//
// checkSameConcepts - check the same concepts indicator for this standard with respect to passed in list and supplied GUID.  It loops over the list of standards.  When it finds
//    the standard in the list (the source standard), it checks the "same_concepts" status.
//  list - list of related standards
//  sourceGUID - the source standard we are looking for
//
function checkSameConcepts(list, sourceGUID) {
  return checkSameFlags(list, sourceGUID, 'same_concepts'); // return the indicator
}
//
// checkSameFlags - check the same_X indicator for this standard with respect to passed in list and supplied GUID.  It loops over the list of standards.  When it finds
//    the standard in the list (the source standard), it returns status.
//  list - list of related standards
//  sourceGUID - the source standard we are looking for
//  indicator - the indicator to check
//
function checkSameFlags(list, sourceGUID, indicator) {
  let source = findStandardRelationship(list, sourceGUID);
  if (!source) return NO; // the matching source was not found so there is no same anything
  return source.meta[indicator]; // return the indicator
}
//
// findStandardRelationship - loop over the relationships and find the matching one
//  list - list of related standards
//  sourceGUID - the source standard we are looking for
//  returns the matching relationship or null if none was found
//
function findStandardRelationship(list, sourceGUID) {
  for (let i=0; i < list.length; i++) { // loop over the list and look for the matching relationship
    if (list[i].id === sourceGUID) return list[i];
  }
  return null; // nothing found, return null
}
