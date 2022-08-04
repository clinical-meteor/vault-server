
import RestHelpers from './RestHelpers';
import fhirPathToMongo from './FhirPath';



import { get, has, set, unset, cloneDeep, capitalize, findIndex, countBy } from 'lodash';
import moment from 'moment';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

import InboundChannel from '../lib/InboundRequests.schema.js';

import jwt from 'jsonwebtoken';
import forge from 'node-forge';

import base64url from 'base64-url';

import { 
  AllergyIntolerances,
  AuditEvents,
  Bundles,
  CarePlans,
  CareTeams,
  CodeSystems,
  Communications,
  CommunicationRequests,
  Compositions,
  Conditions,
  Consents,
  Devices,
  DiagnosticReports,
  DocumentReferences,
  Encounters,
  Endpoints,
  Goals,
  HealthcareServices,
  Immunizations,
  InsurancePlans,
  Lists,
  Locations,
  Medications,
  MedicationOrders,
  Measures,
  Networks,
  MeasureReports,
  Observations,
  Organizations,
  OrganizationAffiliations,
  Patients,
  Practitioners,
  PractitionerRoles,
  Procedures,
  Provenances,
  Questionnaires,
  QuestionnaireResponses,
  Restrictions,
  RelatedPersons,
  RiskAssessments,
  SearchParameters,
  ServiceRequests,
  StructureDefinitions,
  Subscriptions,
  Tasks,
  ValueSets,
  VerificationResults,
  FhirUtilities
} from 'meteor/clinical:hl7-fhir-data-infrastructure';

import OAuthClientComponents from '../lib/OAuthClients.schema.js';
// console.log("&&&&&&&&&&", OAuthClientComponents.OAuthClients)

// import { create } from 'ipfs-http-client';

// import * as IPFS from 'ipfs-core';
// import { AbortController } from "node-abort-controller";
// import { concat } from 'uint8arrays/concat';
// import { toString } from 'uint8arrays/to-string';

let defaultQuery = {};
let defaultOptions = {
    limit: get(Meteor, 'settings.private.fhir.publicationLimit', 1000)
}
if(get(Meteor, 'settings.private.enableAccessRestrictions')){
  defaultOptions.fields = {
      address: 0
  };
}

let ipfsNode;
if(process.env.ENABLE_IPFS){
  // connect to the default API
  ipfsNode = await IPFS.create({ host: 'localhost', port: '3005', protocol: 'http' })
  // ipfsNode = create({ host: 'localhost', port: '3005', protocol: 'http' });
  
  // ipfsNode = create();

  // console.log('ipfs.getEndpointConfig', ipfsNode.getEndpointConfig())
} 

//==========================================================================================
// Collections Namespace  

// These data cursors 

let Collections = {};

if(Meteor.isClient){
  Collections = window;
}
if(Meteor.isServer){
  Collections.AllergyIntolerances = AllergyIntolerances;
  Collections.AuditEvents = AuditEvents;
  Collections.Bundles = Bundles;
  Collections.CarePlans = CarePlans;
  Collections.CareTeams = CareTeams;
  Collections.CodeSystems = CodeSystems;
  Collections.Communications = Communications;
  Collections.CommunicationRequests = CommunicationRequests;
  Collections.Compositions = Compositions;
  Collections.Conditions = Conditions;
  Collections.Consents = Consents;
  Collections.Devices = Devices;
  Collections.DiagnosticReports = DiagnosticReports;
  Collections.DocumentReferences = DocumentReferences;
  Collections.Encounters = Encounters;
  Collections.Endpoints = Endpoints;
  Collections.Goals = Goals;
  Collections.HealthcareServices = HealthcareServices;
  Collections.Immunizations = Immunizations;
  Collections.InsurancePlans = InsurancePlans;
  Collections.Lists = Lists;
  Collections.Locations = Locations;
  Collections.Networks = Networks;
  Collections.Observations = Observations;
  Collections.Organizations = Organizations;
  Collections.OrganizationAffiliations = OrganizationAffiliations;
  Collections.OAuthClients = OAuthClientComponents.OAuthClients;
  Collections.Medications = Medications;
  Collections.MedicationOrders = MedicationOrders;
  Collections.Measures = Measures;
  Collections.MeasureReports = MeasureReports;
  Collections.Patients = Patients;
  Collections.Practitioners = Practitioners;
  Collections.PractitionerRoles = PractitionerRoles;
  Collections.Provenances = Provenances;
  Collections.Procedures = Procedures;
  Collections.Questionnaires = Questionnaires;
  Collections.QuestionnaireResponses = QuestionnaireResponses;
  Collections.Restrictions = Restrictions;
  Collections.RelatedPersons = RelatedPersons;
  Collections.RiskAssessments = RiskAssessments;
  Collections.SearchParameters = SearchParameters;
  Collections.ServiceRequests = ServiceRequests;
  Collections.StructureDefinitions = StructureDefinitions;
  Collections.Subscriptions = Subscriptions;
  Collections.Tasks = Tasks;
  Collections.ValueSets = ValueSets;
  Collections.VerificationResults = VerificationResults;
}


//==========================================================================================
// Global Configs  

let fhirPath = get(Meteor, 'settings.private.fhir.fhirPath', 'baseR4');
let fhirVersion = get(Meteor, 'settings.private.fhir.fhirVersion', 'R4');
let containerAccessToken = get(Meteor, 'settings.private.fhir.accessToken', false);

if(typeof OAuthServerConfig === 'object'){
  // TODO:  double check that this is needed; and that the /api/ route is correct
  JsonRoutes.Middleware.use(
    // '/api/*',
    '/baseR4/*',
    OAuthServerConfig.oauthserver.authorise()   // OAUTH FLOW - A7.1
  );
} else {
  console.log("No OAuthServerConfig found.")
}

// JsonRoutes.setResponseHeaders({
//   "content-type": "application/fhir+json"
// });


// // Meteor.startup(function(){
// console.log('FhirServer is initializing search parameters...')
// SearchParameters.find().forEach(function(parameter){
//   console.log('SearchParameter', get(parameter, 'base.0') + " "+ get(parameter, 'id'))
// })
// // })

//==========================================================================================
// Helper Methods


function parseUserAuthorization(req){
  process.env.DEBUG && console.log("Parsing user authorization....")
  let isAuthorized = false;

  // BASIC AUTH
  if(get(Meteor, 'settings.private.enableBasicAuth')){
    if(get(req, "headers.authorization")){
      let encodedAuth = get(req, "headers.authorization");
      let decodedAuth = base64url.decode(encodedAuth.replace("Basic ", ""))
      console.log('decodedAuth: ' + decodedAuth)
  
      let authParts = decodedAuth.split(":");
      if(authParts[0] && Collections["OAuthClients"]){
        let clientRegistration = Collections["OAuthClients"].findOne({client_id: authParts[0]})
        if(clientRegistration && authParts[1]){
          if(get(clientRegistration, 'client_secret') === authParts[1]){
            isAuthorized = true;

            // system access; 
            // replace with JWT and SMART Backend Services
          } else if(get(clientRegistration, 'client_secret') === "system:1234567890"){
            isAuthorized = true;
          }          

        }
      } else {
        console.log("For some reason the OAuthClients collection doesn't exist.")
      }
    }  
  }

  // SMART on FHIR
  let accessTokenStr = (req.params && req.params.access_token) || (req.query && req.query.access_token);
  if(typeof OAuthServerConfig === 'object'){
    let accessToken = OAuthServerConfig.collections.accessToken.findOne({accessToken: accessTokenStr})

    // GENERATED ACCESS CONTROL LIST
    // let accessList = someProviderRoleCertStoreLookupAuthorizationScopeFunction(OAuthServerConfig.collections.accessToken.findOne({accessToken: accessTokenStr}))
    // user can access:
    // their own record
    // add new certificates
    // edit company info
    // edit practitioners

    // if(get(Meteor, 'settings.private.trace') === true) { console.log('accessToken', accessToken); }
    //if(get(Meteor, 'settings.privattraceug') === true) { console.log('accessToken.userId', accessToken.userId); } 

    process.env.TRACE && console.log('accessToken', accessToken); 

    if(accessToken){
      isAuthorized = true;
    } else if(accessTokenStr === containerAccessToken){
      isAuthorized = true;
    }
  }


  // UDAP

  return isAuthorized;
}


