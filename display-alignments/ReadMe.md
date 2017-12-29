# Display Alignments
This is a prototype implementation of a page displaying content alignment.  The user can search the assets of the account using the text field.  The system searches for the supplied text in the
client_id field, the AB GUID and a general text search.  It then displays the alignments for the first asset in the response grouped by authority. You can also narrow the authority using the Authority drop down.

This sample app can be used as a starting point for showing alignments on the content page on your site.

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
2. Edit `provider.js`
3. Locate the `auth()` function
4. Hard code the `Provider.ID`, `Provider.signature` and `Provider.expires` values.
5. Open `display-alignments.html` in a modern browser.

## Rounding Out The Implementation
The supplied files should have everything needed to add alignments to the content page of your website.  However, at least one piece will need to be completed before it can be demonstrated or put
into production and you may want to consider implementing some optional improvements.

### Security And The Signature
The content browser needs a read-only AB Connect signature in order to make calls to the AB Connect servers.  For security reasons, please do not include your partner key in the page itself.

One way to implement the signature generation is to create a web server app that generates a read-only signature and inserts it into the page before serving the page to the client. Another approach would
be to have the page authenticate against your web server using your standard authentication practices and then allow it to make a call to a microservice that responds with the read-only signature from AB Connect.
The signature life span should be relatively short but appropriate for your use case.  An hour lifespan is a good starting point.

### What Type of Alignments Do You Want to Include
The initial implementation limits the displayed alignments to "accepted" and "predicted" alignments.  If you only want accepted alignments, edit `display-alignments.js`, search for "predicted" and update the filter statement.

### Functionality Specific to Your Application
You may know the user's authority already.  For example, if your application is an LMS, you may have a teach profile so already know they teach in Indiana (e.g.).  If that's the case, you'll want to remove the authorities
dropdown and have the system filter on Indiana by default.

## Considerations
+ This prototype was developed using various components accessed online or downloaded and installed. See the HTML file for license details.
+ The prototype was developed on Chrome and tested on Firefox and Edge.  At the time of release, Edge required polyfills for the &lt;details&gt; tag so the system includes one such implementation.  Legacy
Internet Explorer support would require more polyfills and possibly some significant refactoring.
