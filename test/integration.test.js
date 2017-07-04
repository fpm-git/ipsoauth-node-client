const expect = require('expect.js');
const nock = require('nock');

const lib = require('../index');

describe("ipsoauth-client", function () {
    it("should create a valid API instance from a successful authorization response", function (done) {
        let apiResponse = {
            basic_info: {
                name: 'TestUser',
                id: 1001,
                photo: 'http://example.com/uploads/1001.png',
                groupName: 'Members',
                groupId: 3,
                postCount: 86
            }
        };
        let nockRequest = nock('https://example.com')
            .post('/test/applications/oauth/interface/token.php', {
                client_id: "TestClientID",
                client_secret: "TestClientSecret",
                grant_type: 'authorization_code',
                code: 'TestCode'
            })
            .reply(200, {
                access_token: "TestAccessToken",
                token_type: 'query'
            })

            .get('/test/applications/oauth/interface/api.php')
            .query({'endpoint': '/core/member', 'token': 'TestAccessToken'})
            .reply(200, apiResponse);

        let site = new lib.Site({
            clientID: "TestClientID",
            clientSecret: "TestClientSecret",
            baseURL: "https://example.com/test/"
        });
        site.processAuthorizationResponse({
            code: "TestCode"
        }, "http://localhost/redirect", function (err, token, api) {
            expect(err).to.not.be.ok();

            api.core.member.get(function (err, info) {
                expect(err).to.not.be.ok();
                expect(info).to.eql(apiResponse);
                expect(nockRequest.isDone()).to.equal(true);

                done();
            });
        });
    });
});