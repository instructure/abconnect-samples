# Relationships Report
This sample uses the AB Connect API to build a report in Excel format illustrating the mapping of standards in one document to those in another.  It uses some node.js modules to
read and write the Excel spreadsheets.  The input is a list of AB standard GUIDs.  The output includes details on the source Standards as well as their equivalent Standards in the
destination document.  Gathering the source GUIDs is an exercise for the user typically done by pulling them from the client system or using a tool like Postman and then using a
macro and editor to build the list of GUIDs.

## Installing the Script

+ Place all of the files/folders in one directory (download or clone).
+ Install [node.js](https://nodejs.org/en/)
+ Install required modules

```sh
        $ npm install
```
## Usage
The relationships script maps standards from one document to another using one of a number of relationships maintained by AB.  The origin and destination documents may be written by different authorities
or they may be from the same authority with the goal being to examine how an older document maps to a new one.  The main goal of this script is to illustrate how to interact with AB Connect and use it
(combined with the data and relationships supplied by Academic Benchmarks) to see how standards relate between documents.

The script expects an Excel (xlsx) workbook that serves as input, as well as, the output template for the script.
The workbook must contain two sheets.  The first sheet is the input.  The second sheet is the template for the output.
The first sheet:
+ Row 1 is column headers (which are ignored by the script).
+ Column A contains the source standards GUIDs.

The second sheet is the template for the output:
+ Row 1 is column headers (which the script leaves unaltered).
+ Column A is the source grade
+ Column B is the source number (enhanced)
+ Column C is the source standard (combined_descr) - making this a wrapped text column is a good idea
+ Column D is the destination grade
+ Column E is the destination number (enhanced)
+ Column F is the destination standard (combined_descr) - making this a wrapped text column is a good idea
+ Column G is the source GUID (repeated from the first worksheet).
+ Column H is the destination GUID.
+ Column I is the same_text flag - only used for derivative/origin/peer_derivative type relationships.
+ Column J is the same_concepts flag - only used for derivative/origin/peer_derivative type relationships.

The script will loop over the input column GUIDs and pull related siblings in the destination document.  It will then write the columns into the second worksheet according to the order listed above.
If a source GUID does not have a matching sibling in the destination, it leaves the destination columns blank for that row.  If it has one or more sibling, the source is listed one or more times
in the output with a separate sibling on each line.

## Running the Script
Sample call:
```sh
node relationships.js template.xlsx -d 72263A0A-521A-11DD-A682-DF149DFF4B22 -a "&partner.id=devconnect01&&auth.signature=h456vUN1237XTzmm0%2BM1Klsnqu5iYdpLhFxLX6GaKAI4%3D&auth.expires=1482338683"
```
Basic help documentation:
```
$ node relationships.js

  Usage: relationships [options] <input_filename>

  Options:

    -h, --help                          output usage information
    -a, --auth <authentication string>  The query string of the authentication information starting with &.  It must contain a value for partner.id, auth.signature and auth.expires.  The values must be properly URI encoded.  It may optionally include a value for user.id. Including authentication details is required.
    -d, --document <GUID>               The GUID of the destination document. Required.
    -t, --type <relationship type>      The type of relationship you want to walk.  Options: peer, derivative, peer_derivative, topic. Default: peer.
    -o, --output <output file>          The output filename. Default: out.xlsx
```

## A Note On Standards Relationships
It is _critical_ to understand that, in the general sense, standards do not map cleanly between regions (or even versions of documents within a region).  There are exceptions where
there are exact mappings between states for some standards, such as documents that are derived from a common source (like the Common Core).  In non-derived states or non-derived subjects,
AB's peer or topic relationships can be used to find close matches and accelerate the identification of relevant standards.  For situations where approximate matches of standards is
sufficient, peers and topics can be used without review (e.g. to offer the ability for users to find relevant content
based on standards in different regions without guaranteeing alignments).  However, if tight, guaranteed alignments are required, human involvement and Content Activation will be required.  See the
section on Activating Content in the AB Connect documentation for more information.

## Limitations
1. There is no sorting or filtering of the source GUIDs.  The system writes them as it reads them.
2. The script does no grade filtering.  I'll leave it as an exercise for the reader to modify the script to ensure the destination standards are in the same grade as the source standards.  It is trivial to add.

## Known Issues
1. The node.js Excel module used in this script (exceljs) is extremely sensitive to the Excel file details.  I have not managed to determine the problem, but you often get some sort of generic error
deep down in the exceljs code that says something about the color map not existing.  As long as you start with the template, it works.  Try not to make too many changes to the file as you
populate the template with your data. If you start getting these errors, go back to the template and add data a little at a time, running the script each time to make sure you don't cause problems.
