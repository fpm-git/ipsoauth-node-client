# IPS OAuth Node Client
A NodeJS client library for the OAuth application for Invision Community/Invision Power Suite.

## Usage
### Install
```
$ npm install lmg-git/ipsoauth-node-client
```
### Use
```javascript
const IPSApi = require('ipsoauth-client');

// Construct
let site = new IPSApi.Site({
    clientID: "YourClientID",
    clientSecret: "YourClientSecret",
    baseURL: "https://example.com/forum/"
});

// Get the URL that a user should be redirected to to grant access
let url = site.authorizationURL("http://localhost/process_authorization", ["basic_info.read"], "state");

// Once the user returns to the redirect URI, process the authorization response
site.processAuthorizationResponse(req.query, "http://localhost/process_authorization", "state", function(err, tokens, api) {
    // save tokens.toString() as a string in the database for the user, so future requests can be made
    
    // Get information about the member
    api.core.member.get(function(err, response) {
        // Process the response
    });
});

// In future requests, to access the API, get tokens from the database, then construct the API instance using
let api = IPSApi.Api(tokens, api);
```