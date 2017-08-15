const expect = require('expect.js');
const nock = require('nock');

const Token = require('./../lib/Token');
const lib = require('../index');

describe("Token", function () {
    let site = new lib.Site({
        clientID: "TestClientID",
        clientSecret: "TestClientSecret",
        baseURL: "https://example.com/test/"
    });

    describe("construction", function () {
        it("should fill the fields correctly from a token API response", function () {
            let startDate = Date.now();
            let t = new Token({
                access_token: 'TestAccessToken',
                refresh_token: 'TestRefreshToken',
                expires_in: 100,
                token_type: 'query'
            }, site);
            let endDate = Date.now();

            expect(t.access_token).to.equal("TestAccessToken");
            expect(t.refresh_token).to.equal("TestRefreshToken");
            expect(t.type).to.equal("query");
            expect(t.expires.getTime()).to.be.within(startDate + 100000, endDate + 100000);
            expect(t.site).to.equal(site);
        });
    });

    describe("#getAccessToken", function () {
        it("should return the valid access token without accessing the API", function (done) {
            nock.disableNetConnect();

            let t = new Token({
                access_token: 'TestAccessToken',
                refresh_token: 'TestRefreshToken',
                expires_in: 100,
                token_type: 'query'
            }, site);

            t.getAccessToken(function (err, token) {
                expect(err).to.not.be.ok();
                expect(token).to.equal("TestAccessToken");

                nock.enableNetConnect();
                done();
            });
        });

        it("should fetch a new token if the old one has expired", function (done) {
            let nockRequest = nock('https://example.com')
                .post('/test/applications/oauth/interface/token.php', {
                    client_id: "TestClientID",
                    client_secret: "TestClientSecret",
                    grant_type: 'refresh_token',
                    refresh_token: 'TestRefreshToken'
                })
                .reply(200, {
                    access_token: "TestAccessToken",
                    expires_in: 100,
                    refresh_token: "TestRefreshToken",
                    token_type: 'Bearer'
                });

            let t = new Token({
                access_token: 'DeadAccessToken',
                refresh_token: 'TestRefreshToken',
                expires: 1,
                token_type: 'query'
            }, site);

            let startDate = Date.now();
            t.getAccessToken(function(err, token) {
                expect(err).to.not.be.ok();
                expect(token).to.equal("TestAccessToken");
                expect(t.access_token).to.equal(token);
                expect(t.expires.getTime()).to.be.within(startDate + 100000, Date.now() + 100000);
                expect(t.type).to.equal("Bearer");
                expect(nockRequest.isDone()).to.equal(true);

                done();
            });
        });

        it("should fetch a new token if one didn't exist before", function(done) {
            let nockRequest = nock('https://example.com')
                .post('/test/applications/oauth/interface/token.php', {
                    client_id: "TestClientID",
                    client_secret: "TestClientSecret",
                    grant_type: 'refresh_token',
                    refresh_token: 'TestRefreshToken'
                })
                .reply(200, {
                    access_token: "TestAccessToken",
                    token_type: 'query'
                });

            let t = new Token({
                refresh_token: 'TestRefreshToken',
                expires_in: 3600,
                token_type: 'query'
            }, site);

            t.getAccessToken(function(err, token) {
                expect(err).to.not.be.ok();
                expect(token).to.equal("TestAccessToken");
                expect(t.expires).to.equal(null);
                expect(nockRequest.isDone()).to.equal(true);

                done();
            });
        });

        it("should call the callback after receiving a new token", function(done) {
            let startDate = Date.now();
            let nockRequest = nock('https://example.com')
                .post('/test/applications/oauth/interface/token.php', {
                    client_id: "TestClientID",
                    client_secret: "TestClientSecret",
                    grant_type: 'refresh_token',
                    refresh_token: 'TestRefreshToken'
                })
                .reply(200, {
                    access_token: "TestAccessTokenNew",
                    expires_in: 100,
                    refresh_token: "TestRefreshTokenNew",
                    token_type: 'Bearer'
                });

            let t = new Token({
                refresh_token: 'TestRefreshToken',
                expires_in: 3600,
                token_type: 'query'
            }, site, function(newTokenObj) {
                expect(newTokenObj.access_token).to.equal("TestAccessTokenNew");
                expect(newTokenObj.refresh_token).to.equal("TestRefreshTokenNew");
                expect(newTokenObj.expires.getTime()).to.be.within(startDate + 100000, Date.now() + 100000);
                expect(newTokenObj.type).to.equal("Bearer");

                done();
            });

            t.getAccessToken(function(err, token) {});
        });

        it("should replace the token change callback when requested", function(done) {
            let nockRequest = nock('https://example.com')
                .post('/test/applications/oauth/interface/token.php', {
                    client_id: "TestClientID",
                    client_secret: "TestClientSecret",
                    grant_type: 'refresh_token',
                    refresh_token: 'TestRefreshToken'
                })
                .reply(200, {
                    access_token: "TestAccessTokenNew",
                    expires_in: 100,
                    refresh_token: "TestRefreshTokenNew",
                    token_type: 'Bearer'
                });

            let t = new Token({
                refresh_token: 'TestRefreshToken',
                expires_in: 3600,
                token_type: 'query'
            }, site, function(newTokenObj) {
                done("Wrong callback called");
            });

            t.setChangeCallback(function(newTokenObj) {
                expect(newTokenObj).to.be.ok();
                done();
            });

            t.getAccessToken(function(err, token) {});
        });
    });

    describe("serialization and deserialization", function () {
        it("should load the expires field correctly from serialized version", function () {
            let t = new Token({
                access_token: 'TestAccessToken',
                refresh_token: 'TestRefreshToken',
                expires: 1000,
                token_type: 'query'
            }, site);

            expect(t.expires.getTime()).to.equal(1000);
        });

        it("should parse JSON correctly", function () {
            let t = new Token('{"access_token": "TestAccessToken", "refresh_token": "TestRefreshToken", "expires": 1000 , "token_type": "query"}', site);

            expect(t.access_token).to.equal("TestAccessToken");
            expect(t.refresh_token).to.equal("TestRefreshToken");
            expect(t.expires.getTime()).to.equal(1000);
            expect(t.type).to.equal("query");
        });

        it("should reserialize to the original value", function () {
            let old = new Token({
                access_token: 'TestAccessToken',
                refresh_token: 'TestRefreshToken',
                expires: 1000,
                token_type: 'query'
            }, site);

            let t = new Token(old.toString(), site);

            expect(t.access_token).to.equal("TestAccessToken");
            expect(t.refresh_token).to.equal("TestRefreshToken");
            expect(t.expires.getTime()).to.equal(1000);
            expect(t.type).to.equal("query");
        });

        it("should json stringify and convert to a string to produce the same value", function () {
            let t = new Token({
                access_token: 'TestAccessToken',
                refresh_token: 'TestRefreshToken',
                expires: 1000,
                token_type: 'query'
            }, site);

            expect("" + t).to.equal(JSON.stringify(t));
        });
    });

    describe("revoke", function() {
        it("should make a revocation request to the server when asked", function(done) {
            let nockRequest = nock('https://example.com')
                .post('/test/applications/oauth/interface/revoke.php', {
                    client_id: "TestClientID",
                    client_secret: "TestClientSecret",
                    token: 'TestRefreshToken'
                })
                .reply(204);

            let t = new Token({
                refresh_token: 'TestRefreshToken',
                expires_in: 3600,
                token_type: 'query'
            }, site);

            t.revoke(function(err) {
                expect(err).to.not.be.ok();
                expect(nockRequest.isDone()).to.equal(true);

                done();
            });
        });
    });
});