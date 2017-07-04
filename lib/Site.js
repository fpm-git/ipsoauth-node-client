const Url = require('url');
const Request = require('request');

const errors = require('./errors');
const Api = require('./Api');
const Token = require('./Token');

/**
 * Create an instance of the API
 *
 * options contains the following required parameters:
 *  - clientID
 *  - clientSecret
 *  - baseURL       The site's base URL, including trailing slash
 *
 * @param options
 * @constructor
 */
let Site = function (options) {
    if (!options.clientID || !options.clientSecret || !options.baseURL) {
        throw new Error("Missing required option - clientID, clientSecret and baseURL are required");
    }

    options.tokenPath = options.tokenPath || options.baseURL + "applications/oauth/interface/token.php";
    options.authorizePath = options.authorizePath || options.baseURL + "?app=oauth&module=auth&controller=auth";
    options.apiRoot = options.apiRoot || options.baseURL + "applications/oauth/interface/api.php?endpoint=";

    this.options = options;
};

/**
 * Get the authorization URL for this site
 *
 * @param {string} redirectURI  The URI to redirect to after authorization
 * @param {string[]} [scopes]   The scopes to request for this authorization
 * @param {string} [state]      The state to include in the request
 */
Site.prototype.authorizationURL = function (redirectURI, scopes, state) {
    let authUrl = Url.parse(this.options.authorizePath, true);
    authUrl.query.response_type = 'code';
    authUrl.query.client_id = this.options.clientID;
    authUrl.query.redirect_uri = redirectURI;
    if (scopes) {
        authUrl.query.scope = scopes.join(' ');
    }
    if (state) {
        authUrl.query.state = state;
    }

    // To rebuild the query, we have to clear the search field
    delete authUrl.search;
    return Url.format(authUrl);
};

/**
 * Process the response from an authorization request
 *
 * @param {object} params       The query string parameters
 * @param {string} redirectURI  The redirect URI used with authorizationURL
 * @param {string} [state]      The state to check for
 * @param {function} cb         Callback, which takes err, a Token object and an Api object
 */
Site.prototype.processAuthorizationResponse = function (params, redirectURI, state, cb) {
    if (typeof state === "function") {
        cb = state;
        state = null;
    }
    if (state && params.state !== state) {
        return cb(new errors.BadResponseError());
    }
    if (params.error) {
        if (params.error === 'access_denied') {
            return cb(new errors.AuthorizationDeniedError());
        }
        return cb(new errors.AuthorizationFailedError(params.error, params.error_description, params.error_uri));
    }
    if (!params.code) {
        return cb(new errors.BadResponseError());
    }

    this.requestToken({ authCode: params.code, redirectURI: redirectURI }, function(err, tokens) {
        if (err) {
            return cb(err);
        }
        token = new Token(tokens, this);
        cb(null, token, new Api(token, this));
    });
};

/**
 * Get refresh+access token from server
 *
 * @param opts
 * @param cb
 * @access private
 */
Site.prototype.requestToken = function (opts, cb) {
    let options = {
        uri: this.options.tokenPath,
        form: {
            // POST data
            client_id: this.options.clientID,
            client_secret: this.options.clientSecret
        },
        headers: {
            'User-Agent': 'FloatplaneClub (+floatplaneclub.com)'
        }
    };

    if (opts.refreshToken) {
        options.form.refresh_token = opts.refreshToken;
        options.form.grant_type = 'refresh_token';
    } else if (opts.authCode) {
        if (!opts.redirectURI) {
            return cb(new Error("redirectURI must be provided with authCode"));
        }
        options.form.code = opts.authCode;
        options.form.grant_type = 'authorization_code';
        options.form.redirect_uri = opts.redirectURI;
    } else {
        return cb(new Error("refreshToken or authCode must be provided"));
    }

    Request.post(options, function(error, response, body) {
        if (error) {
            return cb(error);
        }
        if (response.statusCode !== 200) {
            return cb(new errors.BadResponseError(response.statusCode, body));
        }

        let data;
        try {
            data = JSON.parse(body);
            if (!data.access_token) {
                return cb(new errors.BadResponseError(response.statusCode, body));
            }
        } catch (e) {
            return cb(new errors.BadResponseError(response.statusCode, body));
        }
        // The body has all the information that we want to pass back to the caller, so just give it that
        return cb(null, data);
    });
};

module.exports = Site;