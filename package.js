Package.describe({
    name: 'clinical:vault-server',
    version: '8.0.16',
    summary: 'Add FHIR API endpoints to your Node on FHIR application.',
    git: 'https://github.com/clinical-meteor/vault-server'
});

Package.onUse(function(api) {
    api.versionsFrom('1.0');

    // core build
    api.use('meteor-base@1.5.1');
    api.use('webapp@1.13.0');
    api.use('ecmascript@0.16.0');
    api.use('react-meteor-data@2.4.0');

    api.use('ddp@1.4.0');
    api.use('livedata@1.0.18');
    api.use('es5-shim@4.8.0');

    api.use('check', 'server');
    api.use('meteorhacks:async@1.0.0', 'server');

    // database drivers, data cursors
    api.use('mongo');
    api.use('aldeed:collection2@3.5.0');
    api.use('matb33:collection-hooks@1.0.1');
    api.use('clinical:extended-api@2.5.0');

    // FHIR data layer
    api.use('simple:json-routes@2.3.1');
    api.use('clinical:hl7-resource-datatypes@4.0.5');
    api.use('clinical:hl7-fhir-data-infrastructure@6.17.0');

    // REST Endpoints
    api.addFiles('FhirServer/Core.js', 'server');
    api.addFiles('FhirServer/Metadata.js', 'server');

    // OAuth Server
    api.addFiles('OAuthServer/common.js', ['client', 'server']);
    api.addFiles('OAuthServer/meteor-model.js', 'server');
    api.addFiles('OAuthServer/server.js', 'server');
    api.addFiles('OAuthServer/client.js', 'client');

    api.addAssets('certs/EMRDirectTestCA.crt', 'server');

    // DDP autopublish 
    api.addFiles('lib/Collections.js');
});

Npm.depends({
    "faker": "5.1.0",
    "express": "4.13.4",
    "body-parser": "1.14.2",

    // oauth server using Express
    // https://www.npmjs.com/package/oauth2-server
    "oauth2-server": "3.1.1",

    // https://www.npmjs.com/package/express-oauth-server
    "express-oauth-server": "2.0.0",

    // oauth2 client; redundant to fhirclient, but usefull
    // https://www.npmjs.com/package/simple-oauth2
    "simple-oauth2": "4.3.0",

    // openid client
    // https://www.npmjs.com/package/openid
    "openid": "2.0.10",

    // oauth2 middleware for connecting to Asymmetrick FHIR server
    // https://www.npmjs.com/package/passport-oauth2
    "passport-oauth2": "1.6.1",

    // openid middleware for connecting to Asymmetrick FHIR server
    // https://www.npmjs.com/package/passport-openidconnect
    "passport-openidconnect": "0.1.1"

});
