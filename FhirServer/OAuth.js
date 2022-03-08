
import http from 'http';

import { get, has, split, map, indexOf } from 'lodash';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { HTTP } from 'meteor/http';

import moment from 'moment';
import atob from 'atob';
import btoa from 'btoa';

import axios from 'axios';
import superagent from 'superagent';

// // import {exec as openssl} from 'openssl-wrapper';
// import Promise from 'bluebird';
// import {exec} from 'openssl-wrapper';
// const opensslAsync = Promise.promisify(exec);

import fetch from 'node-fetch';

// import asn from 'asn1.js';
// import ASN1 from '@lapo/asn1js';

const asn1js = require("asn1js");
const pkijs = require("pkijs");
const Certificate = pkijs.Certificate;

// import Hex from '@lapo/asn1js/hex';
// import format from 'ecdsa-sig-formatter';

// import Base64 from '../lib/Base64';

let fhirPath = get(Meteor, 'settings.private.fhir.fhirPath');

let emrDirectPem = Assets.getText('certs/EMRDirectTestCA.crt');
console.log('emrDirectPem', emrDirectPem);

// look into njwt
import jwt from 'jsonwebtoken';
import forge from 'node-forge';

// creates a CA store
var caStore = forge.pki.createCaStore([emrDirectPem]);

// var emrDirectIssuerCert = caStore.getIssuer(emrDirectPem);
// console.log('emrDirectIssuerCert', emrDirectIssuerCert);

// console.log('caStore', caStore)
// console.log('caStore', caStore.listAllCertificates())

console.log("-----CERT STORE-----")
caStore.listAllCertificates().forEach(function(cert){
  console.log('cert.signatureOid: ' + get(cert, 'signatureOid'));
});
console.log("--------------------")


