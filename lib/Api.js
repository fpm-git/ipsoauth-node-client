const request = require('request');

const Token = require('./Token');
const errors = require('./errors');

/*********************
 *  Define the APIs  *
 *********************/

let addApis = function(self) {
    self.core = {
        basic_info: {
            get: function (cb) {
                self.request('/core/basic_info', 'get', {}, cb);
            }
        }
    }
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
    opts.headers['User-Agent'] = 'FloatplaneClub (+floatplaneclub.com)';

    this.token.getAccessToken(function(err, accessToken) {
        if (err) {
            return cb(err);
        }

        let uri =  self.site.options.apiRoot + endpoint + (self.site.options.apiRoot.indexOf('?') === -1 ? '?' : '&') + 'token=' + accessToken;

        request(uri, opts, function(err, response, body) {
            if (err) {
                return cb(err);
            }
            if (response.statusCode >= 400) {
                return cb(new errors.BadResponseError(response.statusCode, body));
            }
            if (body) {
                try {
                    let result = JSON.parse(body);
                    return cb(null, result);
                } catch (e) {
                    if (e instanceof SyntaxError) {
                        return cb(new errors.BadResponseError(response.statusCode, body));
                    }
                    throw e;
                }
            }
        });
    });
};


module.exports = Api;