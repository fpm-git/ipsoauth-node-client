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



module.exports = {
    AuthorizationDeniedError: AuthorizationDeniedError,
    AuthorizationFailedError: AuthorizationFailedError,
    BadResponseError: BadResponseError
};