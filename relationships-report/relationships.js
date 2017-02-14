#!/usr/bin/env node

var tools = require('./ABtools');
tools.init();
//tools.LOGGER().level = 'debug';

var gResponses = new Object(); // global object to store the responses from the queries that store the source standards and their related destination standards
var gTopics = new Object(); // global object to store topics and related standards - only used when --type is "topic"

const PEER = 'peer';
const DERIVATIVE = 'derivative';
const PEER_DERIVATIVE = 'peer_derivative';
const TOPIC = 'topic';

const BASE_URL = 'https://api.academicbenchmarks.com';
//
// Read the arguments
//
var inputFile;
tools.arguments()
    .arguments('<input_filename>')
  .option('-a, --auth <authentication string>', 'The query string of the authentication information starting with &.  It must contain a value for partner.id, ' +
            'auth.signature and auth.expires.  The values must be properly URI encoded.  It may optionally include a value for user.id. Including authentication details is required.')
  .option('-d, --document <GUID>', 'The GUID of the destination document. Required.')
  .option('-t, --type <relationship type>', 'The type of relationship you want to walk.  Options: peer, derivative, peer_derivative, topic. Default: peer.',
            /^(peer|derivative|peer\_derivative|topic)$/, 'peer')
  .option('-o, --output <output file>', 'The output filename. Default: out.xlsx', 'out.xlsx')
  .action(function(loc) {
  inputFile = loc;
  })
 .parse(process.argv);
