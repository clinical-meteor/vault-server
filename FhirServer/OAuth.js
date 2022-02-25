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


Meteor.startup(function() {
  console.log('========================================================================');
  console.log('Generating SMART on FHIR / OAuth routes...');



  JsonRoutes.add("post", "/oauth/registration", function (req, res, next) {
    console.log('========================================================================');
    console.log('POST ' + '/oauth/registration');

    res.setHeader('Content-type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");

    console.log("")
    console.log('POST /registration payload', req.body)
    console.log("")

    let softwareStatement = get(req, 'body.software_statement');
    let decoded = jwt.decode(softwareStatement, {complete: true});

    console.log('decodedSoftwareStatement.header', decoded.header);
    console.log('decodedSoftwareStatement.payload', decoded.payload);

    let hasIncorrect509 = false;
    let isInvalidStatement = false;

    if(!get(decoded, 'header')){
      hasIncorrect509 = true;
    }
    if(!get(decoded.header, 'x5c')){
      // hasIncorrect509 = true;
      isInvalidStatement = true;
    }
    if(get(decoded.header, 'x5c')){
      if(Array.isArray(get(decoded.header, 'x5c'))){
        if(decoded.header.x5c.length === 0){
          // hasIncorrect509 = true;
          isInvalidStatement = true;
        }
      } else {
        // hasIncorrect509 = true;
        isInvalidStatement = true;
      }
    }

    // TODO:  generalize to use certs from collection
    // or to pull from a certificate store
    // or use a master cert (CMS?)
    let emrDirectCert = Assets.getText('certs/EMRDirectTestCA.crt');
    console.log('emrDirectCert.pem', emrDirectCert);

    var emrDirectPublicCert = pki.certificateFromPem(emrDirectCert);
    console.log('emrDirectPublicCert', emrDirectPublicCert);
    console.log('emrDirectPublicCert.certificate', emrDirectPublicCert.certificate);
    console.log('emrDirectPublicCert.publicKey', emrDirectPublicCert.publicKey);

    var emrDirectPublicKey = pki.publicKeyToPem(emrDirectPublicCert.publicKey);
    console.log('emrDirectPublicKey.pem', emrDirectPublicKey);

    let validatedSoftwareStatement = jwt.verify(softwareStatement, emrDirectPublicKey, { algorithms: ['RS256'] },function(error, decoded){
      if(error){
        console.log('jwt.validate.error', error)
        isInvalidStatement = true;
      }
      if(decoded){
        console.log('jwt.validate.decoded', decoded)
      }
    });

    // couldn't find the registration
    if(OAuthClients.findOne({client_name: get(decoded.payload, 'client_name')})){
      // oops, already found the registration
      JsonRoutes.sendResult(res, {
        code: 400,
        data: {
          "error": "invalid_software_statement"
        }
      });  
    } else {
      // let newRecord = Object.assign({}, req.body);
      // newRecord.createdAt = new Date();
      // newRecord.active = true;
      
      // UDAP 
      let newRecord = Object.assign({
        "software_statement": softwareStatement
      }, decoded.payload);

      let clientId = OAuthClients.insert(newRecord);
      console.log('clientId', clientId)

      let dataPayload = {
        "client_id": clientId,
        "software_statement": softwareStatement
      }

      if(get(req, 'body.scope')){
        dataPayload.scope = encodeURIComponent(get(req, 'body.scope'));
      }

      dataPayload.client_uri = get(decoded.payload, 'client_uri', Meteor.absoluteUrl());

      let redirectUriArray = [Meteor.absoluteUrl()];

      if(get(decoded.payload, 'redirect_uris')){
        if(Array.isArray(get(decoded.payload, 'redirect_uris'))){
          redirectUriArray = get(decoded.payload, 'redirect_uris');
        } else {
          redirectUriArray.push(get(decoded.payload, 'redirect_uris'));
        }
      } 
      dataPayload.redirect_uris = redirectUriArray;      

      if(get(decoded.payload, 'client_name')){
        dataPayload.client_name = get(decoded.payload, 'client_name');
      }
      if(get(decoded.payload, 'grant_types')){
        dataPayload.grant_types = get(decoded.payload, 'grant_types');
      }
      if(get(decoded.payload, 'response_types')){
        dataPayload.response_types = get(decoded.payload, 'response_types');
      }
      if(get(decoded.payload, 'token_endpoint_auth_method')){
        dataPayload.token_endpoint_auth_method = get(decoded.payload, 'token_endpoint_auth_method');
      }

      if(get(decoded.payload, 'contacts')){
        dataPayload.contacts = get(decoded.payload, 'contacts');
      }
      if(get(decoded.payload, 'tos_uri')){
        dataPayload.tos_uri = get(decoded.payload, 'tos_uri');
      }
      if(get(decoded.payload, 'policy_uri')){
        dataPayload.policy_uri = get(decoded.payload, 'policy_uri');
      }
      if(get(decoded.payload, 'logo_uri')){
        dataPayload.logo_uri = get(decoded.payload, 'logo_uri');
      }

      let hasInvalidMetadata = false;
      if(!get(decoded.payload, 'client_name')){
        hasInvalidMetadata = true;
      }
      if(!get(decoded.payload, 'redirect_uris')){
        hasInvalidMetadata = true;
      }
      if(!get(decoded.payload, 'grant_types')){
        hasInvalidMetadata = true;
      }
      if(!get(decoded.payload, 'response_types')){
        hasInvalidMetadata = true;
      }
      if(!get(decoded.payload, 'token_endpoint_auth_method')){
        hasInvalidMetadata = true;
      }



      
      if(!get(decoded.payload, 'iss')){
        isValidStatement = true;
      }
      if(!get(decoded.payload, 'sub')){
        isValidStatement = true;
      }
      if(!get(decoded.payload, 'aud')){
        isValidStatement = true;
      }
      if(!get(decoded.payload, 'exp')){
        isValidStatement = true;
      }
      if(!get(decoded.payload, 'iat')){
        isValidStatement = true;
      }
      if(get(decoded.payload, 'iss') !== get(decoded.payload, 'sub')){
        isValidStatement = true;
      }
      // in the future, but not more than 5 minutes
      console.log('exp', get(decoded.payload, 'exp'));
      console.log('moment(exp).unix', moment.unix(get(decoded.payload, 'exp')));
      if(moment.unix(get(decoded.payload, 'exp')) > moment.unix(get(decoded.payload, 'iat')).add(5, 'min')){
        console.log('exp should be in the future, but not more than 5 minutes')
        isValidStatement = true;
      }
      // iat is in the past
      console.log('iat', get(decoded.payload, 'iat'));
      console.log('moment()', moment());
      console.log('moment(iat).unix', moment.unix(get(decoded.payload, 'iat')));
      if(moment.unix(get(decoded.payload, 'iat')) < moment()){
        console.log('iat should be in the past')
        isValidStatement = true;
      }
      
      // iis is in the past
      if(get(decoded.payload, 'iis') === get(decoded.payload, 'client_uri')){
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
