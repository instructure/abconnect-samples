# Embeddable Standards Browser - Minimum
## Installation
Place all of the files/folders in one directory (download or clone).

## Usage
Open [StandardsBrowser.html](./StandardsBrowser.html) with a browser.  Enter your AB Connect partner ID and Key into the fields at the top of the page.  Tab/click away from the
partner fields and the page will load.  Note that the capability in the dotted blue area is the embeddable standards browser widget.  See the init() function in [StandardsBrowser.js](./StandardsBrowser.js)
for the code that launches the browser.  The rest of the code supplies the functionality of logging and displaying the raw standard details JSON. You can see a
[working example of the app here](https://widgets.academicbenchmarks.com/ABConnect/v4/standards-browser-min/StandardsBrowser.html).

## Notes
1. The embeddable widget API calls are not logged.  If you use the embeddable widget, you don't need to understand the details of the calls.  However, if you would like to seem them, check out
the RelationshipBrowser.
2. This sample requires a few third-party libraries to work. Most are referenced in their hosted locations in the HTML file but CryptoJS is not hosted online so it has been included here
in the rollups and components folders. See the <script> statements at the top of the HTML file for details on the location of the project and licensing.

## Known Issues
1. Internet Explorer users will need to enable "cross domain" scripting.  To do this, go to Internet Options, Security, Custom Level, scroll down to "Miscellaneous" and set
"Access data sources across domains" to *Enable*.  Alternatively another browser.
