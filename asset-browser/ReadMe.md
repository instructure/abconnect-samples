# Content Browser
This is a prototype implementation of a content browser based on AB Connect's advanced search capabilities.  It is a good starting place to demonstrate AB Connect search and discovery functionality
but is also a good starting point for developers that would like to embed similar capabilities into their systems.

## Installing the Browser

+ Place all of the files/folders in one directory (download or clone).
+ Install [node.js](https://nodejs.org/en/)
+ Install required modules

```sh
        $ npm install
```

## Getting A Demo Ready In Minutes
After you've completed the installation, take these steps to get a demo up and running.
1. Create a signature limited to the `GET` method using your key.  See the [authentication section in the documentation](https://abconnect.docs.apiary.io/#introduction/authentication) for
information on generating signatures as well code samples.
2. Edit `provider-basic.js`
3. Locate the `auth()` function
4. Hard code the `Provider.ID`, `Provider.signature` and `Provider.expires` values.
5. Open `asset-browser.html` in a modern browser.

## Rounding Out The Implementation
The supplied files should have everything needed to do a basic content browser using AB Connect's technology.  However, at least one piece will need to be completed before it can be demonstrated or put
into production and you may want to consider implementing some optional improvements.

### Security And The Signature
The content browser needs a read-only AB Connect signature in order to make calls to the AB Connect servers.  For security reasons, please do not include your partner key in the page itself.

One way to implement the signature generation is to create a web server app that generates a read-only signature and inserts it into the page before serving the page to the client. Another approach would
be to have the page authenticate against your web server using your standard authentication practices and then allow it to make a call to a microservice that responds with the read-only signature from AB Connect.
The signature life span should be relatively short but appropriate for your use case.  An hour lifespan is a good starting point.

### Configuring The Page To Include Custom Property Facets
The default implementation presents the built-in facets but it is possible (and likely) that you've created properties in the system specific to your content.  To use these properties in faceted searches,
see the comments at the top of `provider-basic.js` referring to `KEY_FACETS` and how to add custom property facets to the list.

### Functionality Specific to Your Application
The default implementation demonstrates full search and discover capability using AB Connect.  However, since imagery and links to the actual content are provider specific, you may want to modify provider-basic.js
so it offers links to your content and imagery from your library.  The default implementation looks for `image_url` and `content_url` fields on your AB Connect assets.  If they exist, the browser uses those.  If supplying
those URLs as asset properties won't work for you, you can modify the file and add your system specific logic for supplying those values (like adding authentication to the links).

However you modify provider-basic.js, call `authenticate()` once you are ready to initialize the page.  That function gets the page loading process started.

## Considerations
+ This prototype was developed using various components accessed online or downloaded and installed. See the HTML file for license details.
+ The prototype was developed on Chrome and tested on Firefox and Edge.  At the time of release, Edge required polyfills for the &lt;details&gt; tag so the system includes one such implementation.  Legacy
Internet Explorer support would require more polyfills and possibly some significant refactoring.
