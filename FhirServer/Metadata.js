import { get, has } from 'lodash';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

import moment from 'moment';

let fhirPath = get(Meteor, 'settings.private.fhir.fhirPath');

import jwt from 'jsonwebtoken';

import forge from 'node-forge';
var pki = forge.pki;

let defaultInteractions = [{
  "code": "read"
}];

let defaultSearchParams = [
  {
    "name": "_id",
    "type": "token",
    "documentation": "_id parameter always supported."
  },
  {
    "name": "identifier",
    "type": "token",
    "documentation": "this should be the medical record number"
  }]

const Server = {
  getCapabilityStatement: function(){
    var CapabilityStatement = {
      "resourceType": "CapabilityStatement",
      "url": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.fhirPath'),
      "name": get(Meteor, 'settings.public.title'),
      "version": get(Meteor, 'settings.public.version'),
      "status": "draft",
      "experimental": true,
      "publisher": "Symptomatic, LLC",
      "kind": "capability",
      "date": new Date(),
      "contact": get(Meteor, 'settings.public.contact'),
      "software": {
        "version" : "6.1.0",
        "name" : "Vault Server",
        "releaseDate" : new Date()
      },
      "fhirVersion": get(Meteor, 'settings.public.fhirVersion'),
      "format": [
        "json"
      ],
      "rest": [{
          "mode": "server",
          "resource": []
      }]
    };

    // let oAuthServerRunning = false;
    // if(oAuthServerRunning){
    //   CapabilityStatement.security = {
    //     "service": [],
    //   };
    // }


    if(get(Meteor, 'settings.private.fhir.disableOauth') !== true){
      CapabilityStatement.rest[0].security = {
        "service": [],
        "extension": []
      };
      CapabilityStatement.rest[0].security.service.push({
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/restful-security-service",
            "code": "SMART-on-FHIR"
          }
        ],
        "text": "OAuth2 using SMART-on-FHIR profile (see http://docs.smarthealthit.org)"
      })

      

      CapabilityStatement.rest[0].security.extension.push({
        "extension": [
          {
            "url": "token",
            "valueUri": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.tokenEndpoint', "oauth/token") 
          },
          {
            "url": "authorize",
            "valueUri": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.authorizationEndpoint', "oauth/authorize") 
          },
          {
            "url": "register",
            "valueUri": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.registrationEndpoint', "oauth/registration") 
          },
          {
            "url": "manage",
            "valueUri": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.manageEndpoint', "authorizations/manage")
          },
          {
            "url": "introspect",
            "valueUri": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.introspectEndpoint', "authorizations/introspect")
          },
          {
            "url": "revoke",
            "valueUri": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.revokeEndpoint', "authorizations/revoke")
          }
        ],
        "url": "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris"
      })
    }
    
    if (has(Meteor, 'settings.private.fhir.rest')) {
      Object.keys(Meteor.settings.private.fhir.rest).forEach(function(key){
        let newResourceStatement = {
          "type": key,
          "interaction": defaultInteractions,
          "versioning": "no-version"
          // "readHistory": false,
          // "updateCreate": false,
          // "conditionalCreate": false,
          // "conditionalUpdate": false,
          // "conditionalDelete": "not-supported"
          // "searchParam": defaultSearchParams
        }

        if (Array.isArray(Meteor.settings.private.fhir.rest[key].interactions)) {
          newResourceStatement.interaction = [];
          Meteor.settings.private.fhir.rest[key].interactions.forEach(function(item){
            newResourceStatement.interaction.push({
              "code": item
            })
            newResourceStatement.versioning = get(Meteor, 'settings.private.fhir.rest[' + key + '].versioning', "no-version")
          })
        }

        if (Array.isArray(Meteor.settings.private.fhir.rest[key].interactions)) {
          newResourceStatement.interaction = [];
          Meteor.settings.private.fhir.rest[key].interactions.forEach(function(item){
            newResourceStatement.interaction.push({
              "code": item
            })
            newResourceStatement.versioning = get(Meteor, 'settings.private.fhir.rest[' + key + '].versioning', "no-version")
          })
        }


        CapabilityStatement.rest[0].resource.push(newResourceStatement);
      })      
    }
    return CapabilityStatement;
  },
  getWellKnownSmartConfiguration: function(){
    let response = {
      "resourceType": "Basic",
      
      // required fields
      "authorization_endpoint": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.authorizationEndpoint', "oauth/authorize"),
      "token_endpoint":  Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.tokenEndpoint', "oauth/token") ,
      "capabilities": "http://localhost:3000/",

      // optional fields
      "scopes_supported": "",
      "response_types_supported": "",
      "management_endpoint": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.revokeEndpoint', "authorizations/manage"),
      "introspection_endpoint": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.revokeEndpoint', "authorizations/introspect"),
      "registration_endpoint": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.registrationEndpoint', "oauth/registration"),
      "revocation_endpoint": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.revokeEndpoint', "authorizations/revoke"),

      // custom fields
      "message": "smart config!"
    }

    return response;
  },
  getWellKnownUdapConfiguration: function(){
    let response = {
      "resourceType": "Basic",
      "x5c": [],      
      "udap_versions_supported": ["1"],
      "udap_certifications_supported": ["https://vhdir.meteorapp.com/udap/profiles/example-certification"],
      "udap_certifications_required": ["https://vhdir.meteorapp.com/udap/profiles/example-certification"],
      "grant_types_supported": ["authorization_code", "refresh_token",  "client_credentials"],
      "scopes_supported": ["openid", "launch/patient"],
      "authorization_endpoint": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.authorizationEndpoint', "oauth/authorize"),
      "token_endpoint": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.tokenEndpoint', "oauth/token"),
      "token_endpoint_auth_methods_supported": ["private_key_jwt"],
      "token_endpoint_auth_signing_alg_values_supported": ["RS256", "ES384"],

      "registration_endpoint": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.registrationEndpoint', "oauth/registration"),
      "registration_endpoint_jwt_signing_alg_values_supported": ["RS256", "ES384"],
      "signed_metadata": null,
      "raw_metadata": {
        "iss": Meteor.absoluteUrl(),
        "sub": Meteor.absoluteUrl(),
        "exp": moment().unix(),
        "iat": moment().unix(),
        "jti": "random-value-" + Random.id(),
        "authorization_endpoint": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.authorizationEndpoint', "oauth/authorize"),
        "token_endpoint": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.tokenEndpoint', "oauth/token"),
        "registration_endpoint": Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.security.registrationEndpoint', "oauth/registration")
      }
    }

    let fhirRestEndpoints = get(Meteor, 'settings.private.fhir.rest');
    if(fhirRestEndpoints){
      Object.keys(fhirRestEndpoints).forEach(function(key){
        response.scopes_supported.push("system/" + key + ".read")
      })
    }

    let x509publicKey = get(Meteor, 'settings.private.x509.publicKey');
    console.log('x509publicKey', x509publicKey)
    response.x5c.push(x509publicKey)



    return response;
  }
}

