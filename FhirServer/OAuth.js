
import http from 'http';

import { get, has, split, map, indexOf, uniq, pullAllBy, cloneDeep, toLower } from 'lodash';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { HTTP } from 'meteor/http';

import moment from 'moment';
import atob from 'atob';
import btoa from 'btoa';

import axios from 'axios';
import superagent from 'superagent';


import asn1js from 'asn1js';
import pkijs from 'pkijs';
import pvutils from 'pvutils';

import fs from 'fs';

import InboundChannel from '../lib/InboundRequests.schema.js';

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
const fetchCertificate = (url, certificateArray, callback) => {
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
        console.log('Receiving raw .crt buffer (binary DER format) from server: ')
        console.log('')
        console.log(bodyBuffer)
        console.log('')

        let shortcutAsn1;
        let revokationList = [];
        
        try {
          shortcutAsn1 = forge.asn1.fromDer(bodyBuffer.toString('binary'));
          process.env.TRACE && console.log('shortcutAsn1', shortcutAsn1)
        } catch (error) {
          console.log('shortcutCert.error', error);                  
        }   

        let intermediateCert;
        try {
          intermediateCert = forge.pki.certificateFromAsn1(shortcutAsn1);
          process.env.TRACE && console.log('intermediateCert', intermediateCert)

          console.log('intermediateCert.subject:  ', parseCertAttributes(intermediateCert.subject))
          console.log('intermediateCert.issuer:   ', parseCertAttributes(intermediateCert.issuer))
          console.log('')

          if(intermediateCert){
            console.log('Adding intermediate cert to caStore and certificateArray.')
            certificateArray.push(intermediateCert);
            caStore.addCertificate(intermediateCert);  
          }
        } catch (error) {
          console.log('intermediateCert.error', error);                  
        }  
        
        try {
          if(get(intermediateCert, 'extensions') && Array.isArray(intermediateCert.extensions)){
            intermediateCert.extensions.forEach(async function(extension){

              if(get(extension, 'name') === "authorityInfoAccess"){
                console.log('Found authority info for the issuer of the certificate.')
                // console.log('extension.value: ', extension.value.toString());

                let httpIndex = extension.value.toString().indexOf('http');
                // console.log('httpIndex: ', httpIndex);
                
                let recursiveLookupUrl = extension.value.toString().substring(httpIndex);
                console.log('Recursive lookup url: ', recursiveLookupUrl);

                let recursiveCerts = await fetchCertificate(recursiveLookupUrl, certificateArray);
                process.env.TRACE && console.log('recursiveCerts', recursiveCerts)
                

                if(Array.isArray(recursiveCerts)){
                  console.log('recursiveCerts.length', recursiveCerts.length)
                  // console.log('recursiveCerts', recursiveCerts)
                  recursiveCerts.forEach(function(cert){
                    // console.log('recursiveCerts.subject:  ', parseCertAttributes(cert.subject))
                    // console.log('recursiveCerts.issuer:   ', parseCertAttributes(cert.issuer))  
                    certificateArray.push(cert)
                  })
                } else {
                  console.log('recursiveCerts is not an array');
                  certificateArray.push(recursiveCerts);

                  console.log('recursiveCerts.subject:  ', parseCertAttributes(recursiveCerts.subject))
                  console.log('recursiveCerts.issuer:   ', parseCertAttributes(recursiveCerts.issuer))
            
                  caStore.addCertificate(recursiveCerts);  
                }  

                if(typeof callback === "function"){
                  callback(null, uniq(certificateArray))
                }
                return resolve(uniq(certificateArray));
              }
              if(get(extension, 'name') === "cRLDistributionPoints"){
                console.log('Found URL with revokation info from the issuer.')
    
                let httpRevocationIndex = extension.value.toString().indexOf('http');
                // console.log('httpRevocationIndex: ', httpRevocationIndex);
    
                let intermediateCertRevokationUrl = extension.value.toString().substring(httpRevocationIndex);
                console.log('Intermediate cert revokation url: ', intermediateCertRevokationUrl);
                console.log('Fetching...')
                console.log('')
    
                revokationList = await fetchRevokationList(intermediateCertRevokationUrl, function(error, result){
                  if(error) console.log('fetchRevokationList.error', error)
                  if(result) console.log('fetchRevokationList.result', result)
                })
    
                process.env.DEBUG && console.log('')
                process.env.DEBUG && console.log("-----Revoked Certificate Serial Numbers-----")
                process.env.DEBUG && console.log('')
                process.env.DEBUG && console.log('revokationList', revokationList)
                process.env.DEBUG && console.log('')
              }
            })
          }

          process.env.TRACE && console.log('intermediateCert', intermediateCert);

        } catch (error) {
          console.log('recursive lookup error', error);                  
        }  

        // console.log("=================================================================================================")        
        return resolve(certificateArray)
      });
    }).on('error', reject);
  });
}
function fetchRevokationList(revokationUrl){
  return new Promise((resolve, reject) => {
    http.get(revokationUrl, res => {
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
        console.log('Receiving raw .crl data from revokation endpoint: ')
        console.log('')
        console.log(bodyBuffer)
        console.log('')
  
        let revokationAsn1;
        let revokationBuffer;
        let revokationAsn1crl;
        let revokationCrl;
        let revokedSerialNumbers = [];

        try {
          revokationAsn1 = forge.asn1.fromDer(bodyBuffer.toString('binary'));
          process.env.TRACE && console.log('revokationAsn1', revokationAsn1)
        } catch (error) {
          console.log('shortcutCert.error', error);                  
        }   

        try {
          revokationBuffer = new Uint8Array(bodyBuffer).buffer;
          process.env.TRACE && console.log('revokationBuffer', revokationBuffer)
        } catch (error) {
          console.log('revokationBuffer.error', error);                  
        }  

        try {
          revokationAsn1crl = asn1js.fromBER(revokationBuffer);
          process.env.TRACE && console.log('revokationAsn1crl', revokationAsn1crl)
        } catch (error) {
          console.log('revokationAsn1crl.error', error);                  
        }  

        try {
          revokationCrl = new pkijs.CertificateRevocationList({
            schema: revokationAsn1crl.result
          })
          process.env.TRACE && console.log('revokationCrl', revokationCrl)
        } catch (error) {
          console.log('revokationCrl.error', error);                  
        }  
        try {
          if(get(revokationCrl, 'revokedCertificates')){
            for (const { userCertificate } of revokationCrl.revokedCertificates) {
              process.env.TRACE && console.log(pvutils.bufferToHexCodes(userCertificate.valueBlock.valueHex))
              revokedSerialNumbers.push(toLower(pvutils.bufferToHexCodes(userCertificate.valueBlock.valueHex)))
            }
            console.log('')  
          }
        } catch (error) {
          console.log('pvutils.bufferToHexCodes.error', error);                  
        }  


        // console.log("=================================================================================================")        
        return resolve(revokedSerialNumbers)
      });
    }).on('error', reject);
  });
}
function certificateIsExpired(validity){
  let isExpired = false;

  if(moment() > moment(get(validity, 'notAfter'))){
    console.log('Certificate is expired.                      ' + moment().toDate() + ' is greater than ' + moment(get(validity, 'notAfter')).toDate())
    isExpired = true;
  } 
  if(moment() < moment(get(validity, 'notBefore'))){
    console.log('Certificate is expired.                      ' + moment().toDate() + ' is less than ' + moment(get(validity, 'notBefore')).toDate())
    isExpired = true;
  } 

  return isExpired;
}
function certificateIsRevoked(serialNumber, revokationList){
  let isRevoked = false;

  if(revokationList.includes(serialNumber)){
    isRevoked = true;
  }
  
  return isRevoked;
}
function preParse(request){
  if(get(Meteor, 'settings.private.fhir.inboundQueue') === true){
    process.env.EXHAUSTIVE && console.log('Inbound request', request)
    if(InboundChannel){
      InboundChannel.InboundRequests.insert({
        date: new Date(),
        method: get(request, 'method'),
        url: get(request, 'url'),
        body: get(request, 'body'),
        query: get(request, 'query'),
        headers: get(request, 'headers')
      });
    }
  }
  return request;
}
function fuzzyMatch(redirect_uris, redirectUri){
  let fuzzyMatch = false;
  let redirectHostname = new URL(redirectUri);
  process.env.DEBUG && console.log('redirectHostname', redirectHostname.hostname);

  if(Array.isArray(redirect_uris)){
    redirect_uris.forEach(function(redirect_uri){
      let uriHostname = new URL(redirect_uri)
      process.env.DEBUG && console.log('uriHostname', uriHostname.hostname)
      if(uriHostname.hostname === redirectHostname.hostname){
        fuzzyMatch = true;
      }
    })
  }
  return fuzzyMatch;
}
function setRedirectHeader(res, responseType, redirectUri, appState, newAuthorizationCode){
  if(!responseType){
    res.setHeader("Location", redirectUri + "?response_type=unspecified&error=invalid_request&state=" + appState);
  } else if(responseType !== "code"){
    res.setHeader("Location", redirectUri + "?response_type=wrong_type&error=invalid_request&state=" + appState);
  } else {
    res.setHeader("Location", redirectUri + "?state=" + appState + "&code=" + newAuthorizationCode);
  }  
}

