const expect = require('expect.js');
const nock = require('nock');

const Api = require('./../lib/Api');
const lib = require('../index');

describe("Api", function () {
    describe("construction", function () {
        it("should construct with all the correct API endpoints", function() {
            let site = new lib.Site({
                clientID: "TestClientID",
                clientSecret: "TestClientSecret",
                baseURL: "https://example.com/test/"
            });
            let api = new Api(new lib.Token({
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
    describe("#request", function () {
        let site = new lib.Site({
            clientID: "TestClientID",
            clientSecret: "TestClientSecret",
            baseURL: "https://example.com/test/"
        });
        let api = new Api(new lib.Token({
            access_token: "TestAccessToken",
            refresh_token: "TestRefreshToken",
            expires_in: 86400,
            token_type: "query"
        }, site), site);

        it("should make API requests correctly when it has a valid access token", function (done) {
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
                .get('/test/applications/oauth/interface/api.php')
                .query({'endpoint': '/core/member', 'token': 'TestAccessToken'})
                .reply(200, apiResponse);


            api.core.member.get(function (err, result) {
                expect(err).to.not.be.ok();
                expect(result).to.eql(apiResponse);
                expect(nockRequest.isDone()).to.equal(true);

                done();
            });
        });

        it("should request a new API key if the access token is invalid, then try again", function(done) {
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
                .get('/test/applications/oauth/interface/api.php')
                .query({'endpoint': '/core/member', 'token': 'TestNewAccessToken'})
                .reply(200, apiResponse)

                .get('/test/applications/oauth/interface/api.php')
                .query({'endpoint': '/core/member', 'token': 'TestAccessToken'})
                .reply(401, {error: "invalid_token", message: "The access token was invalid or expired"})

                .post('/test/applications/oauth/interface/token.php', {
                    client_id: "TestClientID",
                    client_secret: "TestClientSecret",
                    grant_type: 'refresh_token',
                    refresh_token: 'TestRefreshToken'
                })
                .reply(200, {
                    access_token: "TestNewAccessToken",
                    token_type: 'query'
                });


            api.core.member.get(function (err, result) {
                expect(err).to.not.be.ok();
                expect(result).to.eql(apiResponse);
                expect(nockRequest.isDone()).to.equal(true);

                done();
            });
        });

        it("should be successful even if no body is returned", function (done) {
            let nockRequest = nock('https://example.com')
                .get('/test/applications/oauth/interface/api.php')
                .query({'endpoint': '/core/member', 'token': 'TestNewAccessToken'})
                .reply(200, null);


            api.core.member.get(function (err, result) {
                expect(err).to.not.be.ok();
                expect(result).to.eql(null);
                expect(nockRequest.isDone()).to.equal(true);

                done();
            });
        });

        it("should be successful when a 2xx status code is returned", function (done) {
            let nockRequest = nock('https://example.com')
                .get('/test/applications/oauth/interface/api.php')
                .query({'endpoint': '/core/member', 'token': 'TestNewAccessToken'})
                .reply(201, null);


            api.core.member.get(function (err, result) {
                expect(err).to.not.be.ok();
                expect(result).to.eql(null);
                expect(nockRequest.isDone()).to.equal(true);

                done();
            });
        });

        it("should return a BadResponseError on invalid JSON", function (done) {
            let nockRequest = nock('https://example.com')
                .get('/test/applications/oauth/interface/api.php')
                .query({'endpoint': '/core/member', 'token': 'TestNewAccessToken'})
                .reply(200, "<html></html>");


            api.core.member.get(function (err, result) {
                expect(err).to.be.a(lib.errors.BadResponseError);
                expect(nockRequest.isDone()).to.equal(true);

                done();
            });
        });

        it("should return a BadResponseError on empty error response", function (done) {
            let nockRequest = nock('https://example.com')
                .get('/test/applications/oauth/interface/api.php')
                .query({'endpoint': '/core/member', 'token': 'TestNewAccessToken'})
                .reply(500, null);


            api.core.member.get(function (err, result) {
                expect(err).to.be.a(lib.errors.BadResponseError);
                expect(nockRequest.isDone()).to.equal(true);

                done();
            });
        });

        it("should return an ApiResponseError on valid error", function (done) {
            let nockRequest = nock('https://example.com')
                .get('/test/applications/oauth/interface/api.php')
                .query({'endpoint': '/core/member', 'token': 'TestNewAccessToken'})
                .reply(503, {error: "offline", message: "The site is currently offline"});


            api.core.member.get(function (err, result) {
                expect(err).to.be.a(lib.errors.ApiResponseError);
                expect(err.statusCode).to.equal(503);
                expect(err.error).to.equal("offline");
                expect(err.message).to.equal("The site is currently offline");
                expect(nockRequest.isDone()).to.equal(true);

                done();
            });
        });
    });
});