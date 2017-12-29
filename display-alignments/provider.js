//
// Define the minimum required provider methods.  These methods are fairly generic and don't do anything truly provider specific.
//
Provider.authenticate = auth;
//
// auth - grab a read-only signature and store the required AB Connect auth values.  This implementation will be provider specific.
//  WARNING!!!! Do NOT embed your partner key in the JavaScript or HTML.  Either create a read-only signature and expires and embed it in the file before serving it to the clientID
//              or use this function to retrieve the signature and expires from a microservice.
//  A Note on Using the Microservice Model: You may want to launch the microservice request as part of the load of this script in order to give your system time to respond while the page is loading.
//    Then in the response handler, you'd want to put the credential details into Provider.signature, etc. and call authenticate() to get started.
//
function auth() {
  //
  // The server side process should store the ID, signature and expires here or this method should call a microservice it authenticates against in some other manner in order to retreive the signature and details
  //
  Provider.ID = '<partner ID>';
  Provider.signature = '<generated signature - limit the signature to the GET method only for security purposes>';
  Provider.expires = <signature expiration>;
}