function preParse(request){
  process.env.DEBUG && console.log('request.query', request.query)
  process.env.DEBUG && console.log('request.params', request.params)
  process.env.DEBUG && console.log('request.headers', request.headers)

  if(get(Meteor, 'settings.private.fhir.inboundQueue') === true){
    process.env.TRACE && console.log('Inbound request', request)
    if(InboundChannel){
      InboundChannel.InboundRequests.insert({
        date: new Date(),
        method: get(request, 'method'),
        url: get(request, 'url'),
        body: get(request, 'body'),
        originalUrl: get(request, 'originalUrl'),
        headers: get(request, 'headers')
      });
    }
  }

  return request;
}
function signProvenance(record){
  let publicKey = get(Meteor, 'settings.private.x509.publicKey');
  let privateKey = get(Meteor, 'settings.private.x509.privateKey');

  delete record._document;
  delete record._id;

  console.log('signProvenance', record)

  var token = jwt.sign(JSON.stringify(record), privateKey, { algorithm: 'RS256'})

  let provenanceRecord = {
    resourceType: "Provenance",                  
    target: [],
    signature: [{
      type: [{
        system: 'urn:iso-astm:E1762-95:2013',
        code: '1.2.840.10065.1.12.1.14',
        display: 'Source Signature'
      }],
      when: new Date(),
      who: {
        display: 'National Directory'
      },
      data: token
    }]
  }

  if(Array.isArray(record)){
    record.forEach(function(rec){
      provenanceRecord.target.push({
        reference: get(rec, 'id'),
        type: get(rec, 'referenceId'),
      });  
    })
  } else {
    provenanceRecord.target.push({
      reference: get(record, 'id'),
      type: get(record, 'referenceId'),
    });  
  }

  return JSON.stringify(provenanceRecord)
}

async function exportToIpfsNode(){
  let operationOutcome = {
    "resourceType": "OperationOutcome",
    "issue" : [{ // R!  A single issue associated with the action
      "severity" : "information", // R!  fatal | error | warning | information
      "code" : "informational", // R!  Error or warning code
      "details" : { 
        "text": await ipfsNode.add(jsonPayload),
        "coding": [{
          "system": "http://terminology.hl7.org/CodeSystem/operation-outcome",
          "code": "MSG_UPDATED",
          "display": "existing resource updated",
          "userSelected": false
        }]
      }
    }]
  }
  return operationOutcome;
}
async function listIpfsRecords(req){
  let chunks = [];
  for await (const chunk of ipfsNode.cat(get(req, 'query.cis'))) {
    chunks.push(chunk);
  }
  return toString(Uint8Array.from(concat(chunks)));
}

//==========================================================================================
// Route Manifest  

JsonRoutes.add("post", fhirPath + "/ping", function (req, res, next) {
  console.log('POST ' + fhirPath + '/ping');

  res.setHeader('Content-type', 'application/json');
  res.setHeader("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, PATCH, OPTIONS");

  let returnPayload = {
    code: 200,
    data: "PONG!!!"
  }
  if(process.env.TRACE){
    console.log('return payload', returnPayload);
  }
 
  JsonRoutes.sendResult(res, returnPayload);
});

//==========================================================================================
// Route Manifest  

// If no settings file is provided, we will default to a Public Health Server with no PHI
let serverRouteManifest = {
  "MeasureReport": {
    "interactions": ["read", "create", "update", "delete"]
  },
  "Measure": {
    "interactions": ["read", "create", "update", "delete"]
  },
  "Location": {
    "interactions": ["read", "create", "update", "delete"]
  },
  "Organization": {
    "interactions": ["read", "create", "update", "delete"]
  }
}

// Checking for a settings file
if(has(Meteor, 'settings.private.fhir.rest')){
  serverRouteManifest = get(Meteor, 'settings.private.fhir.rest');
}

// checking if we're in strict validation mode, or if we're promiscuous  
let schemaValidationConfig = get(Meteor, 'settings.private.fhir.schemaValidation', {});

