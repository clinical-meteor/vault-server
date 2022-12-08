
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { HTTP } from 'meteor/http';
import { get, has } from 'lodash';

import forge from 'node-forge';
import base64url from 'base64-url';

let pki = forge.pki;

import jwt from 'jsonwebtoken';

import ndjsonParser from 'ndjson-parse';

import { 
    FhirUtilities, 
    AllergyIntolerances,
    Bundles,
    CarePlans,
    CodeSystems, 
    Conditions,
    Communications,
    CommunicationRequests,
    CommunicationResponses,
    Devices,
    Encounters, 
    Endpoints, 
    Immunizations,
    Lists,
    Locations,
    Medications,
    MedicationOrders,
    MedicationStatements,
    MessageHeaders,
    Measures,
    MeasureReports,
    Organizations,
    Observations, 
    Patients,
    Practitioners,
    Procedures,
    Questionnaires,
    QuestionnaireResponses,
    SearchParameters, 
    StructureDefinitions, 
    ValueSets,
    Tasks
} from 'meteor/clinical:hl7-fhir-data-infrastructure';




// //---------------------------------------------------------------------------
// // Collections

// // this is a little hacky, but it works to access our collections.
// // we use to use Mongo.Collection.get(collectionName), but in Meteor 1.3, it was deprecated
// // we then started using window[collectionName], but that only works on the client
// // so we now take the window and 

// let Collections = {};

// if(Meteor.isClient){
//   Collections = window;
// }
// if(Meteor.isServer){
//   Collections.AllergyIntolerances = AllergyIntolerances;
//   Collections.Bundles = Bundles;
//   Collections.CarePlans = CarePlans;
//   Collections.Conditions = Conditions;
//   Collections.Communications = Communications;
//   Collections.CommunicationRequests = CommunicationRequests;
//   Collections.CommunicationResponses = CommunicationResponses;
//   Collections.Devices = Devices;  
//   Collections.Encounters = Encounters;
//   Collections.Immunizations = Immunizations;
//   Collections.Lists = Lists;
//   Collections.Locations = Locations;
//   Collections.Medications = Medications;
//   Collections.MedicationOrders = MedicationOrders;
//   Collections.MedicationStatements = MedicationStatements;
//   Collections.MessageHeaders = MessageHeaders;
//   Collections.Measures = Measures;
//   Collections.MeasureReports = MeasureReports;
//   Collections.Organizations = Organizations;
//   Collections.Observations = Observations;
//   Collections.Patients = Patients;
//   Collections.Practitioners = Practitioners;
//   Collections.Procedures = Procedures;
//   Collections.Questionnaires = Questionnaires;
//   Collections.QuestionnaireResponses = QuestionnaireResponses;
//   Collections.Tasks = Tasks;
// }

