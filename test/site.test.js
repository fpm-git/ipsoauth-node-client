import Url from 'url';
import {expect} from 'chai';
import fetchMock from 'fetch-mock';
import {Site, errors, Token, Api} from '../index.js';

describe('Site', function () {
  before(() => fetchMock.mockGlobal())
  afterEach(() => fetchMock.removeRoutes());

  const redirectURI = "http://localhost/cb/url?q=1";
  const baseURL = "https://example.com/test/";
  const site = new Site({
    clientID: "TestClientID", clientSecret: "TestClientSecret", baseURL: baseURL
  });

  describe("#getAuthorizationURL", function () {
    const authURL = Url.parse(site.getAuthorizationURL(redirectURI, ["basic_info.read", "email.read"], "TestState"), true);

    it("should point to the correct page", function () {
      expect(authURL.protocol).to.equal('https:');
      expect(authURL.host).to.equal("example.com");
      expect(authURL.pathname).to.equal("/test/");

      expect(authURL.query.app).to.equal("oauth");
      expect(authURL.query.module).to.equal("auth");
      expect(authURL.query.controller).to.equal("auth");
    });

    it("should add all requested parameters", function () {
      expect(authURL.query.client_id).to.equal("TestClientID");
      expect(authURL.query.redirect_uri).to.equal(redirectURI);
      expect(authURL.query.response_type).to.equal('code');
      expect(authURL.query.scope).to.equal("basic_info.read email.read");
      expect(authURL.query.state).to.equal("TestState");
    });
  });

  describe('#processAuthorizationResponse', function () {
    // This method makes a remote API call, which needs to be intercepted using nock
    // Check errors first though
    context("errors prior to making request", function () {
      it("should fail if the state is missing", async function () {
        try {
          await site.processAuthorizationResponse({ state: "wrong" }, redirectURI, "TestState");
        } catch (err) {
          expect(err).to.be.instanceof(errors.BadRedirectParameterError);
        }
      });

      it("should fail if the wrong state is passed in through options", async function () {
        try {
          await site.processAuthorizationResponse({
            code: 'TestCode', state: 'TestState'
          }, redirectURI, {
            state: 'WrongState'
          });
        } catch (err) {
          expect(err).to.be.instanceof(errors.BadRedirectParameterError);
        }
      });

      it("should fail if no code is included in the response", async function () {
        try {
          await site.processAuthorizationResponse({}, redirectURI);
        } catch (err) {
          expect(err).to.be.instanceof(errors.BadRedirectParameterError);
        }
      });

      it("should fail with AuthorizationDeniedError if the user denied the request", async function () {
        try {
          await site.processAuthorizationResponse({
            error: "access_denied"
          }, redirectURI);
        } catch (err) {
          expect(err).to.be.instanceof(errors.AuthorizationDeniedError);
        }
      });

      it("should fail with AuthorizationFailedError if the authorization fails for some other reason", async function () {
        try {
          await site.processAuthorizationResponse({
            error: "server_error"
          }, redirectURI);
        } catch (err) {
          expect(err).to.be.instanceof(errors.AuthorizationFailedError);
        }
      });
    });

    context("requests made correctly", function () {
      it("should work correctly when no state is expected", async function () {
        fetchMock.post('https://example.com/test/applications/oauth/interface/token.php', {
          status: 200, body: {
            access_token: "TestAccessToken", expires_in: 3600, refresh_token: "TestRefreshToken", token_type: 'query'
          }
        }, { repeat: 1 });
        const { tokens, api } = await site.processAuthorizationResponse({
          code: 'TestCode'
        }, redirectURI);
        expect(tokens instanceof Token).to.be.true;
        expect(tokens.access_token).to.equal('TestAccessToken');
        expect(tokens.refresh_token).to.equal('TestRefreshToken');
        expect(api instanceof Api).to.be.true;
        expect(api.token).to.equal(tokens);
      });

      it("should work correctly when the correct state is provided", async function () {
        fetchMock.post('https://example.com/test/applications/oauth/interface/token.php', {
          status: 200, body: {
            access_token: "TestAccessToken", expires_in: 3600, refresh_token: "TestRefreshToken", token_type: 'query'
          }
        }, { repeat: 1 });
        const { tokens, api } = await site.processAuthorizationResponse({
          code: 'TestCode', state: 'TestState'
        }, redirectURI, 'TestState');
        expect(tokens instanceof Token).to.be.true;
        expect(tokens.access_token).to.equal('TestAccessToken');
        expect(tokens.refresh_token).to.equal('TestRefreshToken');
        expect(api instanceof Api).to.be.true;
        expect(api.token).to.equal(tokens);
      });

      it("should fail with BadResponseError if the server is down", async function () {
        fetchMock.post('https://example.com/test/applications/oauth/interface/token.php', { status: 503, body: "offline" }, { repeat: 1 });
        try {
          await site.processAuthorizationResponse({
            code: 'TestCode'
          }, redirectURI);
        } catch (err) {
          expect(err).to.be.instanceof(errors.BadResponseError);
        }
      });

      it("should fail with BadResponseError if the server doesn't return an access token", async function () {
        fetchMock.post('https://example.com/test/applications/oauth/interface/token.php', {
          status: 200,
          body: { refresh_token: "TestRefreshToken" }
        }, { repeat: 1 });
        try {
          await site.processAuthorizationResponse({
            code: 'TestCode'
          }, redirectURI);
        } catch (err) {
          expect(err).to.be.instanceof(errors.BadResponseError);
        }
      });

      it("should not request a refresh token when none is requested", async function () {
        fetchMock.post('https://example.com/test/applications/oauth/interface/token.php', {
          status: 200, body: {
            access_token: "TestAccessToken", expires_in: 3600, token_type: 'query'
          }
        }, { repeat: 1 });
        const { tokens } = await site.processAuthorizationResponse({
          code: 'TestCode', state: 'TestState'
        }, redirectURI, 'TestState', {
          includeRefreshToken: false
        });
        expect(tokens).to.be.instanceof(Token);
      });

      it("should allow state to be passed in through options", async function () {
        fetchMock.post('https://example.com/test/applications/oauth/interface/token.php', {
          status: 200, body: {
            access_token: "TestAccessToken", expires_in: 3600, token_type: 'query'
          }
        }, { repeat: 1 });
        const { tokens } = await site.processAuthorizationResponse({
          code: 'TestCode', state: 'TestState'
        }, redirectURI, {
          includeRefreshToken: false, state: 'TestState'
        });
        expect(tokens).to.be.instanceof(Token);
      });
    });
  });

  describe("#requestToken", function () {
    it("should work with a refresh token", async function () {
      fetchMock.post('https://example.com/test/applications/oauth/interface/token.php', {
        status: 200, body: {
          access_token: "TestAccessToken", expires_in: 3600, refresh_token: "TestRefreshToken", token_type: 'query'
        }
      }, { repeat: 1 });
      const result = await site.requestToken({
        refreshToken: 'TestRefreshToken'
      });
      expect(result.access_token).to.equal('TestAccessToken');
      expect(result.refresh_token).to.equal('TestRefreshToken');
      expect(result.expires_in).to.equal(3600);
      expect(result.token_type).to.equal('query');
    });
  });
});
