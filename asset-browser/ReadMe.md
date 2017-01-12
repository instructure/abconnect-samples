# Asset Browser
## Installation
Place all of the files/folders in one directory (download or clone).

## Usage
Open [AssetBrowser.html](./AssetBrowser.html) with a browser.  Enter your AB Connect partner ID and Key into the fields at the top of the page.  Tab/click away from the partner fields and the page
will load.

Select at least one facet or search text and the Assets list will load with matching assets. Click on an asset in the list and the details section will show the metadata profile for
that asset (in prettified JSON).

## Notes
1. Facet groups that have no values or only one option are hidden.
2. Multiple selections within a facet group are combined with an OR operation.  Selections between different facet groups are joined with an AND operation.
3. This sample requires a few third-party libraries to work. Most are referenced in their hosted locations in the HTML file but CryptoJS is not hosted online so has been included here
in the rollups and components folders. See the <script> statements at the top of the HTML file for details on the location of the project and licensing.

## Known Issues
1. Internet Explorer users will need to enable "cross domain" scripting.  To do this, go to Internet Options, Security, Custom Level, scroll down to "Miscellaneous" and set
"Access data sources across domains" to *Enable*.  Alternatively use another browser.