let UdapUtilities = {
    parseCertAttributes: function(certActor){
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
}


if(Meteor.isServer){

    

    Meteor.methods({
        fetchWellKnownUdap: async function(wellKnownUdapUrl){
            console.log('fetchWellKnownUdap', wellKnownUdapUrl);
    
            return await HTTP.get(wellKnownUdapUrl)
        },
        generateAndSignJwt: function(jwtPayload){
            console.log("--------------------------------------------------------------")
            console.log("Signing JWT...")
            console.log("")
            console.log('jwtPayload', jwtPayload);
            console.log("")
            
            let result = {};
    
            let privateKeyPem = get(Meteor, 'settings.private.x509.privateKey');
            console.log('privateKeyPem')   
            console.log(privateKeyPem)            
    
            jwt.sign(jwtPayload, privateKeyPem.trim(), {
                algorithm: 'RS256',
            }, function(error, token){
                if(error){
                    console.log('error', error)
                }
                if(token){
                    console.log('token', token)
                    result.token = token;
                }
            });
            console.log("--------------------------------------------------------------")    
            return result;
        },
        decodeJwt: function(encodedJwt){
            console.log("--------------------------------------------------------------")
            console.log("Decoding JWT...")
            console.log("")
            console.log('encodedJwt', encodedJwt);
            console.log("")

            let decoded = jwt.decode(encodedJwt, {complete: true});
            console.log("decoded", decoded)
            console.log("--------------------------------------------------------------")
            return decoded;
        },
        decodeCertificate: function(encodedCertificate){
            console.log("--------------------------------------------------------------")
            console.log("Decoding certificate...")
            console.log("")
            process.env.DEBUG && console.log('encodedCertificate', encodedCertificate);
            process.env.DEBUG && console.log("")


            var cert = pki.certificateFromPem(encodedCertificate);
            console.log('cert', cert);

            console.log('cert.serialNumber:  ', cert.serialNumber)
            console.log('cert.subject:       ', UdapUtilities.parseCertAttributes(cert.subject))
            console.log('cert.issuer:        ', UdapUtilities.parseCertAttributes(cert.issuer))
      

            // let caStore = pki.createCaStore([]);
            // console.log('caStore', caStore);

            // caStore.addCertificate(encodedCertificate);
            // console.log('caStore', caStore);

            
            // // let issuerCert = caStore.getIssuer(encodedCertificate);
            // let issuerCert = caStore.getIssuer(encodedCertificate);
            // console.log('issuerCert', issuerCert);

            // let publicKey = pki.publicKeyFromPem(encodedCertificate);
            // console.log('publicKey', publicKey);

            // let decoded = jwt.decode(encodedJwt, {complete: true});
            // console.log("decoded", decoded)
            console.log("--------------------------------------------------------------")
            // return decoded;
            return cert;
        },
        getCertificateIssuer: function(decodedCertificate){
            console.log("--------------------------------------------------------------")
            console.log("Getting certificate issuer...")
            console.log("")
            console.log('decodedCertificate', decodedCertificate);
            console.log("")



            // let caStore = pki.createCaStore([]);
            // console.log('caStore', caStore);

            // caStore.addCertificate(encodedCertificate);
            // console.log('caStore', caStore);

            
            // // let issuerCert = caStore.getIssuer(encodedCertificate);
            // let issuerCert = caStore.getIssuer(encodedCertificate);
            // console.log('issuerCert', issuerCert);

            // let publicKey = pki.publicKeyFromPem(encodedCertificate);
            // console.log('publicKey', publicKey);

            // let decoded = jwt.decode(encodedJwt, {complete: true});
            // console.log("decoded", decoded)
            console.log("--------------------------------------------------------------")
            // return decoded;
            return cert;
        },
        generateCertificate: function(){
            console.log("Generate certificate...")
    
            let privateKeyPem = get(Meteor, 'settings.private.x509.privateKey');
            let publicKeyPem = get(Meteor, 'settings.private.x509.publicKey');
    
            let privateKey = pki.privateKeyFromPem(privateKeyPem)
            let publicKey = pki.publicKeyFromPem(publicKeyPem)
    
            var certificatePem = "";
    
            if(privateKey){
                console.log('privateKey', privateKey)
                console.log('publicKey', publicKey)
    
                let cert = pki.createCertificate();
    
                cert.publicKey = publicKey;
                cert.serialNumber = '01';
                cert.validity.notBefore = new Date();
                cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    
                var attrs = [{
                    name: 'commonName',
                    value: 'mitre.org'
                    }, {
                    name: 'countryName',
                    value: 'US'
                    }, {
                    shortName: 'ST',
                    value: 'Illinois'
                    }, {
                    name: 'localityName',
                    value: 'Chicago'
                    }, {
                    name: 'organizationName',
                    value: 'MITRE'
                    }, {
                    shortName: 'OU',
                    value: 'MITRE'
                }];
                // cert.setSubject(attrs);
                cert.setIssuer(attrs);
                cert.sign(privateKey);
    
                console.log('cert', cert);
    
                certificatePem = pki.certificateToPem(cert);
                console.log('certificatePem', certificatePem)
            }
    
            return certificatePem;
        },
    })    
}
