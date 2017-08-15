const Url = require('url');
const expect = require('expect.js');
const nock = require('nock');

const Site = require('../lib/Site');
const errors = require('../lib/errors');
const lib = require('../index');

describe('Site', function() {
    let redirectURI = "http://localhost/cb/url?q=1";
    let baseURL = "https://example.com/test/";

    let site = new Site({
        clientID: "TestClientID",
        clientSecret: "TestClientSecret",
        baseURL: baseURL
    });

    describe("#getAuthorizationURL", function () {
        let authURL = Url.parse(site.getAuthorizationURL(redirectURI, ["basic_info.read", "email.read"], "TestState"), true);

        it("should point to the correct page", function() {
            expect(authURL.protocol).to.equal('https:');
            expect(authURL.host).to.equal("example.com");
            expect(authURL.pathname).to.equal("/test/");

            expect(authURL.query.app).to.equal("oauth");
            expect(authURL.query.module).to.equal("auth");
            expect(authURL.query.controller).to.equal("auth");
        });

        it("should add all requested parameters", function() {
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
        context("errors prior to making request", function() {
            before(function() {
                // Block requests so we get an NetConnectNotAllowedError if we try to connect
                nock.disableNetConnect();
            });

            it("should fail if the state is missing", function (done) {
                site.processAuthorizationResponse({
                    code: "TestCode"
                }, redirectURI, 'TestState', function (err) {
                    expect(err).to.be.a(errors.BadRedirectParameterError);
                    expect(err.param).to.equal("state");
                    done();
                });
            });

            it("should fail if the wrong state is passed in through options", function(done) {
                site.processAuthorizationResponse({
                    code: 'TestCode',
                    state: 'TestState'
                }, redirectURI, {
                    state: 'WrongState'
                }, function (err, tokens, api) {
                    expect(err).to.be.a(errors.BadRedirectParameterError);
                    expect(err.param).to.equal("state");
                    done();
                });
            });

            it("should fail if no code is included in the response", function(done) {
                site.processAuthorizationResponse({}, redirectURI, function (err) {
                    expect(err).to.be.a(errors.BadRedirectParameterError);
                    expect(err.param).to.equal("code");
                    done();
                });
            });

            it("should fail with AuthorizationDeniedError if the user denied the request", function(done) {
                site.processAuthorizationResponse({
                    error: "access_denied"
                }, redirectURI, function (err) {
                    expect(err).to.be.an(errors.AuthorizationDeniedError);
                    done();
                });
            });

            it("should fail with AuthorizationFailedError if the authorization fails for some other reason", function(done) {
                site.processAuthorizationResponse({
                    error: "server_error"
                }, redirectURI, function (err) {
                    expect(err).to.be.an(errors.AuthorizationFailedError);
                    done();
                });
            });

            after(function () {
                nock.enableNetConnect();
            })
        });

        context("requests made correctly", function() {
            it("should work correctly when no state is expected", function(done) {
                let nockRequest = nock('https://example.com')
                    .post('/test/applications/oauth/interface/token.php', {
                        client_id: "TestClientID",
                        client_secret: "TestClientSecret",
                        redirect_uri: redirectURI,
                        grant_type: 'authorization_code',
                        code: 'TestCode',
                        include_refresh_token: '1'
                    })
                    .reply(200, {
                        access_token: "TestAccessToken",
                        expires_in: 3600,
                        refresh_token: "TestRefreshToken",
                        token_type: 'query'
                    });

                site.processAuthorizationResponse({
                    code: 'TestCode'
                }, redirectURI, function (err, tokens, api) {
                    expect(err).to.not.be.ok();
                    expect(tokens).to.be.a(lib.Token);
                    expect(tokens.access_token).to.equal('TestAccessToken');
                    expect(tokens.refresh_token).to.equal('TestRefreshToken');
                    expect(api).to.be.a(lib.Api);
                    expect(api.token).to.equal(tokens);
                    expect(nockRequest.isDone()).to.equal(true);

                    done();
                });
            });

            it("should work correctly when the correct state is provided", function(done) {
                let nockRequest = nock('https://example.com')
                    .post('/test/applications/oauth/interface/token.php', {
                        client_id: "TestClientID",
                        client_secret: "TestClientSecret",
                        redirect_uri: redirectURI,
                        grant_type: 'authorization_code',
                        code: 'TestCode',
                        include_refresh_token: '1'
                    })
                    .reply(200, {
                        access_token: "TestAccessToken",
                        expires_in: 3600,
                        refresh_token: "TestRefreshToken",
                        token_type: 'query'
                    });

                site.processAuthorizationResponse({
                    code: 'TestCode',
                    state: 'TestState'
                }, redirectURI, 'TestState', function (err, tokens, api) {
                    expect(err).to.not.be.ok();
                    expect(tokens).to.be.a(lib.Token);
                    expect(tokens.access_token).to.equal('TestAccessToken');
                    expect(tokens.refresh_token).to.equal('TestRefreshToken');
                    expect(api).to.be.a(lib.Api);
                    expect(api.token).to.equal(tokens);
                    expect(nockRequest.isDone()).to.equal(true);

                    done();
                });
            });

            it("should fail with BadResponseError if the server is down", function (done) {
                let nockRequest = nock('https://example.com')
                    .post('/test/applications/oauth/interface/token.php')
                    .reply(503, "offline");

                site.processAuthorizationResponse({
                    code: 'TestCode'
                }, redirectURI, function (err, tokens, api) {
                    expect(err).to.be.a(errors.BadResponseError);

                    done();
                });
            });

            it("should fail with BadResponseError if the server doesn't return an access token", function (done) {
                let nockRequest = nock('https://example.com')
                    .post('/test/applications/oauth/interface/token.php')
                    .reply(200, {
                        refresh_token: "TestRefreshToken"
                    });

                site.processAuthorizationResponse({
                    code: 'TestCode'
                }, redirectURI, function (err, tokens, api) {
                    expect(err).to.be.a(errors.BadResponseError);

                    done();
                });
            });

            it("should not request a refresh token when none is requested", function(done) {
                let nockRequest = nock('https://example.com')
                    .post('/test/applications/oauth/interface/token.php', function(body) {
                        return body.include_refresh_token === undefined ||
                            body.include_refresh_token === '0' ||
                            body.include_refresh_token === 'false';
                    })
                    .reply(200, {
                        access_token: "TestAccessToken",
                        expires_in: 3600,
                        token_type: 'query'
                    });

                site.processAuthorizationResponse({
                    code: 'TestCode',
                    state: 'TestState'
                }, redirectURI, 'TestState', {
                    includeRefreshToken: false
                }, function (err, tokens, api) {
                    expect(err).to.not.be.ok();
                    expect(tokens).to.be.a(lib.Token);
                    expect(nockRequest.isDone()).to.equal(true);

                    done();
                });
            });

            it("should allow state to be passed in through options", function(done) {
                let nockRequest = nock('https://example.com')
                    .post('/test/applications/oauth/interface/token.php', function(body) {
                        return body.include_refresh_token === undefined ||
                            body.include_refresh_token === '0' ||
                            body.include_refresh_token === 'false';
                    })
                    .reply(200, {
                        access_token: "TestAccessToken",
                        expires_in: 3600,
                        token_type: 'query'
                    });

                site.processAuthorizationResponse({
                    code: 'TestCode',
                    state: 'TestState'
                }, redirectURI, {
                    includeRefreshToken: false,
                    state: 'TestState'
                }, function (err, tokens, api) {
                    expect(err).to.not.be.ok();
                    expect(tokens).to.be.a(lib.Token);
                    expect(nockRequest.isDone()).to.equal(true);

                    done();
                });
            });
        });
    });

    describe("#requestToken", function () {
        it("should work with a refresh token", function(done) {
            let nockRequest = nock('https://example.com')
                .post('/test/applications/oauth/interface/token.php', {
                    client_id: "TestClientID",
                    client_secret: "TestClientSecret",
                    grant_type: 'refresh_token',
                    refresh_token: 'TestRefreshToken'
                })
                .reply(200, {
                    access_token: "TestAccessToken",
                    expires_in: 3600,
                    refresh_token: "TestRefreshToken",
                    token_type: 'query'
                });

            site.requestToken({
                refreshToken: 'TestRefreshToken'
            }, function (err, tokenResponse) {
                expect(err).to.not.be.ok();
                expect(tokenResponse.access_token).to.equal('TestAccessToken');
                expect(tokenResponse.refresh_token).to.equal('TestRefreshToken');
                expect(tokenResponse.expires_in).to.equal(3600);
                expect(tokenResponse.token_type).to.equal('query');
                expect(nockRequest.isDone()).to.equal(true);

                done();
            });
        });
    });
});