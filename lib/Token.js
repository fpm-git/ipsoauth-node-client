/**
 * @param {string|object} tokenData
 * @param {Site} site
 * @param {callback} changeCallback
 * @constructor
 */
class Token {
  constructor(tokenData, site, changeCallback) {
    try {
      if (typeof tokenData === "string") {
        tokenData = JSON.parse(tokenData);
      }
      this.access_token = tokenData.access_token || null;
      this.refresh_token = tokenData.refresh_token || null;
      if (tokenData.expires) {
        this.expires = new Date(tokenData.expires);
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
    this.changeCallback = changeCallback || function noop(token) {
    };
  }

  /**
   * Get an access token asynchronously
   * Note: The token is not guaranteed to work - it may have been revoked, or it may expire before it is used
   */
  async getAccessToken() {
    if (this.access_token && (!this.expires || this.expires.getTime() > Date.now())) {
      return this.access_token;
    }
    // Otherwise we need to generate a new one
    return this.refreshAccessToken();
  }

  /**
   * Generate a new access token
   */
  async refreshAccessToken() {
    if (!this.refresh_token) {
      throw new Error("A refresh token is required to generate a new access token");
    }
    const tokens = await this.site.requestToken({ refreshToken: this.refresh_token });
    this.access_token = tokens.access_token;
    this.refresh_token = tokens.refresh_token || this.refresh_token;
    if (tokens.expires_in) {
      this.expires = new Date(Date.now() + tokens.expires_in * 1000);
    } else {
      this.expires = null;
    }
    this.type = tokens.token_type;

    this.changeCallback(this);
    return this.access_token;
  }

  setChangeCallback(callback) {
    this.changeCallback = callback;
  }

  /**
   * Revoke the refresh token. The access token will remain valid until it expires.
   * @returns {Promise<boolean>}
   */
  async revoke() {
    if (!this.refresh_token) {
      throw new Error("There's no refresh token to revoke");
    }
    await this.site.revokeRefreshToken(this.refresh_token);
    this.refresh_token = null;
    return true;
  }

  toString() {
    return JSON.stringify({
      access_token: this.access_token,
      refresh_token: this.refresh_token,
      expires: this.expires,
      type: this.type
    });
  }
}

export default Token;
