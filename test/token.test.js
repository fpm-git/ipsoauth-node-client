import {expect} from 'chai';
import fetchMock from 'fetch-mock';
import {Site, Token} from '../index.js';

describe("Token", function () {
  before(() => fetchMock.mockGlobal())
  afterEach(() => fetchMock.removeRoutes());

  const site = new Site({
    clientID: "TestClientID", clientSecret: "TestClientSecret", baseURL: "https://example.com/test/"
  });

  describe("construction", function () {
    it("should fill the fields correctly from a token API response", function () {
      const startDate = Date.now();
      const t = new Token({
        access_token: 'TestAccessToken', refresh_token: 'TestRefreshToken', expires_in: 100, token_type: 'query'
      }, site);
      const endDate = Date.now();

      expect(t.access_token).to.equal("TestAccessToken");
      expect(t.refresh_token).to.equal("TestRefreshToken");
      expect(t.type).to.equal("query");
      expect(t.expires.getTime()).to.be.within(startDate + 100000, endDate + 100000);
      expect(t.site).to.equal(site);
    });
  });

  describe("#getAccessToken", function () {
    it("should return the valid access token without accessing the API", async function () {
      const t = new Token({
        access_token: 'TestAccessToken', refresh_token: 'TestRefreshToken', expires_in: 100, token_type: 'query'
      }, site);
      const token = await t.getAccessToken();
      expect(token).to.equal("TestAccessToken");
    });

    it("should fetch a new token if the old one has expired", async function () {
      fetchMock.post('https://example.com/test/applications/oauth/interface/token.php', {
        status: 200, body: {
          access_token: "TestAccessToken", expires_in: 100, refresh_token: "TestRefreshToken", token_type: 'Bearer'
        }
      }, { repeat: 1 });
      const t = new Token({
        access_token: 'DeadAccessToken', refresh_token: 'TestRefreshToken', expires: 1, token_type: 'query'
      }, site);
      const startDate = Date.now();
      const token = await t.getAccessToken();
      expect(token).to.equal("TestAccessToken");
      expect(t.access_token).to.equal(token);
      expect(t.expires.getTime()).to.be.within(startDate + 100000, Date.now() + 100000);
      expect(t.type).to.equal("Bearer");
    });

    it("should fetch a new token if one didn't exist before", async function () {
      fetchMock.post('https://example.com/test/applications/oauth/interface/token.php', {
        status: 200, body: {
          access_token: "TestAccessToken", token_type: 'query'
        }
      }, { repeat: 1 });
      const t = new Token({
        refresh_token: 'TestRefreshToken', expires_in: 3600, token_type: 'query'
      }, site);
      const token = await t.getAccessToken();
      expect(token).to.equal("TestAccessToken");
      expect(t.expires).to.equal(null);
    });

    it("should call the callback after receiving a new token", async function () {
      fetchMock.post('https://example.com/test/applications/oauth/interface/token.php', {
        status: 200, body: {
          access_token: "TestAccessTokenNew", expires_in: 100, refresh_token: "TestRefreshTokenNew", token_type: 'Bearer'
        }
      }, { repeat: 1 });
      const token1 = new Token({
        refresh_token: 'TestRefreshToken', expires_in: 3600, token_type: 'query'
      }, site);
      let callbackCalled = false;
      token1.setChangeCallback(function (newTokenObj) {
        callbackCalled = true;
        expect(newTokenObj).to.be.ok;
      });
      const token = await token1.getAccessToken();
      expect(token).to.equal("TestAccessTokenNew");
      expect(token1.access_token).to.equal(token);
      expect(callbackCalled).to.be.true;
    });

    it("should replace the token change callback when requested", async function () {
      fetchMock.post('https://example.com/test/applications/oauth/interface/token.php', {
        status: 200, body: {
          access_token: "TestAccessTokenNew", expires_in: 100, refresh_token: "TestRefreshTokenNew", token_type: 'Bearer'
        }
      }, { repeat: 1 });
      const t = new Token({
        refresh_token: 'TestRefreshToken', expires_in: 3600, token_type: 'query'
      }, site);
      let callbackCalled = false;
      t.setChangeCallback(function (newTokenObj) {
        callbackCalled = true;
        expect(newTokenObj).to.be.ok;
      });
      const token = await t.getAccessToken();
      expect(token).to.equal("TestAccessTokenNew");
      expect(t.access_token).to.equal(token);
      expect(callbackCalled).to.be.true;
    });
  });

  describe("serialization and deserialization", function () {
    it("should load the expires field correctly from serialized version", function () {
      const t = new Token({
        access_token: 'TestAccessToken', refresh_token: 'TestRefreshToken', expires: 1000, token_type: 'query'
      }, site);

      expect(t.expires.getTime()).to.equal(1000);
    });

    it("should parse JSON correctly", function () {
      const t = new Token('{"access_token": "TestAccessToken", "refresh_token": "TestRefreshToken", "expires": 1000 , "token_type": "query"}', site);

      expect(t.access_token).to.equal("TestAccessToken");
      expect(t.refresh_token).to.equal("TestRefreshToken");
      expect(t.expires.getTime()).to.equal(1000);
      expect(t.type).to.equal("query");
    });

    it("should reserialize to the original value", function () {
      const old = new Token({
        access_token: 'TestAccessToken', refresh_token: 'TestRefreshToken', expires: 1000, token_type: 'query'
      }, site);

      const t = new Token(old.toString(), site);

      expect(t.access_token).to.equal("TestAccessToken");
      expect(t.refresh_token).to.equal("TestRefreshToken");
      expect(t.expires.getTime()).to.equal(1000);
      expect(t.type).to.equal("query");
    });

    it("should json stringify and convert to a string to produce the same value", function () {
      const t = new Token({
        access_token: 'TestAccessToken', refresh_token: 'TestRefreshToken', expires: 1000, token_type: 'query'
      }, site);
      const tokenObj = JSON.parse(JSON.stringify(t));
      expect(tokenObj.access_token).to.equal(t.access_token);
      expect(tokenObj.refresh_token).to.equal(t.refresh_token);
      expect(tokenObj.expires).to.equal(t.expires.toISOString());
      expect(tokenObj.type).to.equal(t.type);
    });
  });

  describe("revoke", function () {
    it("should make a revocation request to the server when asked", async function () {
      fetchMock.post('https://example.com/test/applications/oauth/interface/revoke.php', { status: 204 }, { repeat: 1 });
      const t = new Token({
        refresh_token: 'TestRefreshToken', expires_in: 3600, token_type: 'query'
      }, site);
      await t.revoke();
    });
  });
});
