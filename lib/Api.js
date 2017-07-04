const request = require('request');

const Token = require('./Token');
const errors = require('./errors');

/*********************
 *  Define the APIs  *
 *********************/

let addApis = function(self) {
    self.core = {
        member: {
            get: function (cb) {
                self.request('/core/member', 'get', {}, cb);
            }
        }
    };
};

/*********************
 * Define API Class  *
 *********************/

/**
 * API Connection library
 *
 * @param {Token|string} tokens
 * @param {Site} site
 * @constructor
 */
let Api = function(tokens, site) {
    if (!(tokens instanceof Token)) {
        // Convert it to a token object (it's either a refresh token or serialised Token)
        tokens = new Token(tokens, site);
    }
    this.token = tokens;
    this.site = site;

    // Add APIs
    addApis(this);
};


/**
 * Make an API request
 *
 * @param {string} endpoint
 * @param {string} method
 * @param {object} opts
 * @param {function} cb
 * @private
 */
Api.prototype.request = function (endpoint, method, opts, cb) {
    let self = this;

    if (typeof opts === "function") {
        cb = opts;
        opts = {};
    }
    opts.method = method.toUpperCase();
    if (opts.headers === undefined) {
        opts.headers = {};
    }
    opts.headers['User-Agent'] = 'Node IPS OAuth Client/1.0';

    this.token.getAccessToken(function (err, accessToken) {
        if (err) {
            return cb(err);
        }

        let makeRequest = function(accessToken, retryOnTokenError) {
            let uri = self.site.options.apiRoot + endpoint;
            if (self.token.type === "query") {
                uri += (uri.indexOf('?') === -1 ? '?' : '&') + 'token=' + accessToken;
            } else if (self.token.type === "bearer") {
                opts.headers.Authorization = "Bearer " + accessToken;
            } else {
                cb(new Error("Unsupported token type"));
            }

            request(uri, opts, function (err, response, body) {
                if (err) {
                    return cb(err);
                }

                let result = null;
                if (body) {
                    try {
                        result = JSON.parse(body);
                    } catch (e) {
                        return cb(new errors.BadResponseError(response.statusCode, body));
                    }
                }

                if (response.statusCode >= 300) {
                    if (retryOnTokenError && response.statusCode === 401 && result && result.error === "invalid_token") {
                        // Maybe an invalid/expired token
                        return self.token.refreshAccessToken(function(err, accessToken) {
                            if (err) {
                                return cb(err);
                            }
                            return makeRequest(accessToken, false); // don't try again if this fails
                        });
                    }

                    if (result) {
                        return cb(new errors.ApiResponseError(response.statusCode, result.error, result.message));
                    } else {
                        return cb(new errors.BadResponseError(response.statusCode, body));
                    }
                }

                return cb(null, result);
            });
        };

        makeRequest(accessToken, true);
    });
};


module.exports = Api;