//
// Abort if the required arguments are not present
//
if (!tools.arguments().auth || !tools.arguments().output || !inputFile || !tools.arguments().document) {
  tools.arguments().help();
}
tools.LOGGER().debug('Auth: ' + tools.arguments().auth);
tools.LOGGER().debug('Output: ' + tools.arguments().output);
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
  gWorkbook.xlsx.readFile(inputFile).then(ProcessFile);
} catch (e) {
  tools.FatalError("Unable to read the test file '" + inputFile + "'. Current working directory is " + process.cwd() + ". Error: " + e.message);
}
//
// ProcessFile - do all of the work - we have a source/template file open in memory now.  Let's do the work.
//
var gSourceColumn;  // source GUID column
var gWorksheet;
function ProcessFile() {
  gWorksheet = gWorkbook.getWorksheet(1); // We only process the first worksheet
  gSourceColumn = gWorksheet.getColumn(1);  // source GUID column
  
  gSourceColumn.eachCell(GetSources);
  tools.LOGGER().info("Sources iteration complete");
  tools.LOGGER().info("Sources Processed: " + gTotalSource);
    //
    // If we are looking for topics we need to follow a different flow.  We can't jump directly into the sibling
    // loookup because we need to retrieve all of the source calls back before we can start to find the related
    // siblings.
    //
  if (tools.arguments().type !== TOPIC) {
        gSourceColumn.eachCell(GetSiblingsByCell);
        tools.LOGGER().info("Siblings iteration complete");
        tools.LOGGER().info("Siblings Processed: " + gTotalSibling);
    }
}
//
// GetSources - loop over each cell in the column and retrieve the source definitions
//    The first row is column headers (which we ignore).
//  cell - the cell to process
//  rowNumber - the number of the cell
//
var gPendingSourceQueryCount = 0; // number of source calls we have pending
var gTotalSource = 0; // total number of calls we have to retrieve sources
function GetSources(cell, rowNumber) {
  
  if (rowNumber === 1) {  // skip the header
    return;
  }
  //
  // Create a place to track the source standard and it's related siblings
  //
  var GUID = cell.value;
  gResponses[GUID] = new Object();
  gPendingSourceQueryCount++;
  gTotalSource++;
  //
  // Request the data for this standard
  //
  var sURL = BASE_URL + "/rest/v4/standards/" + GUID + "?fields[standards]=id,section,number,statement,origins,topics" + tools.arguments().auth;
  tools.SpaceRequests(sURL, ReceiveSources, GUID);
}
//
// ReceiveSources - process the source call response
//    data - JSON
//    response - raw data
//
function ReceiveSources(data, response, GUID) {
  //
  // server overload
  //
  if (response.statusCode === 503 ||
    response.statusCode === 504) {
    //
    // retry after a delay
    //
    tools.LOGGER().info("Received a " + response.statusCode + " when getting GUID " + GUID + ". Trying again.");
      tools.SpaceRequests(BASE_URL + response.req.path, ReceiveSources, GUID);
    return;
  //
  // other error - abort
  //
  } else if (response.statusCode !== 200) {
    tools.DumpResponse(response);
    tools.FatalError("ReceiveSources error response: " + response.statusCode + "-" + response.statusMessage);
  }
  
  if (!data) {
    tools.FatalError("No Data when receiving sources");
  }   
  //
    // Record the standard's metadata description
    //
  gResponses[GUID].source = null;
  if (data && data.data) {
    gResponses[GUID].source = data.data;
  } else {
    tools.FatalError("No Data for source: " + GUID);
  }
    //
    // If we are using topics to map from source to sibling, then build a list of unique topics to search.
    //
    if (tools.arguments().type === TOPIC) {
        
        for (var i=0; i < data.data.relationships.topics.data.length; i++) {
            gTopics[data.data.relationships.topics.data[i].id] = new Object();
        }
    }
  
  gPendingSourceQueryCount--;
  if (gPendingSourceQueryCount % 10 === 0) {
    tools.LOGGER().info("Pending Sources: " + gPendingSourceQueryCount);
  }
  //
  // We've retreived all of our results, map the results to the worksheet and save the results
  //
  if (gPendingSourceQueryCount === 0) {
    
    tools.LOGGER().info("Source data retrieved from AB");
    
    Finalize();
  }
}
//
// GetSiblingsByCell - loop over each cell in the column and retrieve the siblings
//    The first row is column headers (which we ignore).
//  cell - the cell to process
//  rowNumber - the number of the cell
//
function GetSiblingsByCell(cell, rowNumber) {
  
  if (rowNumber === 1) {  // skip the header
    return;
  }
    
    GetSiblings(cell.value);
}
//
// GetSiblingsByTopics - loop over each topic in the list and retrieve the siblings
//
function GetSiblingsByTopics() {
    
    for (var GUID in gTopics) {
        if (gTopics.hasOwnProperty(GUID)) {
            GetSiblings(GUID);
        }
    }
}
//
// GetSiblings - retrieve the siblings
//  GUID - the GUID of the relating entity - could be origin, peer, peer_derivative or topic depending on the situation
//
var gPendingSiblingQueryCount = 0; // how many sibling calls we are still waiting on
var gTotalSibling = 0; // the total number of sibling sets we are processing
function GetSiblings(GUID) {
    
  gPendingSiblingQueryCount++;
  gTotalSibling++;
  //
  // Request the standard related to this entity
  //
  var sURL = BASE_URL + "/rest/v4/standards?fields[standards]=id,section,number,statement,origins&filter[standards]=(" +
        encodeURIComponent("document.guid eq '" + tools.arguments().document + "' AND ");
  if (tools.arguments().type === PEER) {
    sURL += "peers.id";
  } else if (tools.arguments().type === DERIVATIVE) {
    sURL += "origins.id";
  } else if (tools.arguments().type === PEER_DERIVATIVE) {
    sURL += "peer_derivatives.id";
  } else if (tools.arguments().type === TOPIC) {
    sURL += "topics.id";
  }
  sURL += encodeURIComponent(" eq '" + GUID + "'") + ")" + tools.arguments().auth;
  
  tools.SpaceRequests(sURL, ReceiveSiblings, GUID);
}
//
// ReceiveSiblings - process the sibling call response
//    data - JSON
//    response - raw data
//    GUID - the GUID of the standard whose siblings we want
//
function ReceiveSiblings(data, response, GUID) {
  //
  // server overload
  //
  if (response.statusCode === 503 ||
    response.statusCode === 504) {
    //
    // retry after a delay
    //
    tools.LOGGER().info("Received a " + response.statusCode + " when getting siblings to GUID " + GUID + ". Trying again.");
      tools.SpaceRequests(BASE_URL + response.req.path, ReceiveSiblings, GUID);
    return;
  //
  // other error - abort
  //
  } else if (response.statusCode !== 200) {
    tools.DumpResponse(response);
    tools.FatalError("ReceiveSiblings error response: " + response.statusCode + "-" + response.statusMessage);
  }

  if (!data) {
    tools.FatalError("No Data when receiving siblings");
  }   
  //
    // record the siblings if this was not a topics crosswalk.  The topics crosswalk maps related standards to topics and the relationship to the
    // source is resolved on output
    //
    if (tools.arguments().type === TOPIC) {
        gTopics[GUID].siblings = null;
        if (data && data.data) {
            gTopics[GUID].siblings = data.data;
        }
    } else {
        gResponses[GUID].siblings = null;
        if (data && data.data) {
            gResponses[GUID].siblings = data.data;
        }
    }
    
  gPendingSiblingQueryCount--;
  if (gPendingSiblingQueryCount % 10 === 0) {
    tools.LOGGER().info("Pending Siblings: " + gPendingSiblingQueryCount);
  }
  //
  // We've retreived all of our results, map the results to the worksheet and save the results
  //
  if (gPendingSiblingQueryCount === 0) {
    
    tools.LOGGER().info("Sibling data retrieved from AB");
    
    Finalize();
  }
}
//
// Finalize - Confirm that all data has been received.  If it has, record the results
//
function Finalize() {
  //
    // If we've requested both the source and the sibling data and we have it all, wrap up
    //
  if (gPendingSourceQueryCount === 0 &&
    gPendingSiblingQueryCount === 0 &&
        gTotalSibling > 0) { // is false if we haven't started the sibling query yet (topics - see below)
  
    tools.LOGGER().info("Recording results");
    gSourceColumn.eachCell(RecordResults);
    
    tools.LOGGER().info("Saving the file");
    try {
      gWorkbook.xlsx.writeFile(tools.arguments().output).then(function() {
          tools.LOGGER().info("File saved");
      });
    } catch (e) {
      tools.FatalError("Unable to write the output file '" + tools.arguments().output + "'. Current working directory is " + process.cwd() + ". Error: " + e.message);
    }
  tools.LOGGER().info("Done");
    //
    // If we are doing topic based mappings and we have all of the source standards (and therefore all of the related topics), we can start
    // to lookup the related siblings.
    //
  } else if (tools.arguments().type === TOPIC &&
        gPendingSourceQueryCount === 0) {
        
        GetSiblingsByTopics();
        tools.LOGGER().info("Siblings iteration complete");
        tools.LOGGER().info("Siblings Processed: " + gTotalSibling);
    }
}
//
// RecordResults - Record the results in the Notes column of the worksheet
//
function RecordResults(cell, rowNumber) {

  if (rowNumber === 1) {  // skip the header
    return;
  }

  var note = '';
  var GUID = cell.value;
  tools.LOGGER().debug("Record Results: GUID: " + GUID);

  tools.ASSERT(gResponses[GUID], 'Missing response in RecordResults');

  if (!gResponses[GUID].source) { // no source ever came back
    //
    // make an artificial source
    //
    gResponses[GUID].source = {};
    gResponses[GUID].source.attributes = {};
    gResponses[GUID].source.attributes.section = {};
    gResponses[GUID].source.attributes.section.descr = '';
    gResponses[GUID].source.attributes.section.number = '';
    gResponses[GUID].source.attributes.number = {};
    gResponses[GUID].source.attributes.number.enhanced = '';
    gResponses[GUID].source.attributes.statement = {};
    gResponses[GUID].source.attributes.statement.combined_descr = 'Source GUID not found: ' + GUID;
    gResponses[GUID].source.relationships = {};
    gResponses[GUID].source.relationships.origins = {};
    gResponses[GUID].source.relationships.origins.data = [{}];
    gResponses[GUID].source.relationships.origins.data[0].meta = {};
    gResponses[GUID].source.relationships.origins.data[0].meta.same_text = 'N';
    gResponses[GUID].source.relationships.origins.data[0].meta.same_concepts = 'N';
    gResponses[GUID].source.relationships.topics = {};
    gResponses[GUID].source.relationships.topics.data = [{}];
  }
    //
    // If we are working on a topics crosswalk, map the topics relationships back to siblings here
    //
    if (tools.arguments().type === TOPIC) {
        gResponses[GUID].siblings = []; // prepare the siblings array
        //
        // loop over the topics related to the source standard
        //
        var siblings = {};
        for (var i=0; i < gResponses[GUID].source.relationships.topics.data.length; i++) {
            
            var topicGUID = gResponses[GUID].source.relationships.topics.data[i].id;
            //
            // loop over the standards that are related via the current topic and add them to an associative array
            // this drops duplicates
            //
            for (var j=0; j < gTopics[topicGUID].siblings.length; j++) {
                siblings[gTopics[topicGUID].siblings[j].id] = gTopics[topicGUID].siblings[j];
            }
        }
        //
        // loop over the associative array and add the siblings to the list for this particular source standard
        //
        for (var sibGUID in siblings) {
            if (siblings.hasOwnProperty(sibGUID)) {
                gResponses[GUID].siblings.push(siblings[sibGUID]);
            }
        }
    }
    //
    // Prepare the siblings data and record it to the file
    //
  if (gResponses[GUID].siblings && gResponses[GUID].siblings.length > 0) { // there is sibling data
    //
    // loop over the siblings and dump them
    //
    for (var i=0; i < gResponses[GUID].siblings.length; i++) {
      tools.LOGGER().debug("Sibling: " + gResponses[GUID].siblings[i].id);
      
      dumpRow(gResponses[GUID].source,  gResponses[GUID].siblings[i], GUID, gResponses[GUID].siblings[i].id);
    }
  } else { // no siblings
    var sibling = {};
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
    sibling.relationships.origins.data[0].meta.same_text = 'N';
    sibling.relationships.origins.data[0].meta.same_concepts = 'N';
    
    dumpRow(gResponses[GUID].source, sibling, GUID, '');
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

  var grade = '';
  if (source.attributes.section.number) {
    grade += source.attributes.section.number + ' ';
  }
  grade += source.attributes.section.descr
  gOutSheet.getCell(gOutRow,1).value = grade;
  var number = '';
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
    gOutSheet.getCell(gOutRow,9).value = sibling.relationships.origins.data[0].meta.same_text;
    gOutSheet.getCell(gOutRow,10).value = sibling.relationships.origins.data[0].meta.same_concepts;
  } else if (tools.arguments().type === PEER_DERIVATIVE) {
    //
    // if we are looking for peer_derivatives, we are concerned about this standard's (what we call here the "source")
    // sameness with the true origin as well as the peer_derivative's sameness with origin
    //
    if (source.relationships.origins.data.length === 0 ||
      sibling.relationships.origins.data === 0) {
      gOutSheet.getCell(gOutRow,9).value = 'N';
    } else if (source.relationships.origins.data[0].meta.same_text === 'Y' &&
      sibling.relationships.origins.data[0].meta.same_text === 'Y') {
      gOutSheet.getCell(gOutRow,9).value = 'Y';
    } else {
      gOutSheet.getCell(gOutRow,9).value = 'N';
    }
    if (source.relationships.origins.data.length === 0 ||
      sibling.relationships.origins.data === 0) {
      gOutSheet.getCell(gOutRow,10).value = 'N';
    } else if (source.relationships.origins.data[0].meta.same_concepts === 'Y' &&
      sibling.relationships.origins.data[0].meta.same_concepts === 'Y') {
      gOutSheet.getCell(gOutRow,10).value = 'Y';
    } else {
      gOutSheet.getCell(gOutRow,10).value = 'N';
    }
  }

  gOutRow++;
}
