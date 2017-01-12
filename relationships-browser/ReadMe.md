# Relationships Browser
## Installation
Place all of the files/folders in one directory (download or clone).

## Usage
Open [RelationshipBrowser.html](./RelationshipBrowser.html) with a browser.  Enter your AB Connect partner ID and Key into the fields at the top of the page.  Tab/click away from the partner fields and the page
will load.

Select an authority, publication, subject and section and you can browse the standards.  As you select a standard, the details of the standards are displayed in the Details area in
JSON format.

To navigate standards across documents (i.e. find related standards), select a relationship type and pick a destination authority, etc.  Related standards are shown in the list below.

## Notes
1. Often only lowest level standards have related standards.
2. Topics and Peers are the most general relationships.
3. Origin relationships only exist for standards that are derived from some common source like the Common Core or NGSS.
4. Derivative relationships only exist for CCSS and NGSS.  Peer Derivative relationships exist between standards that are both derived from a common origin.
5. This sample requires a few third-party libraries to work. Most are referenced in their hosted locations in the HTML file but neither CryptoJS nor EasyTree are hosted online so they have been included here
as jquery.easytree.min.js and in the skin-win8, rollups and components folders. See the <script> statements at the top of the HTML file for details on the location of the project and licensing. Only
the modern Windows skin of EasyTree is included.  If you need other skins, see the EasyTree site and download the more complete set of files.


## Known Issues
1. Periodically Chrome claims that the page is unresponsive.  The page is still interactive so I haven't gotten to the bottom of why Chrome thinks it is not responding.
2. Internet Explorer users will need to enable "cross domain" scripting.  To do this, go to Internet Options, Security, Custom Level, scroll down to "Miscellaneous" and set
"Access data sources across domains" to *Enable*.  Alternatively another browser.
