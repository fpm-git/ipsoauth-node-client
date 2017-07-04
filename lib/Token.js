
let Token = function (tokenData, site) {
    try {
        if (typeof tokenData === "string") {
            tokenData = JSON.parse(tokenData);
        }
        this.access_token = tokenData.access_token || null;
        this.refresh_token = tokenData.refresh_token || null;
        if (tokenData.expires) {
            this.expires = new Date(tokenData.expires)
        } else if (tokenData.expires_in) {
            this.expires = new Date(Date.now() + tokenData.expires_in * 1000);
        } else {
            this.expires = null;
        }
        this.type = tokenData.token_type || tokenData.type;
    } catch (e) {
        if (e instanceof SyntaxError) {
            // JSON decode failed - the token must just be a refresh token
            this.refresh_token = tokenData;
            this.access_token = null;
            this.expires = new Date(0);
        } else {
            throw e;
        }
    }
    if (!site) {
        throw new Error("Missing site");
    }
    this.site = site;
};

/**
 * Get an access token asynchronously
 * Note: The token is not guaranteed to work - it may have been revoked, or it may expire before it is used
 *
 * @param {function} cb
 */
Token.prototype.getAccessToken = function (cb) {
    if (this.access_token && (!this.expires || this.expires.getTime() > Date.now())) {
        return cb(null, this.access_token);
    }
    // Otherwise we need to generate a new one
    this.refreshAccessToken(cb);
};

/**
 * Generate a new access token
 *
 * @param {function} cb
 */
Token.prototype.refreshAccessToken = function (cb) {
    if (!this.refresh_token) {
        return cb(new Error("A refresh token is required to generate a new access token"));
    }
    let that = this;
    this.site.requestToken({refreshToken: this.refresh_token}, function (error, tokens) {
        if (error) {
            return cb(error);
        }
        that.access_token = tokens.access_token;
        that.refresh_token = tokens.refresh_token || that.refresh_token;
        if (tokens.expires_in) {
            that.expires = new Date(Date.now() + tokens.expires_in * 1000);
        } else {
            that.expires = null;
        }
        that.type = tokens.token_type;

        return cb(null, that.access_token);
    });
};



Token.prototype.toString = function () {
    return JSON.stringify(this);
};

Token.prototype.toJSON = function () {
    return {
        access_token: this.access_token,
        refresh_token: this.refresh_token,
        expires: this.expires.getTime(),
        token_type: this.type
    };
};


module.exports = Token;