// console.log("Verifying certificate store....")
// // verifies a certificate chain against a CA store
// forge.pki.verifyCertificateChain(caStore, function(error, result){
//   if(error){
//     console.log('verifyCertificateChain().error', error)
//   }
//   if(result){
//     console.log('verifyCertificateChain().result', result)
//   }
// });

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
function removeTrailingSlash(inputString){
  let response = "";

  if(inputString.slice(-1) === "/"){
    response = inputString.slice(0, inputString.length - 1);
  } else {
    response = inputString;
  }

  return response;
}
function parseCertAttributes(certActor){
  let result = "";
  if(has(certActor, 'attributes')){
    if(Array.isArray(certActor.attributes)){
      certActor.attributes.forEach(function(attribute){
        result = result + "  " + attribute["shortName"] + "=" + attribute["value"]
      })
    }
  }
  return result;
}
const fetchCertificate = (url, certificateArray) => {
  if(!certificateArray){
    certificateArray = [];
  }
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      const chunks = []
      // res.setEncoding('utf8');
      let body = ''; 
      res.on('data', function(chunk){
        // console.log('chunk', chunk)
        chunks.push(chunk)
        body += chunk;
        return body;
      });
      res.on('end', function(){

        console.log("=================================================================================================")
        const bodyBuffer = Buffer.concat(chunks);
        console.log('bodyBuffer', bodyBuffer)

        let shortcutAsn1;
        
        try {
          shortcutAsn1 = forge.asn1.fromDer(bodyBuffer.toString('binary'));
          process.env.DEBUG && console.log('shortcutAsn1', shortcutAsn1)
        } catch (error) {
          console.log('shortcutCert.error', error);                  
        }   

        let intermediateCert;
        try {
          intermediateCert = forge.pki.certificateFromAsn1(shortcutAsn1);
          process.env.DEBUG && console.log('intermediateCert', intermediateCert)

          if(intermediateCert){
            certificateArray.push(intermediateCert)
          }
        } catch (error) {
          console.log('intermediateCert.error', error);                  
        }  
        
        try {
          if(get(intermediateCert, 'extensions') && Array.isArray(intermediateCert.extensions)){
            intermediateCert.extensions.forEach(async function(extension){

              if(get(extension, 'name') === "authorityInfoAccess"){
                console.log('extension.value: ', extension.value.toString());

                let httpIndex = extension.value.toString().indexOf('http');
                console.log('httpIndex: ', httpIndex);
                
                let recursiveLookupUrl = extension.value.toString().substring(httpIndex);
                console.log('recursive lookup url: ', recursiveLookupUrl);

                let recursiveCert = await fetchCertificate(recursiveLookupUrl, []);
                process.env.DEBUG && console.log('recursiveCert', recursiveCert)
                

                if(Array.isArray(recursiveCert)){
                  console.log('recursiveCerts', recursiveCert)
                  recursiveCert.forEach(function(cert){
                    console.log('recursiveCert.subject:  ', parseCertAttributes(cert.subject))
                    console.log('recursiveCert.issuer:   ', parseCertAttributes(cert.issuer))  
                    certificateArray.push(cert)
                  })
                } else {
                  certificateArray.push(recursiveCert)

                  console.log('recursiveCert.subject:  ', parseCertAttributes(recursiveCert.subject))
                  console.log('recursiveCert.issuer:   ', parseCertAttributes(recursiveCert.issuer))
            
                  caStore.addCertificate(recursiveCert);  
                }  
              }
            })
          }

          process.env.DEBUG && console.log('intermediateCert', intermediateCert)
        } catch (error) {
          console.log('recursive lookup error', error);                  
        }  




        

        console.log("=================================================================================================")        
        return resolve(certificateArray)
      });
    }).on('error', reject);
  });
};

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

    let responseSent = false;
    let responsePayload = {data: {}};

    let softwareStatement = get(req, 'body.software_statement');
    let decoded = jwt.decode(softwareStatement, {complete: true});

    // this coding pattern is inconsistent through this method
    // we'd like to respond only once in the method at the very end
    // but because of the asynchronous time delay of some of the cryptography functions
    // we may want to bail early if we can
    // bottomline:  it's okay to do JsonRoutes.sendResult() at the top level
    //              but don't use it in the async callbacks

    if(decoded) {
      console.log('decoded.payload', decoded.payload);
      console.log('decoded.header', decoded.header);
    
      // UDAPTestTool IIA3a2	- No x5c header  
      if(!get(decoded, 'header')){
        console.log('header not present...')
        // Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "header not present..."}});
        JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}}); 
        // responseSent = true;
      } else {
        if(!get(decoded, 'header.x5c')){
          console.log('header.x5c not present...')
          // Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "header.x5c not present..."}});
          JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}}); 
          // responseSent = true;
        } else {
          if(!Array.isArray(get(decoded, 'header.x5c'))){
            console.log('header.x5c is not an array...')
            // Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "header.x5c is not an array..."}});
            JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}}); 
            // responseSent = true;
          } else {
            if(Array.isArray(get(decoded, 'header.x5c')) && (decoded.header.x5c.length === 0)){
              console.log('header.x5c is an empty array...')
              // Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "header.x5c is an empty array..."}});
              JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}}); 
              // responseSent = true;
            }
          }
        }  
      }

      console.log('decoded.header.x5c[0]', decoded.header.x5c[0]);
  
      
      let softwareStatementPem = "-----BEGIN CERTIFICATE-----\r\n";
      softwareStatementPem += formatPEM(decoded.header.x5c[0]);
      softwareStatementPem = `${softwareStatementPem}\r\n-----END CERTIFICATE-----\r\n`;
  
      console.log('softwareStatementPem', softwareStatementPem)


      if(decoded.payload){
        if(!get(decoded.payload, 'iss')){
          console.log('decoded payload did not contain an iss')
          Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "decoded payload did not contain an iss"}});
          // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}}); 
          // responseSent = true;
        }
        if(!get(decoded.payload, 'sub')){
          console.log('decoded payload did not contain an sub')
          Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "decoded payload did not contain an sub"}});
          // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}}); 
          // responseSent = true;
        }
        if(!get(decoded.payload, 'aud')){
          console.log('decoded payload did not contain an aud')
          Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "decoded payload did not contain an aud"}});
          // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}}); 
          // responseSent = true;
        }
        if(!get(decoded.payload, 'exp')){
          console.log('decoded payload did not contain an exp')
          Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "decoded payload did not contain an exp"}});
          // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}}); 
          // responseSent = true;
        }
        if(!get(decoded.payload, 'iat')){
          console.log('decoded payload did not contain an iat')
          Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "decoded payload did not contain an iat"}});
          // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}}); 
          // responseSent = true;
        }
        if(get(decoded.payload, 'iss') !== get(decoded.payload, 'sub')){
          console.log('decoded payload iss did not equal sub')
          Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "decoded payload iss did not equal sub"}});
          // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}}); 
          // responseSent = true;
        }

        // RE-ENABLE
        // UDAPTestTool IIA4a3	- aud equals registration endpoint
        if(!process.env.TRACE){
          console.log('registration endpoint: ' + removeTrailingSlash(Meteor.absoluteUrl()) + '/oauth/registration')
          if(!(get(decoded.payload, 'aud') === removeTrailingSlash(Meteor.absoluteUrl()) + '/oauth/registration')){
            console.log('decoded payload aud was not set to the current route')
            Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "decoded payload aud was not set to the current route"}});
            // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}});           
            responseSent = true;
          }  
        }

        console.log('exp: ' + moment.unix(get(decoded.payload, 'exp')).format("YYYY-MM-DD hh:mm:ss"))
        console.log('iat: ' + moment.unix(get(decoded.payload, 'iat')).format("YYYY-MM-DD hh:mm:ss"))
        console.log('now: ' + moment().format("YYYY-MM-DD hh:mm:ss"))
      }


      // // gets the issuer (its certificate) for the given certificate
      // var issuerCert = caStore.getIssuer(subjectCert);
      console.log('verifying certificate chain...');

      var emrDirectCert = forge.pki.certificateFromPem(emrDirectPem);
      // console.log('emrDirectCert', emrDirectCert);
      console.log('emrDirectCert.issuer:  ', parseCertAttributes(emrDirectCert.issuer));
      console.log('emrDirectCert.publicKey', emrDirectCert.publicKey);
      // console.log('emrDirect certificate: ' + parseCertAttributes(emrDirectCert))

      

      let certificatesArray = [];

      var softwareStatementCert = forge.pki.certificateFromPem(softwareStatementPem);
      console.log('softwareStatementCert.subject:  ', parseCertAttributes(softwareStatementCert.subject))
      console.log('softwareStatementCert.issuer:   ', parseCertAttributes(softwareStatementCert.issuer))
      console.log('softwareStatementCert.validity: ', softwareStatementCert.validity)
      console.log('softwareStatementCert.validity.notAfter', softwareStatementCert.validity.notAfter)

      if(get(softwareStatementCert, 'extensions') && Array.isArray(softwareStatementCert.extensions)){
        softwareStatementCert.extensions.forEach(async function(extension){
          // console.log('extension.name:             ', get(extension, 'name'));
          // console.log('extension.value:            ', get(extension, 'value'));
          // console.log('decodeURI(extension.value): ', decodeURI(get(extension, 'value')));
          
          if(get(extension, 'name') === "authorityInfoAccess"){
            console.log('extension.value: ', extension.value.toString());

            let httpIndex = extension.value.toString().indexOf('http');
            console.log('httpIndex: ', httpIndex);
            
            let intermediateCertLookupUrl = extension.value.toString().substring(httpIndex);
            console.log('intermediate cert lookup url: ', intermediateCertLookupUrl);

          
              const intermediateCerts = await fetchCertificate(intermediateCertLookupUrl, certificatesArray);
              process.env.DEBUG && console.log('intermediateCerts', intermediateCerts)

              if(Array.isArray(intermediateCerts)){
                console.log('intermediateCertss', intermediateCerts)
                intermediateCerts.forEach(function(cert){
                  console.log('intermediateCerts.subject:  ', parseCertAttributes(cert.subject))
                  console.log('intermediateCerts.issuer:   ', parseCertAttributes(cert.issuer))  
                  certificatesArray.push(cert)
                })
              } else {
                certificatesArray.push(recursiveCert)

                console.log('intermediateCerts.subject:  ', parseCertAttributes(intermediateCerts.subject))
                console.log('intermediateCerts.issuer:   ', parseCertAttributes(intermediateCerts.issuer))
          
                caStore.addCertificate(recursiveCert);  
              }  
          }
        })
      }

      console.log('');
      Object.keys(caStore.certs).forEach(function(key){
        console.log('caStore.certs.id:  ' + key);
        console.log('caStore.issuer:    ' + parseCertAttributes(caStore.certs[key].issuer))
        // console.log(caStore.certs[key]);
        console.log('');
      })




      console.log('softwareStatementCert.validity.notAfter.unix(): ' + moment.unix(get(softwareStatementCert, 'validity.notAfter')).format("YYYY-MM-DD hh:mm:ss"));
      console.log('now():      ' + moment().format("YYYY-MM-DD hh:mm:ss"));
        
      // check for expired certificate
      if(moment.unix(get(softwareStatementCert, 'validity.notAfter')) < moment()){
        console.log('certificate is expired')
        Object.assign(responsePayload, { code: 400, data: {"error": "unapproved_software_statement", "description": "exp should be in the future.  this one is in the past."}})
      } 
  
      // // TODO:  generalize to use certs from collection
      // // or to pull from a certificate store
      // // or use a master cert (CMS?)
  
      jwt.verify(softwareStatement, softwareStatementPem, { algorithms: ['RS256'] },function(error, verifiedJwt){
        if(error){
          console.log('jwt.verify().error', error)
  
          if(!process.env.TRACE){
            Object.assign(responsePayload, { code: 409, data: {"error": "invalid_software_statement", "description": error}});
            console.log('jwt.verify().error: ' + error)  
          }
        }
        if(verifiedJwt){
          Object.assign(responsePayload.data, verifiedJwt)
          console.log('jwt.verify().verifiedJwt', verifiedJwt)
    
          if(!get(verifiedJwt, 'client_name')){
            console.log('verified JWT did not have a client_name')
            Object.assign(responsePayload, { code: 400, data: {"error": "invalid_client_metadata", "description": "verified JWT did not have a client_name"}});
            // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_client_metadata"}}); 
            // responseSent = true;
          }
          if(!get(verifiedJwt, 'redirect_uris')){
            console.log('verified JWT did not have a redirect_uris')
            Object.assign(responsePayload, { code: 400, data: {"error": "invalid_client_metadata", "description": "verified JWT did not have a redirect_uris"}});
            // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_client_metadata"}}); 
            // responseSent = true;
          }
          if(!get(verifiedJwt, 'grant_types')){
            console.log('verified JWT did not have a grant_types')
            Object.assign(responsePayload, { code: 400, data: {"error": "invalid_client_metadata", "description": "verified JWT did not have a grant_types"}});
            // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_client_metadata"}}); 
            // responseSent = true;
          }
          if(!get(verifiedJwt, 'response_types')){
            console.log('verified JWT did not have a response_types')
            Object.assign(responsePayload, { code: 400, data: {"error": "invalid_client_metadata", "description": "verified JWT did not have a response_types"}});
            // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_client_metadata"}}); 
            // responseSent = true;
          }
          if(!get(verifiedJwt, 'token_endpoint_auth_method')){
            console.log('verified JWT did not have a token_endpoint_auth_method')
            Object.assign(responsePayload, { code: 400, data: {"error": "invalid_client_metadata", "description": "verified JWT did not have a token_endpoint_auth_method"}});
            // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_client_metadata"}}); 
            // responseSent = true;
          }
          
          console.log('exp.unix(): ' + moment.unix(get(verifiedJwt, 'exp')).format("YYYY-MM-DD hh:mm:ss"));
          console.log('iat.unix(): ' + moment.unix(get(verifiedJwt, 'iat')).format("YYYY-MM-DD hh:mm:ss"));
          console.log('now():      ' + moment().format("YYYY-MM-DD hh:mm:ss"));
            
          // in the future
          // console.log('moment(exp).unix', moment.unix(get(verifiedJwt, 'exp')));
          if(moment.unix(get(verifiedJwt, 'exp')) < moment()){
            console.log('exp should be in the future.  this one is in the past.')
            Object.assign(responsePayload, { code: 400, data: {"error": "unapproved_software_statement", "description": "exp should be in the future.  this one is in the past."}})
            // JsonRoutes.sendResult(res, { code: 201, data: Object.assign(responsePayload, {"error": "unapproved_software_statement"})});               
            //responseSent = true;
          }
          // but not more than 5 minutes
          // console.log('moment(exp).unix', moment.unix(get(verifiedJwt, 'exp')));
          if(moment.unix(get(verifiedJwt, 'exp')) < moment.unix(get(verifiedJwt, 'iat')).add(5, 'min')){
            let errmsg1 = 'exp should be in the future (but not more than 5 minutes).  This exp is set to: ' + moment.unix(get(verifiedJwt, 'exp')).format("YYYY-MM-DD hh:mm:ss");
            console.log(errmsg1)
            Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": errmsg1}})
            // JsonRoutes.sendResult(res, { code: 201, data: Object.assign(responsePayload, {"error": "unapproved_software_statement"})});               
            //responseSent = true;
          }
          // iat is in the past
          // UDAPTestTool - IIA4a5
          // console.log('moment(iat).unix', moment.unix(get(verifiedJwt, 'iat')));
          if(moment.unix(get(verifiedJwt, 'iat')) > moment()){
            console.log('iat should be in the past.  this iat is in the future.')
            Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": 'iat should be in the past.  this iat is in the future.'}})
            // JsonRoutes.sendResult(res, { code: 201, data: Object.assign(responsePayload, {"error": "unapproved_software_statement"})});               
            //responseSent = true;
          }
          
          // iis is in the past
          if(get(verifiedJwt, 'iis') === get(verifiedJwt, 'client_uri')){
            console.log('iis should be the same as client_uri (?)')
            Object.assign(responsePayload, { code: 400, data: {"error": "unapproved_software_statement", "description": "iis should be the same as client_uri (?)"}})
            // JsonRoutes.sendResult(res, { code: 201, data: Object.assign(responsePayload, {"error": "unapproved_software_statement"})});               
            //responseSent = true;
          }
        }
          var issuerCert = caStore.getIssuer(softwareStatementCert);
          console.log('issuerCert', issuerCert);

          console.log('softwareStatementCert.subject:  ', parseCertAttributes(softwareStatementCert.subject))
          console.log('softwareStatementCert.issuer:   ', parseCertAttributes(softwareStatementCert.issuer))

          console.log('emrDirectCert.subject:  ', parseCertAttributes(emrDirectCert.subject))
          console.log('emrDirectCert.issuer:   ', parseCertAttributes(emrDirectCert.issuer))
    

          try {
            // verifies a certificate chain against a CA store
            forge.pki.verifyCertificateChain(caStore, [softwareStatementCert, emrDirectCert], function(error, result){
              if(error){
                console.log('verifyCertificateChain().error', error)
                Object.assign(responsePayload, { code: 400, data: {"error": "unapproved_software_statement", "description": error}})
                // JsonRoutes.sendResult(res, Object.assign(responsePayload, { code: 400, data: {"error": "unapproved_software_statement", "description": error}})); 
              }
              if(result){
                console.log('verifyCertificateChain().result', result)
              }
              // UDAP 
              // store the incoming statement as a field in a new client record
              let oauthClientRecord = Object.assign({
                "software_statement": softwareStatement
              }, verifiedJwt);

              process.env.DEBUG && console.log('Generated oauth client record...', oauthClientRecord)
        
              let clientId = OAuthClients.insert(oauthClientRecord);
              console.log('Generated clientId: ' + clientId)
        
              Object.assign(responsePayload.data, {
                "client_id": clientId,
                "software_statement": softwareStatement,
                "created_at": new Date()
              })

              // console.log('responsePayload', responsePayload)
        
              if(get(req, 'body.scope')){
                responsePayload.scope = encodeURIComponent(get(req, 'body.scope'));
              }
        
              responsePayload.client_uri = get(verifiedJwt, 'client_uri', Meteor.absoluteUrl());
        
              let redirectUriArray = [Meteor.absoluteUrl()];
        
              if(get(verifiedJwt, 'redirect_uris')){
                if(Array.isArray(get(verifiedJwt, 'redirect_uris'))){
                  redirectUriArray = get(verifiedJwt, 'redirect_uris');
                } else {
                  redirectUriArray.push(get(verifiedJwt, 'redirect_uris'));
                }
              } 
              responsePayload.redirect_uris = redirectUriArray;      
        
              process.env.DEBUG && console.log('responsePayload', responsePayload)

              // responsePayload.client_name = get(verifiedJwt, 'client_name', '');
              // responsePayload.grant_types = get(verifiedJwt, 'grant_types', '');
              // responsePayload.response_types = get(verifiedJwt, 'response_types', '');
              // responsePayload.token_endpoint_auth_method = get(verifiedJwt, 'token_endpoint_auth_method', '');

              // responsePayload.contacts = get(verifiedJwt, 'contacts', '');
              // responsePayload.tos_uri = get(verifiedJwt, 'tos_uri', '');
              // responsePayload.policy_uri = get(verifiedJwt, 'policy_uri', '');
              // responsePayload.logo_uri = get(verifiedJwt, 'logo_uri', '');
        
              
              process.env.TRACE && console.log('response payload', responsePayload);
              
              
              // JsonRoutes.sendResult(res, responsePayload);   
            });         
            
          } catch (error) {
            console.log('error', error)
          } finally {
            JsonRoutes.sendResult(res, responsePayload);   
          }
      });      
    } else {
      JsonRoutes.sendResult(res, {
        code: 409,
        data: {
          "error": "wasnt_able_to_decode"
        }
      }); 
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
