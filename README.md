# IPS OAuth Node Client
A NodeJS client library for the OAuth application for Invision Community/Invision Power Suite.

## Usage
### Install
```
$ npm install fpm-git/ipsoauth-node-client
```
### Use
```javascript
import { Site, Api } from 'ipsoauth-client';

// Construct
const site = new Site({
    clientID: "YourClientID",
    clientSecret: "YourClientSecret",
    baseURL: "https://example.com/forum/"
});

// Get the URL that a user should be redirected to to grant access
const url = site.getAuthorizationURL("http://localhost/process_authorization", ["basic_info.read"], "state");

// Once the user returns to the redirect URI, process the authorization response
(async () => {
    try {
        const { tokens, api } = await site.processAuthorizationResponse(req.query, "http://localhost/process_authorization", "state");
        // save tokens.toString() as a string in the database for the user, so future requests can be made

        // Get information about the member
        const response = await api.core.member.get();
        // Process the response
    } catch (err) {
        // Handle error
    }
})();

// In future requests, to access the API, get tokens from the database, then construct the API instance using
const api = new Api(tokens, site);
```