Meteor.startup(function() {
  console.log('========================================================================');
  console.log('Generating SMART on FHIR / OAuth routes...');

  JsonRoutes.add("get", "/oauth/registration", function (req, res, next) {
    console.log('========================================================================');
    console.log('GET ' + '/oauth/registration');

    preParse(req);

    res.setHeader('Content-type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");

    JsonRoutes.sendResult(res, {
      code: 200,
      data: {
        "message": "This is not the /registration route you are looking for.  You have specified a GET operation.  To register a client, please send a POST operation to /oauth/registration.",
        "sample_payload": {
          "client_id": "12345",
          "client_name": "ACME App",
          "scope": "profile fhirUser */Patient",
          "redirect_uris": ["https://acme.org/redirect"]
        }
      }
    });  
  });

  JsonRoutes.add("post", "/oauth/registration", function (req, res, next) {
    console.log('========================================================================');
    console.log('========================================================================');
    console.log('POST ' + '/oauth/registration');

    preParse(req);

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

    console.log('')
    console.log('========================================================================');
    console.log('Decoding the payload and checking headers...');
    console.log('')
    if(decoded) {
      process.env.DEBUG && console.log('decoded.payload', decoded.payload);
      process.env.DEBUG && console.log('decoded.header', decoded.header);
    
      // UDAPTestTool IIA3a2	- No x5c header  
      if(!get(decoded, 'header')){
        console.log('header not present... (IIA3a2)')
        // Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "header not present..."}});
        JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement", "description": "", "udap_testscript_step": "IIA3a2"}}); 
        // responseSent = true;
      } else {
        if(!get(decoded, 'header.x5c')){
          console.log('header.x5c not present...')
          // Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "header.x5c not present..."}});
          JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement", "description": "header.x5c not present...", "udap_testscript_step": "IIA3a2"}}); 
          // responseSent = true;
        } else {
          if(!Array.isArray(get(decoded, 'header.x5c'))){
            console.log('header.x5c is not an array...')
            // Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "header.x5c is not an array..."}});
            JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement", "description": "header.x5c is not an array...", "udap_testscript_step": "IIA3a2"}}); 
            // responseSent = true;
          } else {
            if(Array.isArray(get(decoded, 'header.x5c')) && (decoded.header.x5c.length === 0)){
              console.log('header.x5c is an empty array...')
              // Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "header.x5c is an empty array..."}});
              JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement", "description": "header.x5c is an empty array...", "udap_testscript_step": "IIA3a2"}}); 
              // responseSent = true;
            }
          }
        }  
      }

      console.log('')
      console.log('========================================================================');
      console.log('Assembling PEM certificate from binary DER buffer...');
      console.log('')

      console.log('decoded.header.x5c[0]', decoded.header.x5c[0]);
      console.log('')
      
      let softwareStatementPem = "-----BEGIN CERTIFICATE-----\r\n";
      softwareStatementPem += formatPEM(decoded.header.x5c[0]);
      softwareStatementPem = `${softwareStatementPem}\r\n-----END CERTIFICATE-----\r\n`;
  
      console.log('softwareStatementPem', softwareStatementPem)


      // var emrDirectCert = forge.pki.certificateFromPem(emrDirectPem);
      // // console.log('emrDirectCert', emrDirectCert);
      // console.log('emrDirectCert.subject:  ', parseCertAttributes(emrDirectCert.subject));
      // console.log('emrDirectCert.issuer:  ', parseCertAttributes(emrDirectCert.issuer));
      // // console.log('emrDirectCert.publicKey', emrDirectCert.publicKey);
      // // console.log('emrDirect certificate: ' + parseCertAttributes(emrDirectCert))

      console.log('========================================================================');
      console.log('RECEIVED A SOFTWARE STATEMENT WITH CERTIFICATE')
      console.log('')


      let certificatesArray = [];
      let revokationList = [];

      var softwareStatementCert = forge.pki.certificateFromPem(softwareStatementPem);
      console.log('softwareStatementCert.serialNumber:    ', softwareStatementCert.serialNumber)
      console.log('softwareStatementCert.subject:       ', parseCertAttributes(softwareStatementCert.subject))
      console.log('softwareStatementCert.issuer:        ', parseCertAttributes(softwareStatementCert.issuer))
      console.log('')
      
      console.log("Adding inbound software statement cert to certificate authority store...")
      caStore.addCertificate(softwareStatementCert);

      console.log("------------------------------------------------------")
      console.log("Parsing extensions for URL of the issuing authority...")
      if(get(softwareStatementCert, 'extensions') && Array.isArray(softwareStatementCert.extensions)){
        softwareStatementCert.extensions.forEach(async function(extension){
          process.env.DEBUG && console.log('');
          process.env.DEBUG && console.log('extension.name:             ', get(extension, 'name'));
          process.env.DEBUG && console.log('extension.value:            ', get(extension, 'value'));
          process.env.TRACE && console.log('decodeURI(extension.value): ', decodeURI(get(extension, 'value')));
          process.env.DEBUG && console.log('');

          if(get(extension, 'name') === "authorityInfoAccess"){
            console.log('Found authority info for the issuer of the software statement certificate.')
            // console.log('extension.value: ', extension.value.toString());

            let httpIndex = extension.value.toString().indexOf('http');
            // console.log('httpIndex: ', httpIndex);
            
            let intermediateCertLookupUrl = extension.value.toString().substring(httpIndex);
            console.log('Intermediate cert lookup url: ', intermediateCertLookupUrl);
            console.log('Fetching...')
            console.log('')


          
            await fetchCertificate(intermediateCertLookupUrl, certificatesArray, function(error, intermediateCerts){
              console.log('');
              console.log('intermediateCerts.length', intermediateCerts.length);
              console.log('');

              intermediateCerts.forEach(function(cert, index){
                console.log('intermediateCerts' + index + '.subject:  ', parseCertAttributes(cert.subject))
                console.log('intermediateCerts' + index + '.issuer:   ', parseCertAttributes(cert.issuer))                    
                console.log('')

                // cert.extensions.forEach(async function(extension){                  
                //   if(get(extension, 'name') === "cRLDistributionPoints"){
                //     console.log('Found URL with revokation info from the issuer.')
        
                //     let httpRevocationIndex = extension.value.toString().indexOf('http');
                //     // console.log('httpRevocationIndex: ', httpRevocationIndex);
        
                //     let intermediateCertRevokationUrl = extension.value.toString().substring(httpRevocationIndex);
                //     console.log('Intermediate cert revokation url: ', intermediateCertRevokationUrl);
                //     console.log('Fetching...')
                //     console.log('')
        
                //     revokationList = await fetchRevokationList(intermediateCertRevokationUrl, function(error, result){
                //       if(error) console.log('fetchRevokationList.error', error)
                //       if(result) console.log('fetchRevokationList.result', result)
                //     })
        
                //     process.env.DEBUG && console.log('')
                //     process.env.DEBUG && console.log("-----Revoked Certificate Serial Numbers-----")
                //     process.env.DEBUG && console.log('')
                //     process.env.DEBUG && console.log('revokationList', revokationList)
                //     process.env.DEBUG && console.log('')
                //   }
                // })
              })

              console.log("")
              console.log("==================================================================================")
              console.log('there are ' + Object.keys(caStore.certs).length + " certificates in the caStore");
              console.log("")
              Object.keys(caStore.certs).forEach(function(key){
                console.log('caStore.certs.id:  ' + key);
                console.log('caStore.subject:    ' + parseCertAttributes(caStore.certs[key].subject))
                console.log('caStore.issuer:    ' + parseCertAttributes(caStore.certs[key].issuer))
                console.log('');
              })

              console.log("")
              console.log("==================================================================================")
              console.log("We can now continue verifying the certificates and certificate chain...")
              console.log("")
              // everything after this needs to go into the callback, because it might take a few minutes to look up all the certs
              console.log('Current time:                         ' + moment().format("YYYY-MM-DD hh:mm:ss"));
              console.log('softwareStatementCert is valid until: ', get(softwareStatementCert, 'validity.notAfter'));

              // check for expired certificate
              if(moment.unix(get(softwareStatementCert, 'validity.notAfter')) < moment()){
                console.log('certificate is expired')
                Object.assign(responsePayload, { code: 400, data: {"error": "unapproved_software_statement", "description": "exp should be in the future.  this one is in the past."}})
              } 
          
              console.log('verifying the JWT token...')
          
              jwt.verify(softwareStatement, softwareStatementPem, { algorithms: ['RS256'] },function(error, verifiedJwt){
                let token = decoded;
                if(token && process.env.DEBUG){                  
                  Object.assign(responsePayload, { data: {
                    "software_statement_decoded": token
                  }});
                }

                
                if(verifiedJwt){
                  console.log("jwt verified!")
                  token = verifiedJwt;                  
                  Object.assign(responsePayload.data, verifiedJwt)
                  responsePayload.data.verified = true;
                  console.log("")
                  console.log('verifiedJwt', verifiedJwt)
                  console.log("")

                  // if(decoded.payload){
                  if(!get(verifiedJwt, 'iss')){
                    console.log('decoded payload did not contain an iss')
                    Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "decoded payload did not contain an iss", "udap_testscript_step": "IIA4a1"}});
                    // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}}); 
                    // responseSent = true;
                  }
                  if(!get(verifiedJwt, 'sub')){
                    console.log('decoded payload did not contain an sub')
                    Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "decoded payload did not contain an sub"}});
                    // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}}); 
                    // responseSent = true;
                  }
                  if(!get(verifiedJwt, 'aud')){
                    console.log('decoded payload did not contain an aud')
                    Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "decoded payload did not contain an aud"}});
                    // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}}); 
                    // responseSent = true;
                  }

                  // exp/iat tests
                  if(!get(verifiedJwt, 'exp')){
                    console.log('decoded payload did not contain an exp')
                    Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "decoded payload did not contain an exp", "udap_testscript_step": "IIA4a4"}});
                  } else {
                    console.log('exp.unix(): ' + moment.unix(get(verifiedJwt, 'exp')).format("YYYY-MM-DD hh:mm:ss"));
                    console.log('iat.unix(): ' + moment.unix(get(verifiedJwt, 'iat')).format("YYYY-MM-DD hh:mm:ss"));
                    console.log('now():      ' + moment().format("YYYY-MM-DD hh:mm:ss"));
                      
                    // in the future
                    // console.log('moment(exp).unix', moment.unix(get(token, 'exp')));
                    if(moment.unix(get(verifiedJwt, 'exp')) < moment()){
                      console.log('exp should be in the future.  this one is in the past.')
                      Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "exp should be in the future.  this one is in the past.", "udap_testscript_step": "IIA4a4"}})
                      // JsonRoutes.sendResult(res, { code: 201, data: Object.assign(responsePayload, {"error": "unapproved_software_statement"})});               
                      //responseSent = true;
                    }
                    if(!get(verifiedJwt, 'iat')){
                      console.log('decoded payload did not contain an iat')
                      Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "decoded payload did not contain an iat"}});
                      // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}}); 
                      // responseSent = true;
                    } else {
                      // but not more than 5 minutes
                      // console.log('moment(exp).unix', moment.unix(get(token, 'exp')));
                      if(moment.unix(get(token, 'exp')) < moment.unix(get(verifiedJwt, 'iat')).add(5, 'min')){
                        let errmsg1 = 'exp should be in the future (but not more than 5 minutes).  This exp is set to: ' + moment.unix(get(verifiedJwt, 'exp')).format("YYYY-MM-DD hh:mm:ss");
                        console.log(errmsg1)
                        Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": errmsg1, "udap_testscript_step": "IIA4a4"}})
                        // JsonRoutes.sendResult(res, { code: 201, data: Object.assign(responsePayload, {"error": "unapproved_software_statement"})});               
                        //responseSent = true;
                      }
                      // iat is in the past
                      // UDAPTestTool - IIA4a5
                      // console.log('moment(iat).unix', moment.unix(get(verifiedJwt, 'iat')));
                      if(moment.unix(get(verifiedJwt, 'iat')) > moment()){
                        console.log('iat should be in the past.  this iat is in the future.')
                        Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": 'iat should be in the past.  this iat is in the future.', "udap_testscript_step": "IIA4a5"}})
                        // JsonRoutes.sendResult(res, { code: 201, data: Object.assign(responsePayload, {"error": "unapproved_software_statement"})});               
                        //responseSent = true;
                      }
                    }  
                  }
                  if(get(verifiedJwt, 'iss') !== get(verifiedJwt, 'sub')){
                    console.log('decoded payload iss did not equal sub')
                    Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "decoded payload iss did not equal sub", "udap_testscript_step": "IIA4a2"}});
                    // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}}); 
                    // responseSent = true;
                  }

                  // RE-ENABLE
                  // UDAPTestTool IIA4a3	- aud equals registration endpoint
                  if(!process.env.ALLOW_LOCAL_UDAP_TESTING){
                    console.log('registration endpoint: ' + removeTrailingSlash(Meteor.absoluteUrl()) + '/oauth/registration')
                    if(!(get(verifiedJwt, 'aud') === removeTrailingSlash(Meteor.absoluteUrl()) + '/oauth/registration')){
                      console.log('decoded payload aud was not set to the current route (UDAPTestTool IIA4a3)')
                      Object.assign(responsePayload, { code: 400, data: {"error": "invalid_software_statement", "description": "decoded payload aud was not set to the current route (UDAPTestTool IIA4a3)"}});
                      // JsonRoutes.sendResult(res, { code: 400, data: {"error": "invalid_software_statement"}});           
                      responseSent = true;
                    }  
                  }

                  console.log('exp: ' + moment.unix(get(verifiedJwt, 'exp')).format("YYYY-MM-DD hh:mm:ss"))
                  console.log('iat: ' + moment.unix(get(verifiedJwt, 'iat')).format("YYYY-MM-DD hh:mm:ss"))
                  console.log('now: ' + moment().format("YYYY-MM-DD hh:mm:ss"))
                //}


                  if(!get(verifiedJwt, 'client_name')){
                    console.log('verified JWT did not have a client_name')
                    Object.assign(responsePayload, { code: 400, data: {"error": "invalid_client_metadata", "description": "verified JWT did not have a client_name"}});
                  }
                  if(!get(verifiedJwt, 'redirect_uris')){
                    console.log('verified JWT did not have a redirect_uris')
                    // if(!process.env.RELAX_UDAP_REGISTRATION){
                      Object.assign(responsePayload, { code: 400, data: {"error": "invalid_client_metadata", "description": "verified JWT did not have a redirect_uris"}});
                    //}
                  }
                  if(!get(verifiedJwt, 'grant_types')){
                    console.log('verified JWT did not have a grant_types')
                    Object.assign(responsePayload, { code: 400, data: {"error": "invalid_client_metadata", "description": "verified JWT did not have a grant_types"}});
                  }
                  if(!get(verifiedJwt, 'response_types')){
                    console.log('verified JWT did not have a response_types')
                    // if(!process.env.RELAX_UDAP_REGISTRATION){
                      Object.assign(responsePayload, { code: 400, data: {"error": "invalid_client_metadata", "description": "verified JWT did not have a response_types"}});
                    //}
                  }
                  if(!get(verifiedJwt, 'token_endpoint_auth_method')){
                    console.log('verified JWT did not have a token_endpoint_auth_method')
                    Object.assign(responsePayload, { code: 400, data: {"error": "invalid_client_metadata", "description": "verified JWT did not have a token_endpoint_auth_method", "udap_testscript_step":"IIA3a3"}});
                  }
                  
                  
                }
                if(error){
                  console.log("")
                  console.log('jwt.verify().error', error)
           
                  if(process.env.ALLOW_LOCAL_UDAP_TESTING){
                    Object.assign(responsePayload, { data: {"description: ": "WARNING:  the following error was suppressed to allow for local testing: " + error}});
                    console.log('jwt.verify().error: ' + error)  
                  } else {
                    Object.assign(responsePayload, { code: 409, data: {"error": "invalid_software_statement", "description": error}});
                    console.log('jwt.verify().error: ' + error)  
                  }
                  responsePayload.data.verified = false;
                  
                }

                
                
                // SPEC?  Can't find this in the test runner....
                // // iis equals client uri
                // if(process.env.ALLOW_LOCAL_UDAP_TESTING){
                //   if(get(token, 'iis') !== get(token, 'client_uri')){
                //     console.log('WARNING:  suppressing error (iis should be the same as client_uri) because testing locally')
                //     Object.assign(responsePayload, { data: {"description": "WARNING:  suppressing error (iis should be the same as client_uri) because testing locally"}})
                //   }
                // } else {
                //   if(get(token, 'iis') !== get(token, 'client_uri')){
                //     console.log('iis should be the same as client_uri (?)')
                //     Object.assign(responsePayload, { code: 400, data: {"error": "unapproved_software_statement", "description": "iis should be the same as client_uri (?)"}})
                //   }
                // }


                // var issuerCert = caStore.getIssuer(softwareStatementCert);
                // console.log('issuerCert', issuerCert);

                console.log("")
                console.log("============================================================================")
                console.log('Now trying to verify the certificate chain....')
                console.log("")

                console.log("-----Software Statement-----")
                console.log('softwareStatementCert.subject:    ', parseCertAttributes(softwareStatementCert.subject))
                console.log('softwareStatementCert.issuer:     ', parseCertAttributes(softwareStatementCert.issuer))
                console.log("")

                console.log("-----Intermediary Certs-----")
                if(Array.isArray(intermediateCerts)){
                  intermediateCerts.forEach(function(certInChain){
                    console.log('intermediaryCert.serialNumber ', certInChain.serialNumber);
                    console.log('intermediaryCert.subject:     ' + parseCertAttributes(certInChain.subject))
                    console.log('intermediaryCert.issuer:      ' + parseCertAttributes(certInChain.issuer))
                    console.log('');
                  })
                  console.log("")
                }
                console.log("-----Certificate Authority Store-----")
                console.log('')
                Object.keys(caStore.certs).forEach(function(key){
                  console.log('caStore.certs.id:              ' + key);
                  console.log('caStore.certs.serialNumber:    ' + caStore.certs[key].serialNumber)
                  console.log('caStore.certs.subject:         ' + parseCertAttributes(caStore.certs[key].subject))
                  console.log('caStore.certs.issuer:          ' + parseCertAttributes(caStore.certs[key].issuer))
                })


                console.log('')
                console.log("=================================================================================================")
                console.log("-----Verifying Certificate Chain-----")
                console.log('')
                let certificateChain = [softwareStatementCert];
                let pemChain = [forge.pki.certificateToPem(softwareStatementCert)];

                let previousCert = softwareStatementCert;
                let hasFoundCertificateAuthority = false;
                let certOrder = [{
                  subject: parseCertAttributes(softwareStatementCert.subject),
                  issuer: parseCertAttributes(softwareStatementCert.issuer)
                }];

                console.log('softwareStatementCert.serialNumber:         ', softwareStatementCert.serialNumber);
                console.log('softwareStatementCert.subject:            ', parseCertAttributes(softwareStatementCert.subject));
                console.log('softwareStatementCert.issuer:             ', parseCertAttributes(softwareStatementCert.issuer));
                console.log('softwareStatementCert.validity.notBefore:    ' + moment(get(softwareStatementCert, 'validity.notBefore')));
                console.log('softwareStatementCert.validity.notAfter:     ' + moment(get(softwareStatementCert, 'validity.notAfter')));
                console.log('softwareStatementCert.moment:                ' + moment());
                console.log('softwareStatementCert.validity.notBefore:    ' + get(softwareStatementCert, 'validity.notBefore'));
                console.log('softwareStatementCert.validity.notAfter:     ' + get(softwareStatementCert, 'validity.notAfter'));
                console.log('softwareStatementCert.now:                   ' + moment().toDate());
                console.log('softwareStatementCert.isRevoked:             ' + certificateIsRevoked(get(softwareStatementCert, 'serialNumber'), revokationList));
                console.log('softwareStatementCert.isExpired:             ' + certificateIsExpired(get(softwareStatementCert, 'validity')));

                if(certificateIsRevoked(get(softwareStatementCert, 'serialNumber'), revokationList)){
                  Object.assign(responsePayload, { code: 400, data: {"error": "unapproved_software_statement", "description": "expired client certificate", "udap_testscript_step": "IIA3b1a"}});
                }
                if(certificateIsExpired(get(softwareStatementCert, 'validity'))){
                  Object.assign(responsePayload, { code: 400, data: {"error": "unapproved_software_statement", "description": "revoked client certificate", "udap_testscript_step": "IIA3b1b"}});
                }

                // while we haven't found the root certificate authority
                while (!hasFoundCertificateAuthority) {
                  // we'll just keep iterating through the intermediary certs
                  intermediateCerts.forEach(function(intermediary, index){
                    console.log("")

                    //  

                    // looking for one whose subject matches the previous cert's issuer
                    if(parseCertAttributes(intermediary.subject) === parseCertAttributes(previousCert.issuer)){
                      // if we find a match
                      console.log('Found the certificate for the issuing authority.  (Index ' + index + ")")
                      console.log('');
                      console.log('intermediary.serialNumber:         ' + intermediary.serialNumber);
                      console.log('intermediary.subject:            ' + parseCertAttributes(intermediary.subject))
                      console.log('intermediary.issuer:             ' + parseCertAttributes(intermediary.issuer))
                      
                      // then verify the issuer 
                      let isVerified = intermediary.verify(previousCert);
                      console.log('intermediary.isVerified:           ' + isVerified)
                      if(isVerified){

                        // add the intermediary to the chain
                        certificateChain.push(cloneDeep(intermediary));

                        pemChain.push(forge.pki.certificateToPem(intermediary))

                        // and a summary to the certOrder object
                        certOrder.push({
                          subject: parseCertAttributes(intermediary.subject),
                          issuer: parseCertAttributes(intermediary.issuer)
                        })

                        // set it to the previous cert
                        previousCert = cloneDeep(intermediary);

                        // check to see if it self-authorized and/or is a Certificate Authority
                        if(parseCertAttributes(intermediary.subject) === parseCertAttributes(intermediary.issuer)){
                          hasFoundCertificateAuthority = true;
                          console.log('Found the Certificate Authority!')
                        }                        

                        // and then remove it from the array of intermediary certs
                        intermediateCerts = pullAllBy(intermediateCerts, intermediary, 'serialNumber');  
                      } else {
                        Object.assign(responsePayload, { code: 400, data: {"error": "unapproved_software_statement", "description": "verified JWT did not have a redirect_uris", "udap_testscript_step": "IIA3b1"}});
                      }
                    } else {
                      console.log('COULD NOT FIND MATCHING CERTIFICATE')
                      Object.assign(responsePayload, { code: 400, data: {"error": "unapproved_software_statement", "description": "could not find matching issuer certificate", "udap_testscript_step": "IIA3b1"}});
                    }

                    process.env.TRACE && console.log('intermediary.validity', get(intermediary, 'validity'));
                    process.env.DEBUG && console.log('intermediary.validity.notBefore:   ' + get(intermediary, 'validity.notBefore'));
                    process.env.DEBUG && console.log('intermediary.validity.notAfter:    ' + get(intermediary, 'validity.notAfter'));
                  
                    process.env.DEBUG && console.log('intermediary.unix.now:             ' + moment());
                    process.env.DEBUG && console.log('intermediary.unix.notBefore:       ' + moment(get(intermediary, 'validity.notBefore')));
                    process.env.DEBUG && console.log('intermediary.unix.notAfter:        ' + moment(get(intermediary, 'validity.notAfter')));
                  
                    if(certificateIsExpired(get(intermediary, 'validity'))){
                      console.log('intermediary.isExpired:            ' +  true)
                      Object.assign(responsePayload, { code: 400, data: {"error": "unapproved_software_statement", "description": "expired client certificate", "udap_testscript_step": "IIA3b1a"}});
                    } else {
                      console.log('intermediary.isExpired:            ' +  false)
                    }

                    if(certificateIsRevoked(get(intermediary, 'serialNumber'), revokationList)){
                      console.log('intermediary.isRevoked:            ' + true)
                      Object.assign(responsePayload, { code: 400, data: {"error": "unapproved_software_statement", "description": "could not find matching issuer certificate", "udap_testscript_step": "IIA3b1b"}});
                    } else {
                      console.log('intermediary.isRevoked:            ' + false)
                    }

                    
                    console.log('');
                  })
                  console.log("")
                  console.log("---------------------------------------------------")
                  console.log("Response Payload")
                  console.log(responsePayload)
                  console.log("")
                }
                

                console.log("-----Certificate Order-----")
                process.env.TRACE && console.log('')
                process.env.TRACE && console.log(certificateChain)
                console.log('')
                console.log(certOrder)
                console.log('')
  
                // console.log("-----PEM Chain-----")
                // console.log('')
                // console.log(pemChain)
                // console.log('')

                let newClientRecord = {
                  "software_statement": softwareStatement,
                  "error": get(responsePayload.data, 'error', ''),
                  "verified": get(responsePayload.data, 'verified', ''),
                  "created_at": new Date()
                }

                if (typeof get(responsePayload.data, 'description', '') === "string"){
                  newClientRecord.description = get(responsePayload.data, 'description', '');
                }

                process.env.TRACE && console.log('newClientRecord', newClientRecord)

                // store the incoming statement as a field in a new client record
                let oauthClientRecord = Object.assign(newClientRecord, verifiedJwt);

                process.env.DEBUG && console.log("------------------------------------------------------------")
                process.env.DEBUG && console.log('')
                console.log('Generated oauth client record...')
                process.env.DEBUG && console.log(oauthClientRecord)
          
                let clientId = OAuthClients.insert(oauthClientRecord);
                console.log('Generated clientId: ' + clientId)
                console.log('')
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
          
                process.env.TRACE && console.log('responsePayload', responsePayload)

                // assign fields to top level
                responsePayload.data.client_name = get(verifiedJwt, 'client_name', '');
                responsePayload.data.grant_types = get(verifiedJwt, 'grant_types', '');
                responsePayload.data.response_types = get(verifiedJwt, 'response_types', '');
                responsePayload.data.token_endpoint_auth_method = get(verifiedJwt, 'token_endpoint_auth_method', '');

                responsePayload.data.contacts = get(verifiedJwt, 'contacts', '');
                responsePayload.data.tos_uri = get(verifiedJwt, 'tos_uri', '');
                responsePayload.data.policy_uri = get(verifiedJwt, 'policy_uri', '');
                responsePayload.data.logo_uri = get(verifiedJwt, 'logo_uri', '');

                responsePayload.data.exp = moment.unix(get(token, 'exp')).format("YYYY-MM-DD hh:mm:ss");
                responsePayload.data.iat = moment.unix(get(token, 'iat')).format("YYYY-MM-DD hh:mm:ss");          

                console.log('')
                process.env.DEBUG && console.log("---------------------------------------------------")
                process.env.DEBUG && console.log('Over-the-Wire Response Payload');
                process.env.DEBUG && console.log(responsePayload);
                console.log('')

                JsonRoutes.sendResult(res, responsePayload);   


                // try {
                //   // verifies a certificate chain against a CA store
                //   forge.pki.verifyCertificateChain(caStore, certificateChain, function(error, result){
                //     if(error){
                //       console.log('verifyCertificateChain().error', error)
                //       Object.assign(responsePayload, { code: 400, data: {"error": "unapproved_software_statement", "description": error}})
                //       // JsonRoutes.sendResult(res, Object.assign(responsePayload, { code: 400, data: {"error": "unapproved_software_statement", "description": error}})); 
                //     }
                //     if(result){
                //       console.log('verifyCertificateChain().result', result)
                //     }
                    
                    
                //     // JsonRoutes.sendResult(res, responsePayload);   
                //   });         
                  
                // } catch (error) {
                //   console.log('error', error)
                // } finally {
                //   JsonRoutes.sendResult(res, responsePayload);   
                // }
              });  
            });
          }
          if(get(extension, 'name') === "cRLDistributionPoints"){
            console.log('Found URL with revokation info from the issuer.')

            let httpRevocationIndex = extension.value.toString().indexOf('http');
            // console.log('httpRevocationIndex: ', httpRevocationIndex);

            let intermediateCertRevokationUrl = extension.value.toString().substring(httpRevocationIndex);
            console.log('Intermediate cert revokation url: ', intermediateCertRevokationUrl);
            console.log('Fetching...')
            console.log('')

            revokationList = await fetchRevokationList(intermediateCertRevokationUrl, function(error, result){
              if(error) console.log('fetchRevokationList.error', error)
              if(result) console.log('fetchRevokationList.result', result)
            })

            process.env.DEBUG && console.log('')
            process.env.DEBUG && console.log("-----Revoked Certificate Serial Numbers-----")
            process.env.DEBUG && console.log('')
            process.env.DEBUG && console.log('revokationList', revokationList)
            process.env.DEBUG && console.log('')
          }
        })
      }

      


          
    } else {
      console.log("wasn't able to decode JWT...");
      console.log("checking for unsigned data...");

      if(req.body){

        let newClientRecord = {
          "verified": false,
          "created_at": new Date()
        }


        process.env.TRACE && console.log('newClientRecord', newClientRecord)

        // store the incoming statement as a field in a new client record
        let oauthClientRecord = Object.assign(newClientRecord, req.body);

        process.env.DEBUG && console.log("------------------------------------------------------------")
        process.env.DEBUG && console.log('')
        console.log('Generated oauth client record...')
        process.env.DEBUG && console.log(oauthClientRecord)
  
        let clientId = OAuthClients.insert(oauthClientRecord);

        JsonRoutes.sendResult(res, {
          code: 201,
          data: {
            client_id: clientId,
            client_name: get(req.body, 'client_name'),
            scope: get(req.body, 'scope')
          }
        });   

      } else {
        JsonRoutes.sendResult(res, {
          code: 204,
          data: {
            "error": "wasnt_able_to_decode_jwt"
          }
        });   
      }

    } 
  });
  
  JsonRoutes.add("get", "/oauth/authorize", function (req, res, next) {
    console.log('========================================================================');
    console.log('GET ' + '/oauth/authorize');

    preParse(req);

    res.setHeader('Content-type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");

    console.log("")
    console.log("Query")
    console.log(req.query)
    console.log("")
    console.log("Body")
    console.log(req.body)
    console.log("")

    let redirectUri = "";
    if(get(req, 'query.redirect_uri')){
      redirectUri = get(req, 'query.redirect_uri');
    } else if(get(req, 'body.redirect_uri')){
      redirectUri = get(req, 'body.redirect_uri');
    }

    let clientId = "";
    if(get(req, 'query.client_id')){
      clientId = get(req, 'query.client_id');
    } else if(get(req, 'body.client_id')){
      clientId = get(req, 'body.client_id');
    }

    let appState = "";
    if(get(req, 'query.state')){
      appState = get(req, 'query.state');
    } else if(get(req, 'body.state')){
      appState = get(req, 'body.state');
    }

    let responseType = "";
    if(get(req, 'query.response_type')){
      responseType = get(req, 'query.response_type');
    } else if(get(req, 'body.response_type')){
      responseType = get(req, 'body.response_type');
    }

    console.log("")
    console.log('Redirect:  ' + redirectUri)
    console.log('Client ID: ' + clientId)
    console.log('State:     ' + appState)
    console.log("")
    
    if(redirectUri && (appState.length === 0)){
      res.setHeader("Location", redirectUri + "?state=unspecified&error=invalid_request");
      JsonRoutes.sendResult(res, { code: 301 });     
    } else {
      if(clientId){
        let client = OAuthClients.findOne({client_id: clientId});
        if(client){
          console.log('client', client)
  
          let newAuthorizationCode = Random.id();
  
          OAuthClients.update({client_id: clientId}, {$set: {
            "authorization_code":  newAuthorizationCode
          }});        
  
          if(redirectUri){
            if(Array.isArray(client.redirect_uris)){
              if(client.redirect_uris.includes(redirectUri)){
                if(appState.length === 0){
                  res.setHeader("Location", redirectUri + "?state=unspecified&error=invalid_request");
                } else {  
                  
                  setRedirectHeader(res, responseType, redirectUri, appState, newAuthorizationCode)
  
                  JsonRoutes.sendResult(res, {
                    code: 302,
                    data: {
                      code: newAuthorizationCode,
                      state: appState
                    }
                  });      
                }    
              } else {
                JsonRoutes.sendResult(res, {
                  code: 412,
                  data: {
                    "error_message": 'Provided redirect did not match registered redirects...'
                  }  
                });
                // // IIB3b
                // // Todo, fall back to first pre-registered HTTPS url.                  
                // let resolvedRedirectUri = "";

                // let receivedUri = new URL(redirectUri);
                // if(receivedUri.protocol === "https:"){
                //   resolvedRedirectUri = receivedUri;
                // } else {
                //   client.redirect_uris.forEach(function(uri){
                //     let newUrl = new URL(uri);
                //     if(newUrl.protocol === "https:"){
                //       resolvedRedirectUri = uri;
                //     }
                //   });  
                // }

                // setRedirectHeader(res, responseType, resolvedRedirectUri, appState, newAuthorizationCode)
                // JsonRoutes.sendResult(res, {
                //   code: 301,
                //   data: {
                //     code: newAuthorizationCode,
                //     state: appState,
                //     message: 'No redirect URI provided. Using what was provided during registration.'
                //   }
                // }); 

              }              
            } else {
              JsonRoutes.sendResult(res, {
                code: 406,
                data: {
                  "error_message": 'No redirect_uris registered with client....'
                }  
              });
            }
          } else {
            console.log('No redirect URI provided.')

            if(client){
              console.log('Using what was provided during registration.')
              setRedirectHeader(res, responseType, get(client, 'redirect_uris.0', ''), appState, newAuthorizationCode)
              JsonRoutes.sendResult(res, {
                code: 301,
                data: {
                  code: newAuthorizationCode,
                  state: appState,
                  message: 'No redirect URI provided. Using what was provided during registration.'
                }
              });     

            } else {
              console.log('No known redirect URI.')
              JsonRoutes.sendResult(res, {
                code: 400,
                data: {
                  "error_message": 'No known redirect URI.'
                }
              });
           }
          }  
        } else {
          console.log('No client record found matching that client_id');
          JsonRoutes.sendResult(res, {
            code: 401,
            data: {
              "error_message": 'No client record found matching that client_id'
            }
          });
        }
      } else {
        console.log('No client_id in request.  Malformed request.');
        JsonRoutes.sendResult(res, {
          code: 400,
          data: {
            "error_message": 'No client_id in request.  Malformed request.'
          }
        });
      }  
    }
  });

  // JsonRoutes.add("get", "/oauth/token", function (req, res, next) {
  //   console.log('========================================================================');
  //   console.log('GET ' + '/oauth/token');

  //   res.setHeader('Content-type', 'application/json');
  //   res.setHeader("Access-Control-Allow-Origin", "*");

  //   let returnPayload = {
  //     code: 200,
  //     data: {
  //       "access_token": Random.id(),
  //       "token_type": "Bearer"
  //       // "expires_in": ""
  //     }
  //   }
  //   if(process.env.TRACE){
  //     console.log('return payload', returnPayload);
  //   }
   
  //   JsonRoutes.sendResult(res, returnPayload);
  // });
  
  JsonRoutes.add("post", "/oauth/token", function (req, res, next) {
    console.log('========================================================================');
    console.log('POST ' + '/oauth/token');

    preParse(req);

    res.setHeader('Content-type', 'application/json');
    res.setHeader("Access-Control-Allow-Origin", "*");

    process.env.DEBUG && console.log("")
    process.env.DEBUG && console.log("req.query");
    process.env.DEBUG && console.log(req.query);
    process.env.DEBUG && console.log("")
    process.env.DEBUG && console.log("req.body")
    process.env.DEBUG && console.log(req.body);

    // need to do a lookup to find scopes?

    let authorizedClient = OAuthClients.findOne({authorization_code: get(req.body, 'code')});

    process.env.DEBUG && console.log("");
    process.env.DEBUG && console.log('authorizedClient');
    process.env.DEBUG && console.log(authorizedClient);
    process.env.DEBUG && console.log("");

    if(authorizedClient){
      // if(get(req.body, 'client_id') && (get(req.body, 'client_id') !== get(authorizedClient, '_id'))){
      //   JsonRoutes.sendResult(res, {
      //     code: 401
      //   });
      // } else {



        let newAccessToken = Random.id();
        
        delete authorizedClient._document;
        authorizedClient.access_token = newAccessToken;
        authorizedClient.access_token_created_at = new Date();
        OAuthClients.update({_id: authorizedClient._id}, {$set: authorizedClient});

        let returnPayload = {
          code: 200,
          data: {
            // The access token issued by the authorization server
            "access_token": newAccessToken,

            // Fixed value
            "token_type": "Bearer",

            // Scope of access authorized. Note that this can be different from the scopes requested by the app.
            "scope": "openid fhirUser launch offline_access user/*.cruds",

            // The lifetime in seconds of the access token. 
            // For example, the value 3600 denotes that the access token will expire in one hour from the time the response was generated.
            "expires_in": get(Meteor, 'settings.private.fhir.tokenTimeout', 86400) 
          }
        }
        if(process.env.TRACE){
          console.log('return payload', returnPayload);
        }

        JsonRoutes.sendResult(res, returnPayload);
      // }
    } else {
      JsonRoutes.sendResult(res, {
        code: 400
      });
    }
  });



  JsonRoutes.add("get", "/authorizations/manage", function (req, res, next) {
    console.log('========================================================================');
    console.log('GET ' + '/authorizations/manage');

    preParse(req);

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

    preParse(req);

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

    preParse(req);
    
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