if(typeof serverRouteManifest === "object"){
  console.log('==========================================================================================');
  console.log('Initializing FHIR Server.');
  Object.keys(serverRouteManifest).forEach(function(routeResourceType){

    let collectionName = FhirUtilities.pluralizeResourceName(routeResourceType);
    console.log('Setting up routes for the ' + collectionName + ' collection.');

    // console.log('FhirServer is initializing search parameters...')
    SearchParameters.find({'base': routeResourceType}).forEach(function(parameter){
      console.log('  SearchParameter: ' + get(parameter, 'id'))
    })

    if(Array.isArray(serverRouteManifest[routeResourceType].interactions)){
      
      // vread 
      // https://www.hl7.org/fhir/http.html#vread
      if(serverRouteManifest[routeResourceType].interactions.includes('vread')){
        
        JsonRoutes.add("get", "/" + fhirPath + "/" + routeResourceType + "/:id/_history/:versionId", function (req, res, next) {
          if(get(Meteor, 'settings.private.debug') === true) { console.log('> GET /' + fhirPath + '/' + routeResourceType + '/' + req.params.id + '/_history/' + + req.params.versionId); }
  
          preParse(req);

          res.setHeader("content-type", 'application/fhir+json;charset=utf-8');
          res.setHeader("ETag", fhirVersion);

          let isAuthorized = parseUserAuthorization(req);
          if (isAuthorized || process.env.NOAUTH || get(Meteor, 'settings.private.fhir.disableOauth')) {
            if(get(Meteor, 'settings.private.debug') === true) { console.log('Security checks completed'); }

            process.env.DEBUG && console.log('req.query', req.query)
            process.env.DEBUG && console.log('req.params', req.params)

            let record = Collections[collectionName].findOne({
              'id': get(req, 'params.id'), 
              'meta.versionId': get(req, 'params.versionId')
            });            
            if(get(Meteor, 'settings.private.trace') === true) { console.log('record', record); }
            
            res.setHeader("Last-Modified", moment(get(record, 'meta.lastUpdated')).toDate());
            
            if(record){
              // Success
              JsonRoutes.sendResult(res, {
                code: 200,
                data: RestHelpers.prepForFhirTransfer(record)
              });
            } else {
              // Success
              JsonRoutes.sendResult(res, {
                code: 404
              });
            }
          }
        });
      } else {
        JsonRoutes.add("get", "/" + fhirPath + "/" + routeResourceType + "/:id/_history/:versionId", function (req, res, next) {
          res.setHeader('Content-type', 'application/fhir+json;charset=utf-8');
          res.setHeader("ETag", fhirVersion);
          
          JsonRoutes.sendResult(res, {
            code: 501
          });
        });
      }

      // read
      // https://www.hl7.org/fhir/http.html#read
      if(serverRouteManifest[routeResourceType].interactions.includes('read')){
        // read
        JsonRoutes.add("get", "/" + fhirPath + "/" + routeResourceType + "/:id", function (req, res, next) {
          if(get(Meteor, 'settings.private.debug') === true) { console.log('GET /' + fhirPath + '/' + routeResourceType + '/' + req.params.id); }
  
          preParse(req);

          res.setHeader("content-type", 'application/fhir+json;charset=utf-8');
          res.setHeader("ETag", fhirVersion);


          let isAuthorized = parseUserAuthorization(req);
  
          if (isAuthorized || process.env.NOAUTH || get(Meteor, 'settings.private.fhir.disableOauth')) {
            if(get(Meteor, 'settings.private.debug') === true) { console.log('Security checks completed'); }

            let records;
            let lastModified = moment().subtract(100, 'years');
            let hasVersionedLastModified = false;

            process.env.DEBUG && console.log('req.query', req.query)
            process.env.DEBUG && console.log('req.params', req.params)

            if(req.params.id === "$export"){

              console.log(collectionName + " records: " + Collections[collectionName].find().count());
              
              if(["json", "application/json", "application/fhir+json", "bundle", "Bundle"].includes(get(req, 'query._outputFormat'))){
                let jsonPayload = [];

                Collections[collectionName].find(defaultQuery, defaultOptions).forEach(function(record){
                  jsonPayload.push({
                    fullUrl: routeResourceType + '/' + get(record, 'id'),
                    resource: RestHelpers.prepForFhirTransfer(record)
                  });
                });
  
                process.env.DEBUG && console.log('jsonPayload', jsonPayload);

                res.setHeader('Content-disposition', 'attachment; filename=' + collectionName + ".fhir");
                res.setHeader("x-provenance", signProvenance(jsonPayload));

                // Success
                JsonRoutes.sendResult(res, {
                  code: 200,
                  data: Bundle.generate(jsonPayload)
                });
                
                
              } else if(["ipfs"].includes(get(req, 'query._outputFormat'))){
                let jsonPayload = [];

                Collections[collectionName].find(defaultQuery, defaultOptions).forEach(function(record){
                  jsonPayload.push(RestHelpers.prepForFhirTransfer(record));
                });
  
                jsonPayload.push(signProvenance(jsonPayload));

                process.env.DEBUG && console.log('jsonPayload', jsonPayload);

                if(process.env.ENABLE_IPFS){

                  if(get(req, 'query.cis')){                    
                    // Success
                    JsonRoutes.sendResult(res, {
                      code: 200,
                      data: listIpfsRecords(req)
                    });
                  } else {
                    // Success
                    JsonRoutes.sendResult(res, {
                      code: 200,
                      data: exportToIpfsNode()
                    });

                  }


                } else {
                  JsonRoutes.sendResult(res, {
                    code: 501,
                    data: {
                      "resourceType": "OperationOutcome",
                      "issue" : [{ // R!  A single issue associated with the action
                        "severity" : "error", // R!  fatal | error | warning | information
                        "code" : "please set ENABLE_IPFS=true to enable this functionality", // R!  Error or warning code                        
                      }]
                    }
                  });
                }

                
                
              // if(["ndjson", "application/ndjson", "application/fhir+ndjson"].includes(get(req, 'query._outputFormat'))){
              } else {
                let ndJsonPayload = "[";

                res.setHeader("content-type", 'application/ndjson');
                res.setHeader('Content-disposition', 'attachment; filename=' + collectionName + ".ndjson");
                
                Collections[collectionName].find().forEach(function(record, index){
                  res.write( JSON.stringify(RestHelpers.prepForFhirTransfer(record)) + "\n" );                  
                });  

                // Success
                JsonRoutes.sendResult(res, {
                  code: 202
                });
              }
            } else {

              // not exporting; just a regular read

              records = Collections[collectionName].find({id: req.params.id}, defaultOptions).fetch();

              // plain ol regular approach
              if(get(Meteor, 'settings.private.debug') === true) { console.log('records', records); }
  
              // could we find it?
              if(Array.isArray(records)){
                if(records.length === 0){
                  // no content
                  JsonRoutes.sendResult(res, {
                    code: 204
                  });
                } else if (records.length === 1){
                  res.setHeader("Content-type", 'application/fhir+json');
                  res.setHeader("Last-Modified", lastModified);
                  res.setHeader("x-provenance", signProvenance(records[0]));

                  JsonRoutes.sendResult(res, {
                    code: 200,
                    data: RestHelpers.prepForFhirTransfer(records[0])
                  });
                } else if (records.length > 1){
                  // Success
                  res.setHeader("Content-type", 'application/fhir+json');

                  let mostRecentRecord;

                  if(get(Meteor, 'settings.private.fhir.rest.' + routeResourceType + '.versioning') === "versioned"){

                    if(get(Meteor, 'settings.private.trace') === true) { console.log('records', records); }

                    // and generate a Bundle payload
                    payload = [];

                    // loop through each matching version
                    records.forEach(function(recordVersion){
                      console.log('recordVersion', recordVersion)

                      // look for a meta.versionId that is equal to the number of records
                      // this should be the most-recent record
                      // NOTE:  this algorithm breaks if we ever delete a version from history
                      if(parseInt(get(recordVersion, 'meta.versionId')) === records.length){
                        //if(parseInt(get(recordVersion, 'meta.versionId')) > parseInt(get(records[matchIndex], 'meta.versionId'))){
                          // remove current 
                          // pullAt(payload, matchIndex);

                          mostRecentRecord = recordVersion;

                          if(get(recordVersion, 'meta.lastUpdated')){
                            hasVersionedLastModified = true;
                            if(moment(get(recordVersion, 'meta.lastUpdated')) > moment(lastModified)){
                              lastModified = moment(get(recordVersion, 'meta.lastUpdated')).toDate();
                            }
                          } 

                        //   // add the most recent
                        //   payload.push();
                        // //} 
                      } 

                      // // if we are doing a versioned history, and pull all of the records
                      // if(false){
                      //   payload.push({
                      //     fullUrl: "Organization/" + get(recordVersion, 'id'),
                      //     resource: RestHelpers.prepForFhirTransfer(recordVersion),
                      //     request: {
                      //       method: "GET",
                      //       url: '/' + fhirPath + '/' + routeResourceType + '/' + req.params.id
                      //     },
                      //     response: {
                      //       status: "200"
                      //     }
                      //   });
                      // }
                      
                      
                    });  
                    
                    if(hasVersionedLastModified){
                      res.setHeader("Last-Modified", lastModified);
                    }
                  }

                  res.setHeader("x-provenance", signProvenance(mostRecentRecord));

                  JsonRoutes.sendResult(res, {
                    code: 200,
                    // data: Bundle.generate(payload)
                    data: RestHelpers.prepForFhirTransfer(mostRecentRecord)
                  });
                }
                
              } else {
                // search didn't find an error; something is broken
                // Not Found
                JsonRoutes.sendResult(res, {
                  code: 404
                });
              }
            }

            
                      
          } else {
            // Unauthorized
            JsonRoutes.sendResult(res, {
              code: 401
            });
          }
        });
        
        
        // Search Interaction
        JsonRoutes.add("get", "/" + fhirPath + "/" + routeResourceType, function (req, res, next) {
          if(get(Meteor, 'settings.private.debug') === true) { console.log('-------------------------------------------------------'); }
          if(get(Meteor, 'settings.private.debug') === true) { console.log('>> GET ' + fhirPath + "/" + routeResourceType, req.query); }

          if(get(Meteor, 'settings.private.debug') === true) { 
            console.log('Resource Type: ' + routeResourceType);               
          }

          // first scan the query for any chained queries
          process.env.DEBUG && console.log('--------------------------------------')
          process.env.DEBUG && console.log('Checking for chained queries (GET)....')
          process.env.DEBUG && console.log('req.query', req.query);

          let mongoQuery = {};
          let chainedIds;

          Object.keys(req.query).forEach(function(key){
            let queryParts = key.split(".");
            if(Array.isArray(queryParts)){
              let isChained = false;
              process.env.TRACE && console.log("queryParts.length", queryParts.length);
              if(queryParts.length === 2){
                isChained = true;
                let newQueryUrl = "";
                // console.log('queryParts[0]', queryParts[0])
                let softTarget = capitalize(queryParts[0]);
                if(queryParts[0] === "providedBy"){
                  softTarget = "Organization";
                } 
                let chainedCollectionName = FhirUtilities.pluralizeResourceName(softTarget)
                newQueryUrl = softTarget + "?" + queryParts[1] + "=" + req.query[key]
                process.env.DEBUG && console.log('newQueryUrl', newQueryUrl);

                // look up search parameter for chained query
                let chainQuery = {code: queryParts[1], target: softTarget};
                console.log('chainQuery', chainQuery);

                let chainedSearchParams = SearchParameters.findOne(chainQuery);
                if(chainedSearchParams){
                  if(chainedSearchParams){
                    process.env.DEBUG && console.log('chainedSearchParams.expression', chainedSearchParams.expression)
                    process.env.DEBUG && console.log('chainedSearchParams.xpath', chainedSearchParams.xpath)
                    process.env.DEBUG && console.log('chainedCollectionName', chainedCollectionName)
                  }
  
                  if(Collections[chainedCollectionName]){
                    let chainedQuery = {};
                    chainedQuery[chainedSearchParams.xpath] = req.query[key]
                    process.env.DEBUG && console.log('chainedQuery', chainedQuery)
                    
                    // map the ids of any records that are found into an array
                    chainedIds = Collections[chainedCollectionName].find(chainedQuery).map(function(record){
                      return softTarget + "/" + record.id;
                    })
  
                    // the create the JOIN equivalent by matching the chain reference 
                    // to any of the ids included in the array
                    mongoQuery[queryParts[0] + ".reference"] = {$in: chainedIds}
                  }
  
                }
              }
            }
          })

          process.env.TRACE && console.log('chainedIds', chainedIds);


          // now search through the query for regular run-of-the-mill queries
          SearchParameters.find({base: routeResourceType}).forEach(function(searchParameter){
            process.env.DEBUG && console.log('------------------------------------------------------')
            // process.env.DEBUG && console.log('req.query', req.query);
            process.env.DEBUG && console.log('SearchParameter');
            process.env.DEBUG && console.log('id:         ' + get(searchParameter, 'id'));
            process.env.DEBUG && console.log('code:       ' + get(searchParameter, 'code'));
            process.env.DEBUG && console.log('expression: ' + get(searchParameter, 'expression'));
            process.env.DEBUG && console.log('base        ' + get(searchParameter, 'base'));
            process.env.DEBUG && console.log('target      ' + get(searchParameter, 'target[0]'));
            process.env.DEBUG && console.log('xpath:      ' + get(searchParameter, 'xpath'));
            process.env.DEBUG && console.log(' ');

            Object.keys(req.query).forEach(function(queryKey){              
              // for query keys that dont have a value
              // just build a mongo query that searches if the key exists or not
              if(Object.hasOwnProperty(queryKey) && (Object[queryKey] === "")){
                let fieldExistsQuery = {};
                fieldExistsQuery[queryKey] = {$exists: true};
                Object.assign(mongoQuery, fieldExistsQuery);
              } else if(get(searchParameter, 'code') === queryKey){
                // otherwise, map the fhirpath to mongo
                Object.assign(mongoQuery, fhirPathToMongo(searchParameter, queryKey, req))
              }                
            })       
            
            if(get(Meteor, 'settings.private.debug') === true) { console.log('mongoQuery', JSON.stringify(mongoQuery)); }
          }) 

          process.env.DEBUG && console.log('Original Url:  ' + req.originalUrl)
          process.env.DEBUG && console.log('Generated Mongo query: ', mongoQuery);
          process.env.TRACE && console.log('req', req);


          preParse(req);


          // res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader('Content-type', 'application/fhir+json;charset=utf-8');
          res.setHeader("ETag", fhirVersion);
          

          let isAuthorized = parseUserAuthorization(req);

          if (isAuthorized || process.env.NOAUTH || get(Meteor, 'settings.private.fhir.disableOauth')) {

            let databaseOptions = RestHelpers.generateMongoSearchOptions(req.query, routeResourceType);

            if(get(Meteor, 'settings.private.debug') === true) { console.log('CollectionName: ' + collectionName); }

            let payload = [];

            // time to use the generated mongo query and go fetch actual records
            if(Collections[collectionName]){

              let totalMatches = Collections[collectionName].find(mongoQuery).count();
              let records = Collections[collectionName].find(mongoQuery, databaseOptions).fetch();
              // if(get(Meteor, 'settings.private.debug') === true) { console.log('Found ' + records.length + ' records matching the query on the ' + routeResourceType + ' endpoint.'); }
              process.env.DEBUG && console.log('Found ' + records.length + ' records matching the query on the ' + routeResourceType + ' endpoint.'); 

              // payload entries
              records.forEach(function(record){
                let newEntry = {
                  fullUrl: routeResourceType + "/" + get(record, 'id'),
                  resource: RestHelpers.prepForFhirTransfer(record),
                  search: {
                    mode: "match"
                  }
                }
                payload.push(newEntry);

                // lets check for any _include references
                // process.env.DEBUG && console.log('req.query', req.query);
                if(Array.isArray(req.query._include)){
                  req.query._include.forEach(function(_includeRef){
                    let includeParts = _includeRef.split(":");
                    let referenceBase;
                    if(includeParts.length === 2){
                      referenceBase = includeParts[1];
                    } else if (includeParts.length === 2){
                      referenceBase = includeParts[0];
                    }

                    if(get(record, referenceBase + ".reference")){
                      console.log("_include reference: ", get(record, referenceBase + ".reference"))

                      let includeReferenceParts = (get(record, referenceBase + ".reference")).split("/");
                      console.log('includeReferenceParts.length', includeReferenceParts.length);

                      let pluralizedReferenceBase = FhirUtilities.pluralizeResourceName(capitalize(referenceBase));
                      console.log('pluralizedReferenceBase', pluralizedReferenceBase);

                      if(Collections[pluralizedReferenceBase]){
                        if(includeReferenceParts.length = 2){
                          let _includeReferenceRecord = Collections[pluralizedReferenceBase].findOne({id: includeReferenceParts[1]})
                          if(_includeReferenceRecord){
                            let newEntry = {
                              fullUrl: get(record, referenceBase + ".reference"),
                              resource: RestHelpers.prepForFhirTransfer(_includeReferenceRecord),
                              search: {
                                mode: "include"
                              }
                            }
                            payload.push(newEntry);
                          }
                        }
                      }
                    }
                  })
                }
              });


              // add some pagination logic
              let links = [];
              links.push({
                "relation": "self",
                "url": req.originalUrl
              });  

              if(totalMatches > payload.length){
                links.push({
                  "relation": "next",
                  "url": fhirPath + "/" + '?_skip=' + (parseInt(databaseOptions.skip) + payload.length)
                });  
              }

              
              // Success
              JsonRoutes.sendResult(res, {
                code: 200,
                data: Bundle.generate(payload, "searchset", totalMatches, links)
              });
            } else {
              // Not Implemented
              JsonRoutes.sendResult(res, {
                code: 501
              });
            }            
          } else {
            // Unauthorized
            JsonRoutes.sendResult(res, {
              code: 401
            });
          }
        });
      } else {
        JsonRoutes.add("get", "/" + fhirPath + "/" + routeResourceType + "/:id", function (req, res, next) {
          res.setHeader('Content-type', 'application/fhir+json;charset=utf-8');
          res.setHeader("ETag", fhirVersion);
          
          JsonRoutes.sendResult(res, {
            code: 501
          });
        });

        JsonRoutes.add("get", "/" + fhirPath + "/" + routeResourceType, function (req, res, next) {
          res.setHeader('Content-type', 'application/fhir+json;charset=utf-8');
          res.setHeader("ETag", fhirVersion);
          
          JsonRoutes.sendResult(res, {
            code: 501
          });
        });
      }

      // History-instance
      // https://www.hl7.org/fhir/http.html#history-instance
      if(serverRouteManifest[routeResourceType].interactions.includes('history-instance')){
        // history-instance
        JsonRoutes.add("get", "/" + fhirPath + "/" + routeResourceType + "/:id/_history", function (req, res, next) {
          if(get(Meteor, 'settings.private.debug') === true) { console.log('GET /' + fhirPath + '/' + routeResourceType + '/' + req.params.id + '/_history'); }
  
          process.env.TRACE && console.log('req', req);
          preParse(req);

          res.setHeader("content-type", 'application/fhir+json;charset=utf-8');
          res.setHeader("ETag", fhirVersion);

          let isAuthorized = parseUserAuthorization(req);
          if (isAuthorized || process.env.NOAUTH || get(Meteor, 'settings.private.fhir.disableOauth')) {
            if(get(Meteor, 'settings.private.debug') === true) { console.log('Security checks completed'); }

            let record;
            let lastModified = moment().subtract(100, 'years');
            let hasVersionedLastModified = false;

            process.env.DEBUG && console.log('req.query', req.query)
            process.env.DEBUG && console.log('req.params', req.params)

            let records = Collections[collectionName].find({id: req.params.id});
            if(get(Meteor, 'settings.private.trace') === true) { console.log('records', records); }

            // and generate a Bundle payload
            payload = [];

            records.forEach(function(recordVersion){
              payload.push({
                fullUrl: "Organization/" + get(recordVersion, 'id'),
                resource: RestHelpers.prepForFhirTransfer(recordVersion),
                request: {
                  method: "GET",
                  url: '/' + fhirPath + '/' + routeResourceType + '/' + req.params.id + '/_history'
                },
                response: {
                  status: "200"
                }
              });
              if(get(recordVersion, 'meta.lastUpdated')){
                hasVersionedLastModified = true;
                if(moment(get(recordVersion, 'meta.lastUpdated')) > lastModified){
                  lastModified = moment(get(recordVersion, 'meta.lastUpdated'));
                }
              } 
            });  

            res.setHeader("content-type", 'application/fhir+json');
            if(hasVersionedLastModified){
              res.setHeader("Last-Modified", lastModified.toDate());
            }
            
            // res.setHeader('Content-type', 'application/fhir+json;charset=utf-8');

            // Success
            JsonRoutes.sendResult(res, {
              code: 200,
              data: Bundle.generate(payload, "history")
            });
          }
        });        
      }

      // Update-create 
      // https://www.hl7.org/fhir/http.html#create
      if(serverRouteManifest[routeResourceType].interactions.includes('create')){
        JsonRoutes.add("post", "/" + fhirPath + "/" + routeResourceType, function (req, res, next) {
          if(get(Meteor, 'settings.private.debug') === true) { console.log('================================================================'); }
          if(get(Meteor, 'settings.private.debug') === true) { console.log('POST /' + fhirPath + '/' + routeResourceType); }

          process.env.TRACE && console.log('req', req);
          preParse(req);
          

          res.setHeader('Content-type', 'application/fhir+json;charset=utf-8');
          res.setHeader("ETag", fhirVersion);          

          let accessTokenStr = get(req, 'params.access_token') || get(req, 'params.access_token');

          let isAuthorized = parseUserAuthorization(req);

          if (isAuthorized || process.env.NOAUTH || get(Meteor, 'settings.private.fhir.disableOauth')) {

          //------------------------------------------------------------------------------------------------

          if (req.body) {
            newRecord = req.body;
            if(get(Meteor, 'settings.private.trace') === true) { console.log('req.body', req.body); }
            

            let newlyAssignedId = Random.id();

            // https://www.hl7.org/fhir/http.html#create            

            if(get(newRecord, 'meta.versionId')){
              set(newRecord, 'meta.versionId', (parseInt(newRecord.meta.versionId) + 1).toString());
            } else {
              set(newRecord, 'meta.versionId', "1");
            }
            if(get(newRecord, 'meta.lastUpdated')){
              set(newRecord, 'meta.lastUpdated', new Date());
            }


            if(get(newRecord, 'resourceType')){
              if(get(newRecord, 'resourceType') !== routeResourceType){
                // Unsupported Media Type
                JsonRoutes.sendResult(res, {
                  code: 415,
                  data: 'Wrong FHIR Resource.  Please check your endpoint.'
                });
              } else {
                newRecord.resourceType = routeResourceType;
                newRecord._id = newlyAssignedId;

                if(!get(newRecord, 'id')){
                  newRecord.id = newlyAssignedId;
                }
                
  
                newRecord = RestHelpers.toMongo(newRecord);
                newRecord = RestHelpers.prepForUpdate(newRecord);
  
                if(get(Meteor, 'settings.private.debug') === true) { console.log('newRecord', newRecord); }
  
                
                if(!Collections[collectionName].findOne({id: newlyAssignedId})){
                  if(get(Meteor, 'settings.private.debug') === true) { console.log('No ' + routeResourceType + ' found.  Creating one.'); }
  
                  Collections[collectionName].insert(newRecord, schemaValidationConfig, function(error, result){
                    if (error) {
                      if(get(Meteor, 'settings.private.trace') === true) { console.log('PUT /fhir/MeasureReport/' + req.params.id + "[error]", error); }
  
                      // Bad Request
                      JsonRoutes.sendResult(res, {
                        code: 400,
                        data: error.message
                      });
                    }
                    if (result) {
                      if(get(Meteor, 'settings.private.trace') === true) { console.log('result', result); }
                      res.setHeader("Last-Modified", new Date());
                      res.setHeader("ETag", fhirVersion);

                      // Re-enable the following for Abacus & SANER
                      // But document accordingly, and need to include Provenance stamping
                      // res.setHeader("MeasureReport", fhirPath + "/MeasureReport/" + result);
                      // res.setHeader("Location", "/MeasureReport/" + result);
  
                      let resourceRecords = Collections[collectionName].find({id: newlyAssignedId});
                      let payload = [];
  
                      resourceRecords.forEach(function(record){
                        payload.push(RestHelpers.prepForFhirTransfer(record));
                      });
                      
                      if(get(Meteor, 'settings.private.trace') === true) { console.log("payload", payload); }
  
                      // created!
                      JsonRoutes.sendResult(res, {
                        code: 201,
                        data: Bundle.generate(payload)
                      });
                    }
                  }); 
                } else {
                  // Already Exists
                  JsonRoutes.sendResult(res, {
                    code: 412                        
                  });
                }
              } 
            }
          } else {
            // No body; Unprocessable Entity
            JsonRoutes.sendResult(res, {
              code: 422
            });
          }
        } else {
          // Unauthorized
          JsonRoutes.sendResult(res, {
            code: 401
          });
        }

        });
      }

      // Update 
      // https://www.hl7.org/fhir/http.html#update
      if(serverRouteManifest[routeResourceType].interactions.includes('update')){
        JsonRoutes.add("put", "/" + fhirPath + "/" + routeResourceType + "/:id", function (req, res, next) {
          if(get(Meteor, 'settings.private.debug') === true) { console.log('================================================================'); }
          if(get(Meteor, 'settings.private.debug') === true) { console.log('PUT /' + fhirPath + '/' + routeResourceType + '/' + req.params.id); }
        
          process.env.TRACE && console.log('req', req);
          preParse(req);
          

          res.setHeader('Content-type', 'application/fhir+json;charset=utf-8');
          res.setHeader("ETag", fhirVersion);

          let accessTokenStr = (req.params && req.params.access_token) || (req.query && req.query.access_token);
        
          let isAuthorized = parseUserAuthorization(req);
        
          if (isAuthorized || process.env.NOAUTH || get(Meteor, 'settings.private.fhir.disableOauth')) {
      
            if (req.body) {
              let newRecord = cloneDeep(req.body);
      
              if(get(Meteor, 'settings.private.trace') === true) { console.log('req.body', req.body); }
      
              newRecord.resourceType = routeResourceType;
              newRecord = RestHelpers.toMongo(newRecord);
      
      
              newRecord = RestHelpers.prepForUpdate(newRecord);
      
              if(get(Meteor, 'settings.private.debug') === true) { console.log('-----------------------------------------------------------'); }
              if(get(Meteor, 'settings.private.debug') === true) { console.log('Received a new record to PUT into the database', JSON.stringify(newRecord, null, 2));             }
      

              if(typeof Collections[collectionName] === "object"){
                let numRecordsToUpdate = Collections[collectionName].find({id: req.params.id}).count();

                if(get(Meteor, 'settings.private.debug') === true) { console.log('Number of records found matching the id: ', numRecordsToUpdate); } 
                
                let newlyAssignedId;
        
                if(numRecordsToUpdate > 0){
                  if(get(Meteor, 'settings.private.debug') === true) { console.log('Found existing records; this is an update interaction, not a create interaction'); }
                  if(get(Meteor, 'settings.private.debug') === true) { console.log(numRecordsToUpdate + ' records found...'); }
  
                  // don't need to send internal _ids
                  unset(newRecord, '_id');

                  // versioned, means we have prior versions and need to add a new one
                  if(get(Meteor, 'settings.private.fhir.rest.' + routeResourceType + ".versioning") === "versioned"){
                  // if(get(Meteor, 'settings.private.recordVersioningEnabled')){
                    if(get(Meteor, 'settings.private.debug') === true) { console.log('Versioned Collection: Trying to add another versioned record to the main Task collection.') }
  
                    if(get(Meteor, 'settings.private.debug') === true) { console.log("Lets set a new version ID"); }
                    if(!get(newRecord, 'meta.versionId')){
                      set(newRecord, 'meta.versionId', (numRecordsToUpdate + 1).toString());  
                    }
      
                    if(get(Meteor, 'settings.private.debug') === true) { console.log("And add it to the history"); }
                    newlyAssignedId = Collections[collectionName].insert(newRecord, schemaValidationConfig, function(error, resultId){
                      if (error) {
                        if(get(Meteor, 'settings.private.trace') === true) { console.log('PUT /fhir/' + routeResourceType + '/' + req.params.id + "[error]", error); }
          
                        // Bad Request
                        JsonRoutes.sendResult(res, {
                          code: 400,
                          data: error.message
                        });
                      }
                      if (resultId) {
                        if(get(Meteor, 'settings.private.trace') === true) { console.log('resultId', resultId); }

                        // this MeasureReport header was used in the SANER specification, I think
                        // don't remove, but it needs a conditional statement so it's not included on everything else
                        // res.setHeader("MeasureReport", fhirPath + "/" + routeResourceType + "/" + resultId);
                        res.setHeader("Last-Modified", new Date());
                        
          
                        let updatedRecord = Collections[collectionName].findOne({_id: resultId});
          
                        if(get(Meteor, 'settings.private.trace') === true) { console.log("updatedRecord", updatedRecord); }
          
                        let operationOutcome = {
                          "resourceType": "OperationOutcome",
                          "issue" : [{ // R!  A single issue associated with the action
                            "severity" : "information", // R!  fatal | error | warning | information
                            "code" : "informational", // R!  Error or warning code
                            "details" : { 
                              "text": resultId,
                              "coding": [{
                                "system": "http://terminology.hl7.org/CodeSystem/operation-outcome",
                                "code": "MSG_UPDATED",
                                "display": "existing resource updated",
                                "userSelected": false
                              }]
                             }
                          }]
                        }

                        if(updatedRecord){
                          // success!
                          JsonRoutes.sendResult(res, {
                            code: 200,
                            data: RestHelpers.prepForFhirTransfer(updatedRecord)
                          });
                        } else {
                          // success!
                          JsonRoutes.sendResult(res, {
                            code: 400
                          });
                        }
                      }
                    });    
                  } else {
                    console.log("There's existing records, but we're not a versioned collection");
                    console.log("So we just need to update the record");

                    if(get(Meteor, 'settings.private.debug') === true) { console.log('Nonversioned Collection: Trying to update the existing record.') }
                      newlyAssignedId = Collections[collectionName].update({id: req.params.id}, {$set: newRecord },  schemaValidationConfig, function(error, result){
                      if (error) {
                        if(get(Meteor, 'settings.private.trace') === true) { console.log('PUT /fhir/' + routeResourceType + '/' + req.params.id + "[error]", error); }
          
                        // Bad Request
                        JsonRoutes.sendResult(res, {
                          code: 400,
                          data: error.message
                        });
                      }
                      if (result) {
                        if(get(Meteor, 'settings.private.trace') === true) { console.log('result', result); }
                        // keep the following; needed for SANER
                        // needs a conditional clause
                        // res.setHeader("MeasureReport", fhirPath + "/" + routeResourceType + "/" + result);
                        res.setHeader("Last-Modified", new Date());
                        res.setHeader("ETag", fhirVersion);
          
                        // this isn't a versioned collection, so we expect only a single record
                        let updatedRecord = Collections[collectionName].findOne({id: req.params.id});
          
                        if(updatedRecord){
                          if(get(Meteor, 'settings.private.trace') === true) { console.log("updatedRecord", updatedRecord); }
          
                          // success!
                          JsonRoutes.sendResult(res, {
                            code: 200,
                            data: RestHelpers.prepForFhirTransfer(updatedRecord)
                          });
  
                        } else {
                          // success!
                          JsonRoutes.sendResult(res, {
                            code: 500
                          });
                        }
                        
                        // let recordsToUpdate = Collections[collectionName].find({_id: req.params.id});
                        // let payload = [];
          
                        // recordsToUpdate.forEach(function(record){
                        //   payload.push({
                        //     fullUrl: Meteor.absoluteUrl() + get(Meteor, 'settings.private.fhir.fhirPath', 'fhir-3.0.0/') + get(record, 'resourceType') + "/" + get(record, '_id'),
                        //     resource: RestHelpers.prepForFhirTransfer(record)
                        //   });
                        // });
          
                        // if(get(Meteor, 'settings.private.trace') === true) { console.log("payload", payload); }
          
                        // // success!
                        // JsonRoutes.sendResult(res, {
                        //   code: 200,
                        //   data: Bundle.generate(payload)
                        // });
                      }
                    });
                  }
                  
                // no existing records found, this is a create interaction
                } else {        
                  if(get(Meteor, 'settings.private.debug') === true) { console.log('No matching records found.  Creating one.'); }
  
                  if(get(Meteor, 'settings.private.fhir.rest.' + routeResourceType + '.versioning') === "versioned"){
                    set(newRecord, 'meta.versionId', "1")
                  }

                  if(get(Meteor, 'settings.private.debug') === true) { console.log(newRecord); }
  
                  newlyAssignedId = Collections[collectionName].insert(newRecord, schemaValidationConfig, function(error, resultId){
                    if (error) {
                      if(get(Meteor, 'settings.private.trace') === true) { console.log('PUT /fhir/' + routeResourceType + '/' + req.params.id + "[error]", error); }
        
                      // Bad Request
                      JsonRoutes.sendResult(res, {
                        code: 400,
                        data: error.message
                      });
                    }
                    if (resultId) {
                      if(get(Meteor, 'settings.private.trace') === true) { console.log('resultId', resultId); }
                      res.setHeader("MeasureReport", fhirPath + "/" + routeResourceType + "/" + resultId);
                      res.setHeader("Last-Modified", new Date());
                      res.setHeader("ETag", fhirVersion);
        
                      let updatedRecord = Collections[collectionName].findOne({_id: resultId});
        
                      // Created!
                      JsonRoutes.sendResult(res, {
                        code: 201,
                        data: RestHelpers.prepForFhirTransfer(updatedRecord)
                      });
                    }
                  }); 
  
                  // // can't find an existing copy of the record?
                  // if(!Collections[collectionName].findOne({_id: req.params.id})){
                  //   // lets create one!
                  //   if(get(Meteor, 'settings.private.trace') === true) { 
                  //     console.log('newRecord', newRecord); 
                  //   }             
                  
                       
                  // } else {
                    
                  //   Collections[collectionName].update({_id: req.params.id}, {$set: newRecord}, schemaValidationConfig, function(error, result){
                  //     if (error) {
                  //       if(get(Meteor, 'settings.private.trace') === true) { console.log('PUT /fhir/' + routeResourceType + '/' + req.params.id + "[error]", error); }
          
                  //       // Bad Request
                  //       JsonRoutes.sendResult(res, {
                  //         code: 400,
                  //         data: error.message
                  //       });
                  //     }
                  //     if (result) {
                  //       if(get(Meteor, 'settings.private.trace') === true) { console.log('result', result); }
                  //       res.setHeader("MeasureReport", fhirPath + "/" + routeResourceType + "/" + result);
                  //       res.setHeader("Last-Modified", new Date());
                  //       res.setHeader("ETag", fhirVersion);
          
                  //       let recordsToUpdate = Collections[collectionName].find({_id: req.params.id});
                  //       let payload = [];
          
                  //       recordsToUpdate.forEach(function(record){
                  //         payload.push(RestHelpers.prepForFhirTransfer(record));
                  //       });
          
                  //       if(get(Meteor, 'settings.private.trace') === true) { console.log("payload", payload); }
          
                  //       // Success!
                  //       JsonRoutes.sendResult(res, {
                  //         code: 200,
                  //         data: Bundle.generate(payload)
                  //       });
                  //     }
                  //   });    
                  // }                    
                }  
              } else {
                console.log(collectionName + ' collection not found.')
              }
            } else {
              // no body; Unprocessable Entity
              JsonRoutes.sendResult(res, {
                code: 422
              });
            }
          } else {
            // Unauthorized
            JsonRoutes.sendResult(res, {
              code: 401
            });
          }

        });
      }

      // Patch Interaction
      // https://www.hl7.org/fhir/http.html#update
      // https://stackoverflow.com/questions/31683075/how-to-do-a-deep-comparison-between-2-objects-with-lodash  

      if(serverRouteManifest[routeResourceType].interactions.includes('patch')){
        JsonRoutes.add("patch", "/" + fhirPath + "/" + routeResourceType + "/:id", function (req, res, next) {
          process.env.DEBUG && console.log('================================================================'); 
          process.env.DEBUG && console.log('PATCH /' + fhirPath + '/' + routeResourceType + '/' + req.params.id); 
        
          process.env.TRACE && console.log('req', req);
          preParse(req);
          

          res.setHeader('Content-type', 'application/fhir+json;charset=utf-8');
          res.setHeader("ETag", fhirVersion);

          let accessTokenStr = (req.params && req.params.access_token) || (req.query && req.query.access_token);
        
          let isAuthorized = parseUserAuthorization(req);
        
          if (isAuthorized || process.env.NOAUTH || get(Meteor, 'settings.private.fhir.disableOauth')) {            

            if (req.body) {
              let incomingRecord = cloneDeep(req.body);
      
              process.env.TRACE && console.log('req.body', req.body); 
      
              incomingRecord.resourceType = routeResourceType;
              incomingRecord = RestHelpers.toMongo(incomingRecord);
              incomingRecord = RestHelpers.prepForUpdate(incomingRecord);
      
              process.env.DEBUG && console.log('-----------------------------------------------------------'); 
              process.env.DEBUG && console.log('Received a new record to PATCH into the database', JSON.stringify(newRecord, null, 2));             
      

              if(typeof Collections[collectionName] === "object"){
                let numRecordsToUpdate = Collections[collectionName].find({id: req.params.id}).count();

                process.env.DEBUG && console.log('Number of records found matching the id: ', numRecordsToUpdate); 
                
                let newlyAssignedId;
        
                if(numRecordsToUpdate > 1){
                  if(get(Meteor, 'settings.private.debug') === true) { console.log('Found existing records; this is an update interaction, not a create interaction'); }
                  if(get(Meteor, 'settings.private.debug') === true) { console.log(numRecordsToUpdate + ' records found...'); }

                  if(process.env.DEBUG){
                    console.log('req.query', req.query);
                    console.log('req.params', req.params);
                    console.log('req.body', req.body);  
                  }
                  
                  let setObjectPatch = {};
                  Object.keys(req.query).forEach(function(key){
                    setObjectPatch[key] = get(req.body, key);
                  })

                  
                  if(get(Meteor, 'settings.private.debug') === true) { console.log('setObjectPatch', setObjectPatch); }
                  let result = Collections[collectionName].update({id: req.params.id}, {$set: setObjectPatch}, {multi: true});

                  // Unauthorized
                  JsonRoutes.sendResult(res, {
                    code: 200,
                    data: result + " record(s) updated."
                  });

                } else if (numRecordsToUpdate === 1) {
                  if(get(Meteor, 'settings.private.debug') === true) { console.log('Trying to patch an existing record.') }

                  let currentRecord = Collections[collectionName].findOne({id: req.params.id});

                  delete currentRecord._document;

                  // let patchedRecord = Object.assign(currentRecord, incomingRecord);                  

                  let setObjectPatch = {};
                  Object.keys(req.query).forEach(function(key){
                    setObjectPatch[key] = get(req.body, key);
                  })
                  if(get(Meteor, 'settings.private.debug') === true) { console.log('setObjectPatch', setObjectPatch); }

                  
                  Collections[collectionName].update({_id: setObjectPatch._id}, {$set: setObjectPatch});

                  delete setObjectPatch._document;
                  delete setObjectPatch._id;

                  JsonRoutes.sendResult(res, {
                    data: setObjectPatch,
                    code: 204
                  });
                } else if (numRecordsToUpdate === 0){
                  JsonRoutes.sendResult(res, {
                    code: 404
                  });
                }
              } else {
                console.log(collectionName + ' collection not found.')
                JsonRoutes.sendResult(res, {
                  code: 500,
                  data: {
                    message: collectionName + ' collection not found.'
                  }
                });
              }
            } else {
              // no body; Unprocessable Entity
              JsonRoutes.sendResult(res, {
                code: 422
              });
            }
          } else {
            // Unauthorized
            JsonRoutes.sendResult(res, {
              code: 401
            });
          }

        });
      } else {
        JsonRoutes.add("patch", "/" + fhirPath + "/" + routeResourceType + "/:id", function (req, res, next) {
          res.setHeader('Content-type', 'application/fhir+json;charset=utf-8');
          res.setHeader("ETag", fhirVersion);
          
          JsonRoutes.sendResult(res, {
            code: 501
          });
        });
      }

      // Delete Interaction
      // https://www.hl7.org/fhir/http.html#delete
      if(serverRouteManifest[routeResourceType].interactions.includes('delete')){
        JsonRoutes.add("delete", "/" + fhirPath + "/" + routeResourceType + "/:id", function (req, res, next) {
          if(get(Meteor, 'settings.private.debug') === true) { console.log('================================================================'); }
          if(get(Meteor, 'settings.private.debug') === true) { console.log('DELETE /' + fhirPath + '/' + routeResourceType + '/' + req.params.id); }

          process.env.TRACE && console.log('req', req);
          preParse(req);
          

          res.setHeader('Content-type', 'application/fhir+json;charset=utf-8');
          res.setHeader("ETag", fhirVersion);

          let isAuthorized = parseUserAuthorization(req);

          if (isAuthorized || process.env.NOAUTH || get(Meteor, 'settings.private.fhir.disableOauth')) {
            if(get(Meteor, 'settings.private.trace') === true) { 
              console.log('Searching ' + collectionName + ' for ' + req.params.id, Collections[collectionName].find({_id: req.params.id}).count()); 
            }

            if (Collections[collectionName].find({id: req.params.id}).count() === 0) {

              // Not Found
              JsonRoutes.sendResult(res, {
                code: 404
              });

              // // Gone
              // JsonRoutes.sendResult(res, {
              //   code: 410
              // });
            } else {
              Collections[collectionName].remove({id: req.params.id}, function(error, result){
                if (result) {
                  // No Content
                  JsonRoutes.sendResult(res, {
                    code: 204
                  });
                }
                if (error) {
                  // Conflict
                  JsonRoutes.sendResult(res, {
                    code: 409
                  });
                }
              });
            }
          } else {
            // Unauthorized
            JsonRoutes.sendResult(res, {
              code: 401
            });
          }
        });
      }  else {
        JsonRoutes.add("delete", "/" + fhirPath + "/" + routeResourceType + "/:id", function (req, res, next) {
          res.setHeader('Content-type', 'application/fhir+json;charset=utf-8');
          res.setHeader("ETag", fhirVersion);
          
          JsonRoutes.sendResult(res, {
            code: 501
          });
        });
      }

      // Search Interaction
      // https://www.hl7.org/fhir/http.html#search
      if(serverRouteManifest[routeResourceType].search){
        JsonRoutes.add("post", "/" + fhirPath + "/" + routeResourceType + "/:param", function (req, res, next) {
          if(get(Meteor, 'settings.private.debug') === true) { console.log('================================================================'); }
          if(get(Meteor, 'settings.private.debug') === true) { console.log('POST /' + fhirPath + '/' + routeResourceType + '/' + JSON.stringify(req.query)); }

          
          preParse(req);

          process.env.DEBUG && console.log('---------------------------------------')
          process.env.DEBUG && console.log('Checking for chained queries (POST)....')
          process.env.DEBUG && console.log('req.query', req.query);

          Object.keys(req.query).forEach(function(key){
            let result = 0;
            let queryParts = key.split(".");
            if(Array.isArray(queryParts)){
              result = queryParts.length;
              if(queryParts.length === 2){
                
              }
            }

            return result;
          })

          res.setHeader('Content-type', 'application/fhir+json;charset=utf-8');
          res.setHeader("ETag", fhirVersion);

          let isAuthorized = parseUserAuthorization(req);

          if (isAuthorized || process.env.NOAUTH || get(Meteor, 'settings.private.fhir.disableOauth')) {
            let matchingRecords = [];
            let payload = [];
            let searchLimit = 1;

            if (get(req, 'query._count')) {
              searchLimit = parseInt(get(req, 'query._count'));
            }

            if (req.params.param.includes('_search')) {

              let databaseQuery = RestHelpers.generateMongoSearchQuery(req.query, routeResourceType);
              if(get(Meteor, 'settings.private.debug') === true) { console.log('Collections[collectionName].databaseQuery', databaseQuery); }

              matchingRecords = Collections[collectionName].find(databaseQuery, {limit: searchLimit}).fetch();
              console.log('matchingRecords', matchingRecords);
              
              let payload = [];

              matchingRecords.forEach(function(record){
                payload.push({
                  fullUrl: routeResourceType + "/" + get(record, 'id'),
                  resource: RestHelpers.prepForFhirTransfer(record),
                  request: {
                    method: "POST",
                    url: '/' + fhirPath + '/' + routeResourceType + '/' + JSON.stringify(req.query)
                  },
                  response: {
                    status: "200"
                  }
                });
              });

              console.log('payload', payload);

              // Success
              JsonRoutes.sendResult(res, {
                code: 200,
                data: Bundle.generate(payload)
              });

            //==============================================================================
            // this is operator logic, and will probably need to go into a switch statement

            // post /Organization/$match
            } else if (req.params.param.includes('$match')) {
              console.log("$MATCH!!!!");

              console.log('req.body.parameter[0]', get(req, 'body.parameter[0].resource'));
              let matchParams = get(req, 'body.parameter[0].resource');
              let fullName = get(matchParams, 'name[0].family') + get(matchParams, 'name[0].given[0]');
              console.log('name:', fullName);
              let generatedQuery = {};
              let weighting = 0;

              // full name - weighting: .50
              if(typeof get(req, 'body.name') === "string"){
                weighting = .5;
                generatedQuery["name"] = {$regex: get(req, 'body.name')}
              }               

              // full name - weighting: .50
              if(typeof get(req, 'body.name[0].text') === "string"){
                weighting = .5;
                generatedQuery["name.text"] = {$regex: get(req, 'body.name[0].text')}
              }               

              // NPI number - weighting: .99
              if(typeof get(req, 'body.identifier[0].value') === "string"){
                weighting = .99;
                generatedQuery["identifier.value"] = get(req, 'body.identifier[0].value')
              } 
              

              console.log('generatedQuery', generatedQuery);
              matchingRecords = Collections[collectionName].find(generatedQuery).fetch();
              console.log('matchingRecords.length', matchingRecords.length);

              let payload = [];

              if(matchingRecords.length === 0 ){
                JsonRoutes.sendResult(res, {
                  code: 400,
                  data: {
                    "resourceType": "OperationOutcome",
                    "severity": "warning",
                    "code": "invalid",
                    "details": {
                      "text": "No Resource found matching the query",
                      "coding": {
                        "system": "http://terminology.hl7.org/CodeSystem/operation-outcome",
                        "value": "MSG_NO_MATCH",
                        "display": "No Resource found matching the query"
                      }
                    }                
                  }
                });
              } else {
                matchingRecords.forEach(function(record){
                  // console.log('record', get(record, 'name'))

                  record.extension = [{
                    url: "https://build.fhir.org/ig/HL7/fhir-directory-attestation/match-quality",
                    valueDecimal: weighting
                  }];

                  delete record.text;


                  payload.push({
                    fullUrl: routeResourceType + "/" + get(record, 'id'),
                    resource: RestHelpers.prepForFhirTransfer(record),
                    request: {
                      method: "POST",
                      url: '/' + fhirPath + '/' + routeResourceType + '/' + JSON.stringify(req.query)
                    },
                    response: {
                      status: "200"
                    }
                  });
                });
  
                console.log('payload', payload);

                let payloadBundle = Bundle.generate(payload);
                
  
                // Success
                JsonRoutes.sendResult(res, {
                  code: 200,
                  data: payloadBundle
                }); 
              }
            } 
            //==============================================================================

            // console.log('payload', payload);

            // // Success
            // JsonRoutes.sendResult(res, {
            //   code: 200,
            //   data: Bundle.generate(payload)
            // });
          } else {
            // Unauthorized
            JsonRoutes.sendResult(res, {
              code: 401
            });
          }
          // } else {
          //   // no oAuth server installed; Not Implemented
          //   JsonRoutes.sendResult(res, {
          //     code: 501
          //   });
          // }
        });

        // Search Interaction
        JsonRoutes.add("get", "/" + fhirPath + "/" + routeResourceType + ":param", function (req, res, next) {
          if(get(Meteor, 'settings.private.debug') === true) { console.log('-----------------------------------------------------------------------------'); }
          if(get(Meteor, 'settings.private.debug') === true) { console.log('??? GET /' + fhirPath + '/' + routeResourceType + '?' + JSON.stringify(req.query)); }
          if(get(Meteor, 'settings.private.debug') === true) { console.log('params', req.params); }


          preParse(req);
          
          process.env.DEBUG && console.log('--------------------------------------')
          process.env.DEBUG && console.log('Checking for chained queries (GET)....')
          process.env.DEBUG && console.log('req.query', req.query);
          Object.keys(req.query).forEach(function(key){
            let result = 0;
            let queryParts = key.split(".");
            if(Array.isArray(queryParts)){
              result = queryParts.length;
              if(queryParts.length === 2){
                
              }
            }

            return result;
          })

          

          res.setHeader('Content-type', 'application/fhir+json;charset=utf-8');
          
          let isAuthorized = parseUserAuthorization(req);

          if (isAuthorized || process.env.NOAUTH || get(Meteor, 'settings.private.fhir.disableOauth')) {

            let resourceRecords = [];

            if (req.params.param.includes('_search')) {
              let searchLimit = 1;
              if (get(req, 'query._count')) {
                searchLimit = parseInt(get(req, 'query._count'));
              }
              let databaseQuery = RestHelpers.generateMongoSearchQuery(req.query, routeResourceType);
              if(get(Meteor, 'settings.private.debug') === true) { console.log('Generated the following query for the ' + routeResourceType + ' collection.', databaseQuery); }

              resourceRecords = Collections[collectionName].find(databaseQuery, {limit: searchLimit}).fetch();

              let payload = [];

              resourceRecords.forEach(function(record){
                payload.push({
                  fullUrl: routeResourceType + "/" + get(record, 'id'),
                  resource: RestHelpers.prepForFhirTransfer(record)
                });
              });
            }

            // Success
            JsonRoutes.sendResult(res, {
              code: 200,
              data: Bundle.generate(payload)
            });
          } else {
            // Unauthorized
            JsonRoutes.sendResult(res, {
              code: 401
            });
          }
          // } else {
          //   // no oAuth server installed; Not Implemented
          //   JsonRoutes.sendResult(res, {
          //     code: 501
          //   });
          // }
        });
      }

      
    }
  });

  console.log('FHIR Server is online.');
}