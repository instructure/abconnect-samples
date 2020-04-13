#!/usr/bin/env node

// TODO: relationship paging

const ABAPI = require('./sdk.js')

const Bottleneck = require("bottleneck");
var tools = require('./ABTools');


// Hack in fetch for our dependencies
global.fetch = require("node-fetch")

tools.init();
tools.setDelay(0);
///tools.LOGGER().level = 'debug';

const PEERS = 'peers';
const DERIVATIVES = 'derivatives';
const PEER_DERIVATIVES = 'peer_derivatives';
const TOPICS = 'topics';
const ORIGINS = 'origins';
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
  .option('-t, --type <relationship_type>', 'The type of relationship you want to walk.  Options: peers, derivatives, peer_derivatives, origins, topics.', 'peers')
  .option('-o, --output <output_file>', 'The output filename. Default: out.xlsx', 'out.xlsx')
  .action(function(loc) {
  inputFile = loc;
  })
 .parse(process.argv);
//
// Abort if the required arguments are not present
//
if (!tools.arguments().auth || !tools.arguments().output || !inputFile || !tools.arguments().document ||
    ![PEERS, DERIVATIVES, PEER_DERIVATIVES, ORIGINS, TOPICS].includes(tools.arguments().type)) {
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
//    Column G is the source GUID (repeated from the first worksheet).
//    Column H is the destination GUID.
//    Column I is the same_text flag - only used for derivative/origin/peer_derivative type relationships.
//    Column J is the same_concepts flag - only used for derivative/origin/peer_derivative type relationships.
//
var Excel = require('exceljs');
var gWorkbook = new Excel.Workbook();
try {
  gWorkbook.xlsx.readFile(inputFile)
    .then(processFile)
    .then( () => {
      // Write the modified worksheet to disk
      try {
        gWorkbook.xlsx.writeFile(tools.arguments().output).then(function() {
            tools.LOGGER().info("File saved");
        });
      } catch (e) {
        tools.FatalError("Unable to write the output file '" + tools.arguments().output + "'. Current working directory is " + process.cwd() + ". Error: " + e.message);
      }
  });
} catch (e) {
  tools.FatalError("Unable to read the test file '" + inputFile + "'. Current working directory is " + process.cwd() + ". Error: " + e.message);
}

// Parse the incoming querystring in a fashion suitable for being passed to the 'new ABAPI()' constructor 
function getAuthFromQuerystring(querystring){
  const params = new URLSearchParams(querystring)

  return [params.get('partner.id'), params.get('auth.signature'), params.get('auth.expires')]
}

//
// processFile - do all of the work - we have a source/template file open in memory now.  Let's do the work.
//
async function processFile() {
  let worksheet = gWorkbook.getWorksheet(1); // We only process the first worksheet

  // Collect all of the GUIDs from the file
  let guids = []
  worksheet.eachRow(function(row, rowNumber) {
    // Skip header
    if (rowNumber == 1) return

    guids.push(row.getCell(1).value)
  });

  const api = new ABAPI(
    ...getAuthFromQuerystring(tools.arguments().auth)
  )

  for (guid of guids) {

    // Fields we're requesting from the API.
    const fields = 'id,section,number,statement,origins,derivatives' + (
      tools.arguments().type == TOPICS
        ? ',topics' //Include topics if they're needed
        : ''
     )

    // Keep track of if we found the GUID provided. Wish there was a cleaner way
    // to pass this up through the scheduler
    let standard_not_found = false;

    // Fetch the standard asked by the input spreadsheet
    const standard_json = await limiter.schedule(
      () => api.get(
        `${BASE_URL}/rest/v4.1/standards/${guid}?fields[standards]=${fields}`
      ).catch(error => {
        if(error.message == 401){
          tools.LOGGER().error("There was an error with your authentication.")
          process.exit(1)
        }
        else if(error.message == 404){
          standard_not_found = true
        }
        else {
          tools.LOGGER().error(error)
          process.exit(2)
        }
      })
    )

    if(standard_not_found){
      tools.LOGGER().error(`GUID not found. GUID=${guid}`)
      return
    }
    tools.LOGGER().info(`Processing GUID=${guid} ${guids.indexOf(guid)+1} of ${guids.length}`)

    // Loop through the sibling data for the standard
    let siblings = []

    // When we're examining topic relationships, we query all topics on the original for related standards
    // This means there is an extra loop while collecting siblings
    if(tools.arguments().type == TOPICS){

      // Collect the GUIDs of the topics
      let topics = []
      for await (const response of api.pager(
        `${BASE_URL}/rest/v4.1/standards/${guid}/topics`)
      ) {
        topics.push(...(response.data.map(topic => topic.id)))
      }

      // Get the unique standards related to EACH topic on our original standard
      let related_standards = new Map()
      for (topic_guid of topics) {
        for await (const response of api.pager(
          `${BASE_URL}/rest/v4.1/standards?fields[standards]=${fields}&filter[standards]=document.guid eq '${tools.arguments().document}' and topics.id eq '${topic_guid}'`)
        ) {
          response.data.forEach(standard => {
            related_standards.set(standard.id, standard)
          })
        }
      }

      // Convert map (which we used to ensure uniqueness) into an array
      siblings = [...related_standards.values()]
    }
    else {
      // Calculate the filter
      let filter = `(document.guid eq ${tools.arguments().document} and ${tools.arguments().type}.id eq '${guid}')`;

      // Collect the siblings of our original standard
      for await (const response of api.pager(
        `${BASE_URL}/rest/v4.1/standards?fields[standards]=${fields}&filter[standards]=${filter}`)
      ) {
        siblings.push(...response.data)
      }
    }

    // If there was no siblings found, we still want the source standard to
    // appear in the output. The easiest way to do that is to create a 'fake'
    // sibling
    if(siblings.length == 0){
      siblings.push({
       attributes: {
         section: {
           descr: '',
           number: ''
         },
         number: {
           enhanced: ''
         },
         statement: {
           combined_descr: 'No related standards were found for GUID: ' + guid
         }
       },
       relationships: {
         origins: {
           data: [{
             meta: {
               same_text: NO,
               same_concepts: NO,
             }
           }]
         },
        derivatives: {
           data: [{
             meta: {
               same_text: NO,
               same_concepts: NO,
             }
           }]
         },
         topics: {
           data: [{}]
         }
       }
      })
    }

    // Write the collected data to the worksheet
    siblings.forEach(sibling => {
      tools.LOGGER().debug(sibling)
      tools.LOGGER().debug(`Processing sibling guid=${sibling.id}`)
      dumpRow(standard_json.data, sibling, guid, sibling.id)
    })
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
  if (tools.arguments().type === PEERS ||
        tools.arguments().type === TOPICS) { // concept doesn't exist for peers or topics
  } else if (tools.arguments().type === DERIVATIVES) { // if we are looking for derivatives, then we are only concerned about the sameness between the origin and this derivative
    gOutSheet.getCell(gOutRow,9).value = checkSameText(sibling.relationships.origins.data, source.id);
    gOutSheet.getCell(gOutRow,10).value = checkSameConcepts(sibling.relationships.origins.data, source.id);
  } else if (tools.arguments().type === ORIGINS) { // if we are looking for origins, then we are only concerned about the sameness between the origin and this derivative
    gOutSheet.getCell(gOutRow,9).value = checkSameText(sibling.relationships.derivatives.data, source.id);
    gOutSheet.getCell(gOutRow,10).value = checkSameConcepts(sibling.relationships.derivatives.data, source.id);
  } else if (tools.arguments().type === PEER_DERIVATIVES) {
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
