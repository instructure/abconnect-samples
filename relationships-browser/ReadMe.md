# Relationships Browser - Integrated
## Installation
Place all of the files/folders in one directory (download or clone).

## Usage
Open [RelationshipBrowser.html](./RelationshipBrowser.html) with a browser.  Enter your AB Connect partner ID and Key into the fields at the top of the page.  Tab/click away from the partner
fields and the page will load.

This version of the relationship browser uses the AB Connect Standards Browser embeddable widget.  The area outlined in a dotted blue line is supplied by AB Connect without any code from
the parent app.  For this reason, the calls in this area are not included in the API log as they are encapsulated hidden from the parent app.  If you would like to see the calls, check out
the non-integrated Relationship Browser app.

Select an authority, publication, subject and section and you can browse the standards.  As you select a standard, the details of the standards are displayed in the Details area in
JSON format.

To navigate standards across documents (i.e. find related standards), select a relationship type and pick a destination authority, etc.  Related standards are shown in the list below.

## Notes
1. Often only lowest level standards have related standards.
2. Topics and Peers are the most general relationships.
3. Origin relationships only exist for standards that are derived from some common source like the Common Core or NGSS.
4. Derivative relationships only exist for CCSS and NGSS.  Peer Derivative relationships exist between standards that are both derived from a common origin.
5. This sample requires a few third-party libraries to work. Most are referenced in their hosted locations in the HTML file but CryptoJS is not hosted online so it has been included here
in the rollups and components folders. See the <script> statements at the top of the HTML file for details on the location of the project and licensing.

## Known Issues
1. Internet Explorer users will need to enable "cross domain" scripting.  To do this, go to Internet Options, Security, Custom Level, scroll down to "Miscellaneous" and set
"Access data sources across domains" to *Enable*.  Alternatively another browser.
