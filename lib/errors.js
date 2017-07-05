/**
 * Error when authorization is denied by the user
 * @constructor
 */
function AuthorizationDeniedError() {
    Error.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = "AuthorizationDeniedError";
}
AuthorizationDeniedError.prototype = Object.create(Error.prototype);
AuthorizationDeniedError.prototype.constructor = AuthorizationDeniedError;

/**
 * Error when authorization fails for reasons outside the user's control
 *
 * @param [reason] The high level reason given by the server, from the error URL parameter
 * @param [description] The human-readable description of the error, from the error_description parameter
 * @param [url] A URL to find out more about the error, from the error_uri parameter
 * @constructor
 */
function AuthorizationFailedError(reason, description, url) {
    Error.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = "AuthorizationFailedError";
    this.reason = reason || null;
    this.description = description || null;
    this.url = url || null;
}
AuthorizationFailedError.prototype = Object.create(Error.prototype);
AuthorizationFailedError.prototype.constructor = AuthorizationFailedError;

AuthorizationFailedError.prototype.toString = function () {
    let result = "AuthorizationFailedError: " + this.reason;
    if (this.description) {
        result += " - " + this.description;
    }
    if (this.url) {
        result += " (" + this.url + ")";
    }
    return result;
};

/**
 * Error when the server returns an invalid response
 *
 * @param [statusCode]
 * @param [body]
 * @constructor
 */
function BadResponseError(statusCode, body) {
    Error.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = "BadResponseError";
    this.statusCode = statusCode || null;
    this.body = body || null;
}
BadResponseError.prototype = Object.create(Error.prototype);
BadResponseError.prototype.constructor = BadResponseError;

BadResponseError.prototype.toString = function () {
    return "BadResponseError" + (this.statusCode ? " (" + this.statusCode + ")" : "") + ": " + this.body;
};

/**
 * Error when the API returns an error
 *
 * @param statusCode
 * @param error
 * @param message
 * @constructor
 */
function ApiResponseError(statusCode, error, message) {
    Error.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = "ApiResponseError";
    this.statusCode = statusCode;
    this.error = error;
    this.message = message;
}
ApiResponseError.prototype = Object.create(Error.prototype);
BadResponseError.prototype.constructor = ApiResponseError;

ApiResponseError.prototype.toString = function () {
    return "ApiResponseError: " + this.error + "(" + this.message + ")";
};

/**
 * Error when invalid parameters are included on return from the authorization redirect
 *
 * @param param The parameter that was incorrect
 * @param val The value that it had
 * @constructor
 */
function BadRedirectParameterError(param, val) {
    Error.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = "BadRedirectParameterError";
    this.param = param;
    this.val = val;
}
BadRedirectParameterError.prototype = Object.create(Error.prototype);
BadRedirectParameterError.prototype.constructor = BadRedirectParameterError;

BadRedirectParameterError.prototype.toString = function () {
    return "BadRedirectParameterError" + (this.param ? ": " + this.param + " was " + (this.val === undefined ? "omitted" : this.val) : "");
};


module.exports = {
    AuthorizationDeniedError: AuthorizationDeniedError,
    AuthorizationFailedError: AuthorizationFailedError,
    BadResponseError: BadResponseError,
    ApiResponseError: ApiResponseError,
    BadRedirectParameterError: BadRedirectParameterError
};