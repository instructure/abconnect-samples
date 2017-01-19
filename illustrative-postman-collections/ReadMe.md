# Illustrative Postman Collections
This folder contains a set of Postman collections that illustrate the technical aspects of integrations using AB Connect.

# Installation
+ Download the collection you are interested in.
+ Install [Postman](https://www.getpostman.com/) if you don't already have it installed.
+ Run Postman
+ Import the collection.

## Usage
The collections contain sets of calls.  Not all of the scenarios require that the calls be made in sequential order, but some do.  The calls stop at `partner.id=`.  You will need to add the
Partner ID that [AB Support](mailto:absupport@certicasolutions.com) assigned to you when you signed up for your sandbox or purchased a license.  You will also need to create the request signature
and complete the authentication fields in order to make the calls.

## Collections
+ [Demo Activating Content Using Clarifications](./Demo_Activating_Content_Using_Clarifications.postman_collection?at=master) - Illustrates the calls used for Activating Content using AB Connect.
Content Activation is the process of describing your content to AB Connect in machine readable form in order to enable the learning algorithms to relate your content to standards and make
suggestions for additional relationships.

## Notes
1. The collections are all in Postman v2 format.
2. Some calls use the Test field in Postman to manage key environment variables.
3. See the notes for the collection and calls for more details on their particular use cases.