Meteor.startup(function() {
  console.log('========================================================================');
  console.log('Generating CapabilityStatement of current configuration...');
  console.log(Server.getCapabilityStatement());
  console.log('========================================================================');

  JsonRoutes.add("get", fhirPath + "/metadata", function (req, res, next) {
    console.log('GET ' + fhirPath + '/metadata');

    res.setHeader('Content-type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");

    let returnPayload = {
      code: 200,
      data: Server.getCapabilityStatement()
    }
    if(process.env.TRACE){
      console.log('return payload', returnPayload);
    }
   
    JsonRoutes.sendResult(res, returnPayload);
  });

  JsonRoutes.add("get", "/metadata", function (req, res, next) {
    console.log('GET ' + '/metadata');

    res.setHeader('Content-type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");

    let returnPayload = {
      code: 200,
      data: Server.getCapabilityStatement()
    }
    if(process.env.TRACE){
      console.log('return payload', returnPayload);
    }
   
    JsonRoutes.sendResult(res, returnPayload);
  });


  JsonRoutes.add("get", "/.well-known/smart-configuration", function (req, res, next) {
    console.log('========================================================================');

    console.log('GET ' + '/.well-known/smart-configuration');

    res.setHeader('Content-type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");

    let returnPayload = {
      code: 200,
      data: Server.getWellKnownSmartConfiguration()
    }
    if(process.env.TRACE){
      console.log('return payload', returnPayload);
    }
   
    JsonRoutes.sendResult(res, returnPayload);
  });

  JsonRoutes.add("get", fhirPath + "/.well-known/udap", function (req, res, next) {
    console.log('========================================================================');

    console.log('GET ' + fhirPath + '/.well-known/udap');

    res.setHeader('Content-type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");

    let returnPayload = {
      code: 200,
      data: Server.getWellKnownUdapConfiguration()
    }
    if(process.env.TRACE){
      console.log('return payload', returnPayload);
    }
   
    JsonRoutes.sendResult(res, returnPayload);
  });

  JsonRoutes.add("get", "/.well-known/udap", function (req, res, next) {
    console.log('========================================================================');

    console.log('GET ' + '/.well-known/udap');

    res.setHeader('Content-type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");

    let returnPayload = {
      code: 200,
      data: Server.getWellKnownUdapConfiguration()
    }
    if(process.env.TRACE){
      console.log('return payload', returnPayload);
    }
   
    JsonRoutes.sendResult(res, returnPayload);
  });




  JsonRoutes.add("post", "/oauth/registration", function (req, res, next) {
    console.log('========================================================================');
    console.log('POST ' + '/oauth/registration');

    res.setHeader('Content-type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");

    console.log("")
    console.log(req.body)
    console.log("")

    let softwareStatement = get(req, 'body.software_statement');
    let decoded = jwt.decode(softwareStatement, {complete: true});

    let decodedSoftwareStatement = decoded.payload;

    console.log('decodedSoftwareStatement', decoded.payload);

    console.log('decodedSoftwareStatement.header', decoded.header);

    let hasIncorrect509 = false;
    if(!get(decoded, 'header')){
      hasIncorrect509 = true;
    }
    if(!get(decoded.header, 'x5c')){
      hasIncorrect509 = true;
    }
    if(get(decoded.header, 'x5c')){
      if(Array.isArray(get(decoded.header, 'x5c'))){
        if(decoded.header.x5c.length === 0){
          hasIncorrect509 = true;
        }
      } else {
        hasIncorrect509 = true;
      }
    }

    // TODO:  generalize to use certs from collection
    // or to pull from a certificate store
    // or use a master cert (CMS?)
    let emrDirectCert = Assets.getText('certs/EMRDirectTestCA.crt');
    // let validationCert = get(Meteor, 'settings.private.x509.trustCertificate')
    console.log('emrDirectCert', emrDirectCert);

    var emrDirectPublicCert = pki.certificateFromPem(emrDirectCert);
    console.log('emrDirectPublicCert', emrDirectPublicCert)
    console.log('emrDirectPublicCert.publicKey', emrDirectPublicCert.publicKey)

    var emrPublicKey = pki.publicKeyToPem(emrDirectPublicCert.publicKey);
    console.log('emrPublicKey', emrPublicKey)

    let validatedSoftwareStatement = jwt.verify(softwareStatement, emrPublicKey, { algorithms: ['RS256'] },function(error, result){
      console.log('jwt.validate.error', error)
      console.log('jwt.validate.result', result)
    });

    // couldn't find the registration
    if(OAuthClients.findOne({client_name: get(decodedSoftwareStatement, 'client_name')})){
      // oops, already found the registration
      JsonRoutes.sendResult(res, {
        code: 400,
        data: {
          "error": "unapproved_software_statement"
        }
      });  
    } else {
      // let newRecord = Object.assign({}, req.body);
      // newRecord.createdAt = new Date();
      // newRecord.active = true;
      
      // UDAP 
      let newRecord = Object.assign({
        "software_statement": softwareStatement
      }, decodedSoftwareStatement);

      let clientId = OAuthClients.insert(newRecord);
      console.log('clientId', clientId)

      let dataPayload = {
        "client_id": clientId,
        "software_statement": softwareStatement
      }

      if(get(req, 'body.scope')){
        dataPayload.scope = encodeURIComponent(get(req, 'body.scope'));
      }

      dataPayload.client_uri = get(decodedSoftwareStatement, 'client_uri', Meteor.absoluteUrl());

      let redirectUriArray = [Meteor.absoluteUrl()];

      if(get(decodedSoftwareStatement, 'redirect_uris')){
        if(Array.isArray(get(decodedSoftwareStatement, 'redirect_uris'))){
          redirectUriArray = get(decodedSoftwareStatement, 'redirect_uris');
        } else {
          redirectUriArray.push(get(decodedSoftwareStatement, 'redirect_uris'));
        }
      } 
      dataPayload.redirect_uris = redirectUriArray;      

      if(get(decodedSoftwareStatement, 'client_name')){
        dataPayload.client_name = get(decodedSoftwareStatement, 'client_name');
      }
      if(get(decodedSoftwareStatement, 'grant_types')){
        dataPayload.grant_types = get(decodedSoftwareStatement, 'grant_types');
      }
      if(get(decodedSoftwareStatement, 'response_types')){
        dataPayload.response_types = get(decodedSoftwareStatement, 'response_types');
      }
      if(get(decodedSoftwareStatement, 'token_endpoint_auth_method')){
        dataPayload.token_endpoint_auth_method = get(decodedSoftwareStatement, 'token_endpoint_auth_method');
      }

      if(get(decodedSoftwareStatement, 'contacts')){
        dataPayload.contacts = get(decodedSoftwareStatement, 'contacts');
      }
      if(get(decodedSoftwareStatement, 'tos_uri')){
        dataPayload.tos_uri = get(decodedSoftwareStatement, 'tos_uri');
      }
      if(get(decodedSoftwareStatement, 'policy_uri')){
        dataPayload.policy_uri = get(decodedSoftwareStatement, 'policy_uri');
      }
      if(get(decodedSoftwareStatement, 'logo_uri')){
        dataPayload.logo_uri = get(decodedSoftwareStatement, 'logo_uri');
      }

      let hasInvalidMetadata = false;
      if(!get(decodedSoftwareStatement, 'client_name')){
        hasInvalidMetadata = true;
      }
      if(!get(decodedSoftwareStatement, 'redirect_uris')){
        hasInvalidMetadata = true;
      }
      if(!get(decodedSoftwareStatement, 'grant_types')){
        hasInvalidMetadata = true;
      }
      if(!get(decodedSoftwareStatement, 'response_types')){
        hasInvalidMetadata = true;
      }
      if(!get(decodedSoftwareStatement, 'token_endpoint_auth_method')){
        hasInvalidMetadata = true;
      }



      let isInvalidStatement = false;
      if(!get(decodedSoftwareStatement, 'iss')){
        isValidStatement = true;
      }
      if(!get(decodedSoftwareStatement, 'sub')){
        isValidStatement = true;
      }
      if(!get(decodedSoftwareStatement, 'aud')){
        isValidStatement = true;
      }
      if(!get(decodedSoftwareStatement, 'exp')){
        isValidStatement = true;
      }
      if(!get(decodedSoftwareStatement, 'iat')){
        isValidStatement = true;
      }
      if(get(decodedSoftwareStatement, 'iss') !== get(decodedSoftwareStatement, 'sub')){
        isValidStatement = true;
      }
      // in the future, but not more than 5 minutes
      console.log('exp', get(decodedSoftwareStatement, 'exp'));
      console.log('moment(exp).unix', moment.unix(get(decodedSoftwareStatement, 'exp')));
      if(moment.unix(get(decodedSoftwareStatement, 'exp')) > moment.unix(get(decodedSoftwareStatement, 'iat')).add(5, 'min')){
        console.log('exp should be in the future, but not more than 5 minutes')
        isValidStatement = true;
      }
      // iat is in the past
      console.log('iat', get(decodedSoftwareStatement, 'iat'));
      console.log('moment()', moment());
      console.log('moment(iat).unix', moment.unix(get(decodedSoftwareStatement, 'iat')));
      if(moment.unix(get(decodedSoftwareStatement, 'iat')) < moment()){
        console.log('iat should be in the past')
        isValidStatement = true;
      }
      
      // iis is in the past
      if(get(decodedSoftwareStatement, 'iis') === get(decodedSoftwareStatement, 'client_uri')){
        console.log('iis should be the same as client_uri (?)')
        isValidStatement = true;
      }

      let returnPayload = {
        code: 201,
        data: dataPayload
      }
      
      if(isInvalidStatement){
        returnPayload.code = 400;
        returnPayload.data = {
          "error": "invalid_software_statement"
        };
      }   
      if(hasInvalidMetadata){
        returnPayload.code = 400;
        returnPayload.data = {
          "error": "invalid_client_metadata"
        };
      }   
      if(hasIncorrect509){
        returnPayload.code = 400;
        returnPayload.data = {
          "error": "invalid_software_statement"
        };
      }

      if(process.env.TRACE){
        console.log('return payload', returnPayload);
      }
     
      JsonRoutes.sendResult(res, returnPayload);  
    } 
  });
  JsonRoutes.add("get", "/oauth/token", function (req, res, next) {
    console.log('========================================================================');
    console.log('GET ' + '/oauth/token');

    res.setHeader('Content-type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");

    let returnPayload = {
      code: 200,
      data: {
        "message": 'token'
      }
    }
    if(process.env.TRACE){
      console.log('return payload', returnPayload);
    }
   
    JsonRoutes.sendResult(res, returnPayload);
  });
  JsonRoutes.add("get", "/oauth/authorize", function (req, res, next) {
    console.log('========================================================================');
    console.log('GET ' + '/oauth/authorize');

    res.setHeader('Content-type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");

    console.log("")
    console.log(req.query)
    console.log('Redirect: ' + get(req, 'query.redirect_uri'))
    console.log("")

    if(get(req, 'query.client_id')){
      let client = OAuthClients.findOne({_id: get(req, 'query.client_id')});
      if(client){
        console.log('client', client)
      } else {
        console.log('No client found matching that client_id');
      }
    }

    let returnPayload = {
      code: 200,
      data: {
        "message": 'authenticate'
      }
    }

    if(get(req, 'query.redirect_uri')){
      returnPayload.code = 301;
      res.setHeader("Location", get(req, 'query.redirect_uri'));

      console.log('returnPayload', returnPayload)
      JsonRoutes.sendResult(res, returnPayload);
    } else {
      console.log('returnPayload', returnPayload)
      JsonRoutes.sendResult(res, returnPayload);
    }   
  });

  JsonRoutes.add("get", "/authorizations/manage", function (req, res, next) {
    console.log('========================================================================');
    console.log('GET ' + '/authorizations/manage');

    res.setHeader('Content-type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");

    let returnPayload = {
      code: 200,
      data: {
        "message": 'authenticate'
      }
    }
    if(process.env.TRACE){
      console.log('return payload', returnPayload);
    }
   
    JsonRoutes.sendResult(res, returnPayload);
  });

  JsonRoutes.add("get", "/authorizations/introspect", function (req, res, next) {
    console.log('========================================================================');
    console.log('GET ' + '/authorizations/introspect');

    res.setHeader('Content-type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");

    let returnPayload = {
      code: 200,
      data: {
        "message": 'authenticate'
      }
    }
    if(process.env.TRACE){
      console.log('return payload', returnPayload);
    }
   
    JsonRoutes.sendResult(res, returnPayload);
  });

  JsonRoutes.add("post", "/authorizations/revoke", function (req, res, next) {
    console.log('========================================================================');
    console.log('POST ' + '/authorizations/revoke');

    res.setHeader('Content-type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");

    let searchQuery = {};
    if (get(req, 'query.client_name')) {
      console.log('query', get(req, 'query.client_name'))
      searchQuery.client_name = get(req, 'query.client_name');
    }

    if(get(req, 'query.client_id')){
      console.log('query', get(req, 'query.client_id'))
      searchQuery.client_id = get(req, 'query.client_id');
    }

    let removeSuccess = OAuthClients.remove(searchQuery);
    console.log('removeSuccess', removeSuccess);

    let returnPayload = {}

    if(removeSuccess){
      returnPayload.code = 200; 
    } else {
      returnPayload.code = 410;
    }
  
    if(process.env.TRACE){
      console.log('return payload', returnPayload);
    }
   
    JsonRoutes.sendResult(res, returnPayload);
  });
});




// Meteor.methods({
//   getMetadata(){
//     return Server.getCapabilityStatement();
//   }
// });
