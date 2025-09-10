import {expect} from 'chai';
import fetchMock from 'fetch-mock';
import {Site, Token, Api, errors} from '../index.js';

describe("Api", () => {
  before(() => fetchMock.mockGlobal())
  afterEach(() => fetchMock.removeRoutes());


  describe("construction", () => {
    it("should construct with all the correct API endpoints", () => {
      const site = new Site({
        clientID: "TestClientID",
        clientSecret: "TestClientSecret",
        baseURL: "https://example.com/test/"
      });
      const api = new Api(new Token({
        access_token: "TestAccessToken",
        refresh_token: "TestRefreshToken",
        expires_in: 86400,
        token_type: "query"
      }, site), site);

      expect(api).to.have.property('core');
      expect(api.core).to.be.an('object');
      expect(api.core.member.get).to.be.a("function");
    });
  });

  describe("#request", () => {
    const site = new Site({
      clientID: "TestClientID",
      clientSecret: "TestClientSecret",
      baseURL: "https://example.com/test/"
    });
    const api = new Api(new Token({
      access_token: "TestAccessToken",
      refresh_token: "TestRefreshToken",
      expires_in: 86400,
      token_type: "query"
    }, site), site);

    it("should make API requests correctly when it has a valid access token", async () => {
      const apiResponse = {
        basic_info: {
          name: 'TestUser',
          id: 1001,
          photo: 'http://example.com/uploads/1001.png',
          groupName: 'Members',
          groupId: 3,
          postCount: 86
        }
      };
      fetchMock.get(
        'https://example.com/test/applications/oauth/interface/api.php?endpoint=/core/member&token=TestAccessToken',
        { status: 200, body: apiResponse },
        { repeat: 1 }
      );
      const result = await api.core.member.get();
      expect(result).to.eql(apiResponse);
    });

    it("should request a new API key if the access token is invalid, then try again", async () => {
      const apiResponse = {
        basic_info: {
          name: 'TestUser',
          id: 1001,
          photo: 'http://example.com/uploads/1001.png',
          groupName: 'Members',
          groupId: 3,
          postCount: 86
        }
      };

      fetchMock
        .get(
          'https://example.com/test/applications/oauth/interface/api.php?endpoint=/core/member&token=TestAccessToken',
          { status: 401, body: { error: "invalid_token", message: "The access token was invalid or expired" } },
          { repeat: 1 }
        )
        .post(
          'https://example.com/test/applications/oauth/interface/token.php',
          { status: 200, body: { access_token: "TestNewAccessToken", token_type: 'query' } },
          { repeat: 1 }
        )
        .get(
          'https://example.com/test/applications/oauth/interface/api.php?endpoint=/core/member&token=TestNewAccessToken',
          { status: 200, body: apiResponse },
          { repeat: 1 }
        );

      const result = await api.core.member.get();
      expect(result).to.eql(apiResponse);
    });

    it("should be successful even if no body is returned", async () => {
      fetchMock.get(
        'https://example.com/test/applications/oauth/interface/api.php?endpoint=/core/member&token=TestNewAccessToken',
        { status: 200, body: null },
        { repeat: 1 }
      );
      const result = await api.core.member.get();
      expect(result).to.eql(null);
    });

    it("should be successful when a 2xx status code is returned", async () => {
      fetchMock.get(
        'https://example.com/test/applications/oauth/interface/api.php?endpoint=/core/member&token=TestNewAccessToken',
        { status: 201, body: null },
        { repeat: 1 }
      );
      const result = await api.core.member.get();
      expect(result).to.eql(null);
    });

    it("should return a BadResponseError on invalid JSON", async () => {
      fetchMock.get(
        'https://example.com/test/applications/oauth/interface/api.php?endpoint=/core/member&token=TestNewAccessToken',
        { status: 200, body: "<html></html>" },
        { repeat: 1 }
      );
      try {
        await api.core.member.get();
      } catch (err) {
        expect(err).to.be.instanceof(errors.BadResponseError);
      }
    });

    it("should return a BadResponseError on empty error response", async () => {
      fetchMock.get(
        'https://example.com/test/applications/oauth/interface/api.php?endpoint=/core/member&token=TestNewAccessToken',
        { status: 500, body: null },
        { repeat: 1 }
      );
      try {
        await api.core.member.get();
      } catch (err) {
        expect(err).to.be.instanceof(errors.BadResponseError);
      }
    });

    it("should return an ApiResponseError on valid error", async () => {
      fetchMock.get(
        'https://example.com/test/applications/oauth/interface/api.php?endpoint=/core/member&token=TestNewAccessToken',
        { status: 503, body: { error: "offline", message: "The site is currently offline" } },
        { repeat: 1 }
      );
      try {
        await api.core.member.get();
      } catch (err) {
        expect(err).to.be.instanceof(errors.ApiResponseError);
        expect(err.statusCode).to.equal(503);
        expect(err.error).to.equal("offline");
        expect(err.message).to.equal("The site is currently offline");
      }
    });
  });
});
