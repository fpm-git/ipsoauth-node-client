import {expect} from 'chai';
import fetchMock from 'fetch-mock';
import {Site} from '../index.js';

describe("ipsoauth-client", function () {
  before(() => fetchMock.mockGlobal())
  afterEach(() => fetchMock.removeRoutes());

  it("should create a valid API instance from a successful authorization response", async function () {
    const apiResponse = {
      basic_info: {
        name: 'TestUser', id: 1001, photo: 'http://example.com/uploads/1001.png', groupName: 'Members', groupId: 3, postCount: 86
      }
    };
    fetchMock
      .postOnce('https://example.com/test/applications/oauth/interface/token.php', {
        status: 200, body: {
          access_token: "TestAccessToken", token_type: 'query'
        }
      })
      .getOnce('https://example.com/test/applications/oauth/interface/api.php?endpoint=/core/member&token=TestAccessToken', {
        status: 200,
        body: apiResponse
      });

    const site = new Site({
      clientID: "TestClientID", clientSecret: "TestClientSecret", baseURL: "https://example.com/test/"
    });
    const { tokens, api } = await site.processAuthorizationResponse({
      code: "TestCode"
    }, "http://localhost/redirect");
    const info = await api.core.member.get();
    expect(info).to.eql(apiResponse);
  });
});
