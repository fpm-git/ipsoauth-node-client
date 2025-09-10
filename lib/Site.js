import Url from 'url';
import * as errors from './errors.js';
import Api from './Api.js';
import Token from './Token.js';

class Site {
  constructor(options = {}) {
    if (!options.clientID || !options.clientSecret || !options.baseURL) {
      throw new Error("Missing required option - clientID, clientSecret and baseURL are required");
    }
    this.clientID = options.clientID;
    this.clientSecret = options.clientSecret;
    this.baseURL = options.baseURL;
    this.tokenPath = options.tokenPath || options.baseURL + "applications/oauth/interface/token.php";
    this.authorizePath = options.authorizePath || options.baseURL + "?app=oauth&module=auth&controller=auth";
    this.apiRoot = options.apiRoot || options.baseURL + "applications/oauth/interface/api.php?endpoint=";
    this.revokePath = options.revokePath || options.baseURL + "applications/oauth/interface/revoke.php";
  }

  getAuthorizationURL(redirectURI, scopes, state) {
    const authUrl = Url.parse(this.authorizePath, true);
    authUrl.query.response_type = 'code';
    authUrl.query.client_id = this.clientID;
    authUrl.query.redirect_uri = redirectURI;
    if (scopes) {
      authUrl.query.scope = scopes.join(' ');
    }
    if (state) {
      authUrl.query.state = state;
    }
    delete authUrl.search;
    return Url.format(authUrl);
  }

  async processAuthorizationResponse(params, redirectURI, state, options = {}) {
    // Flexible argument handling
    if (typeof state === 'object' && state !== null) {
      options = state;
      state = options.state || null;
    }
    if (params.state && state && params.state !== state) {
      throw new errors.BadRedirectParameterError("state", params.state);
    }
    if (params.error) {
      if (params.error === 'access_denied') {
        throw new errors.AuthorizationDeniedError();
      }
      throw new errors.AuthorizationFailedError(params.error, params.error_description, params.error_uri);
    }
    if (!params.code) {
      throw new errors.BadRedirectParameterError("code");
    }
    const tokens = await this.requestToken({
      authCode: params.code,
      redirectURI,
      includeRefreshToken: options.includeRefreshToken !== false
    });
    const tokenObj = new Token(tokens, this);
    const api = new Api(tokenObj, this);
    return { tokens: tokenObj, api };
  }

  async requestToken(opts) {
    const form = new URLSearchParams();
    if (opts.authCode) {
      form.append('grant_type', 'authorization_code');
      form.append('code', opts.authCode);
      form.append('redirect_uri', opts.redirectURI);
    } else if (opts.refreshToken) {
      form.append('grant_type', 'refresh_token');
      form.append('refresh_token', opts.refreshToken);
    } else {
      throw new Error('Either authCode or refreshToken must be provided');
    }
    form.append('client_id', this.clientID);
    form.append('client_secret', this.clientSecret);
    if (opts.includeRefreshToken === false) {
      form.append('includeRefreshToken', '0');
    }
    const response = await fetch(this.tokenPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    });
    const body = await response.text();
    let result;
    try {
      result = JSON.parse(body);
    } catch (e) {
      throw new errors.BadResponseError(response.status, body);
    }
    if (response.status >= 300) {
      throw new errors.BadResponseError(response.status, body);
    }
    return result;
  }

  async revokeRefreshToken(refreshToken) {
    const form = new URLSearchParams();
    form.append('token', refreshToken);
    form.append('client_id', this.clientID);
    form.append('client_secret', this.clientSecret);
    const response = await fetch(this.revokePath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    });
    if (!response.ok) {
      throw new errors.BadResponseError(response.status, await response.text());
    }
    return true;
  }
}

export default Site;
