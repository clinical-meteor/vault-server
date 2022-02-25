import { get, has } from 'lodash';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

import moment from 'moment';
import atob from 'atob';
import btoa from 'btoa';

// import asn from 'asn1.js';
// import ASN1 from '@lapo/asn1js';
// import Hex from '@lapo/asn1js/hex';
// import format from 'ecdsa-sig-formatter';

// import Base64 from '../lib/Base64';

let fhirPath = get(Meteor, 'settings.private.fhir.fhirPath');

// look into njwt
import jwt from 'jsonwebtoken';
import forge from 'node-forge';


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


export function formatPEM(pemString){
	const PEM_STRING_LENGTH = pemString.length, LINE_LENGTH = 64;
	const wrapNeeded = PEM_STRING_LENGTH > LINE_LENGTH;

	if(wrapNeeded){
		let formattedString = "", wrapIndex = 0;

		for(let i = LINE_LENGTH; i < PEM_STRING_LENGTH; i += LINE_LENGTH)
		{
			formattedString += pemString.substring(wrapIndex, i) + "\r\n";
			wrapIndex = i;
		}

		formattedString += pemString.substring(wrapIndex, PEM_STRING_LENGTH);
		return formattedString;
	} else {
		return pemString;
	}
}

Meteor.startup(function() {
  console.log('========================================================================');
  console.log('Generating SMART on FHIR / OAuth routes...');



  JsonRoutes.add("post", "/oauth/registration", function (req, res, next) {
    console.log('========================================================================');
    console.log('POST ' + '/oauth/registration');

    res.setHeader('Content-type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");

    console.log("");
    console.log('POST /registration payload', req.body);
    console.log("");

    let softwareStatement = get(req, 'body.software_statement');
    let decoded = jwt.decode(softwareStatement, {complete: true});

    console.log('decoded.payload', decoded.payload);
    console.log('decoded.header', decoded.header);
    console.log('decoded.header.x5c[0]', decoded.header.x5c[0]);

    
    let pemString = "-----BEGIN CERTIFICATE-----\r\n";
		pemString += formatPEM(decoded.header.x5c[0]);
		pemString = `${pemString}\r\n-----END CERTIFICATE-----\r\n`;

    console.log('pemString', pemString)

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

    // // TODO:  generalize to use certs from collection
    // // or to pull from a certificate store
    // // or use a master cert (CMS?)
    // let emrDirectCert = Assets.getText('certs/EMRDirectTestCA.crt');
    // console.log('emrDirectCert.pem', emrDirectCert);

    jwt.verify(softwareStatement, pemString, { algorithms: ['RS256'] },function(error, verifiedJwt){
      if(error){
        console.log('jwt.verify().error', error)
        isInvalidStatement = true;
      }
      if(verifiedJwt){
        console.log('jwt.verify().verifiedJwt', verifiedJwt)

        // couldn't find the registration
        if(OAuthClients.findOne({client_name: get(verifiedJwt, 'client_name')})){
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
          }, verifiedJwt);
    
          let clientId = OAuthClients.insert(newRecord);
          console.log('clientId', clientId)
    
          let dataPayload = {
            "client_id": clientId,
            "software_statement": softwareStatement
          }
    
          if(get(req, 'body.scope')){
            dataPayload.scope = encodeURIComponent(get(req, 'body.scope'));
          }
    
          dataPayload.client_uri = get(verifiedJwt, 'client_uri', Meteor.absoluteUrl());
    
          let redirectUriArray = [Meteor.absoluteUrl()];
    
          if(get(verifiedJwt, 'redirect_uris')){
            if(Array.isArray(get(verifiedJwt, 'redirect_uris'))){
              redirectUriArray = get(verifiedJwt, 'redirect_uris');
            } else {
              redirectUriArray.push(get(verifiedJwt, 'redirect_uris'));
            }
          } 
          dataPayload.redirect_uris = redirectUriArray;      
    
          if(get(verifiedJwt, 'client_name')){
            dataPayload.client_name = get(verifiedJwt, 'client_name');
          }
          if(get(verifiedJwt, 'grant_types')){
            dataPayload.grant_types = get(verifiedJwt, 'grant_types');
          }
          if(get(verifiedJwt, 'response_types')){
            dataPayload.response_types = get(verifiedJwt, 'response_types');
          }
          if(get(verifiedJwt, 'token_endpoint_auth_method')){
            dataPayload.token_endpoint_auth_method = get(verifiedJwt, 'token_endpoint_auth_method');
          }
    
          if(get(verifiedJwt, 'contacts')){
            dataPayload.contacts = get(verifiedJwt, 'contacts');
          }
          if(get(verifiedJwt, 'tos_uri')){
            dataPayload.tos_uri = get(verifiedJwt, 'tos_uri');
          }
          if(get(verifiedJwt, 'policy_uri')){
            dataPayload.policy_uri = get(verifiedJwt, 'policy_uri');
          }
          if(get(verifiedJwt, 'logo_uri')){
            dataPayload.logo_uri = get(verifiedJwt, 'logo_uri');
          }
    
          let hasInvalidMetadata = false;
          if(!get(verifiedJwt, 'client_name')){
            hasInvalidMetadata = true;
          }
          if(!get(verifiedJwt, 'redirect_uris')){
            hasInvalidMetadata = true;
          }
          if(!get(verifiedJwt, 'grant_types')){
            hasInvalidMetadata = true;
          }
          if(!get(verifiedJwt, 'response_types')){
            hasInvalidMetadata = true;
          }
          if(!get(verifiedJwt, 'token_endpoint_auth_method')){
            hasInvalidMetadata = true;
          }
    
    
    
          
          if(!get(verifiedJwt, 'iss')){
            isValidStatement = true;
          }
          if(!get(verifiedJwt, 'sub')){
            isValidStatement = true;
          }
          if(!get(verifiedJwt, 'aud')){
            isValidStatement = true;
          }
          if(!get(verifiedJwt, 'exp')){
            isValidStatement = true;
          }
          if(!get(verifiedJwt, 'iat')){
            isValidStatement = true;
          }
          if(get(verifiedJwt, 'iss') !== get(verifiedJwt, 'sub')){
            isValidStatement = true;
          }
          // in the future, but not more than 5 minutes
          console.log('exp', get(verifiedJwt, 'exp'));
          console.log('moment(exp).unix', moment.unix(get(verifiedJwt, 'exp')));
          if(moment.unix(get(verifiedJwt, 'exp')) > moment.unix(get(verifiedJwt, 'iat')).add(5, 'min')){
            console.log('exp should be in the future, but not more than 5 minutes')
            isValidStatement = true;
          }
          // iat is in the past
          console.log('iat', get(verifiedJwt, 'iat'));
          console.log('moment()', moment());
          console.log('moment(iat).unix', moment.unix(get(verifiedJwt, 'iat')));
          if(moment.unix(get(verifiedJwt, 'iat')) < moment()){
            console.log('iat should be in the past')
            isValidStatement = true;
          }
          
          // iis is in the past
          if(get(verifiedJwt, 'iis') === get(verifiedJwt, 'client_uri')){
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
    
      }
    });
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
