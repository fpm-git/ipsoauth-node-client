import Token from './Token.js';
import * as errors from './errors.js';

function addApis(self) {
  self.core = {
    member: {
      async get() {
        return self.request('/core/member', 'get', {});
      }
    }
  };
}

class Api {
  constructor(tokens, site) {
    if (!(tokens instanceof Token)) {
      tokens = new Token(tokens, site);
    }
    this.token = tokens;
    this.site = site;
    addApis(this);
  }

  /**
   * Make an API request
   * @param {string} endpoint
   * @param {string} method
   * @param {object} opts
   * @returns {Promise<any>}
   */
  async request(endpoint, method, opts = {}) {
    opts.method = method.toUpperCase();
    opts.headers = opts.headers || {};
    opts.headers['User-Agent'] = 'Node IPS OAuth Client/1.0';

    const accessToken = await this.token.getAccessToken();
    let uri = this.site.apiRoot + endpoint;
    if (this.token.type === 'query') {
      uri += (uri.indexOf('?') === -1 ? '?' : '&') + 'token=' + accessToken;
    } else if (this.token.type === 'bearer') {
      opts.headers.Authorization = 'Bearer ' + accessToken;
    } else {
      throw new Error('Unsupported token type');
    }

    let response = await fetch(uri, opts);
    let body = await response.text();
    let result = null;
    if (body) {
      try {
        result = JSON.parse(body);
      } catch (e) {
        throw new errors.BadResponseError(response.status, body);
      }
    }
    if (response.status >= 300) {
      if (response.status === 401 && result && result.error === 'invalid_token') {
        // Try to refresh token and retry once
        await this.token.refreshAccessToken();
        return this.request(endpoint, method, opts);
      }
      if (result && typeof result === 'object' && result.error) {
        throw new errors.ApiResponseError(response.status, result.error, result.message);
      }
      throw new errors.BadResponseError(response.status, body);
    }
    return result;
  }
}

export default Api;
