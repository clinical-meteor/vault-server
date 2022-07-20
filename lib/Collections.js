
import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { HTTP } from 'meteor/http';

import moment from 'moment';
import { get } from 'lodash';

import SimpleSchema from 'simpl-schema';
import { BaseSchema, DomainResourceSchema } from 'meteor/clinical:hl7-resource-datatypes';

// OAuthClients = new Mongo.Collection('OAuthClients');

import OAuthChannel from './OAuthClients.schema.js';
import UdapChannel from './UdapCertificates.schema.js';

import base64url from 'base64-url';

import { 
    FhirUtilities, 
    AllergyIntolerances, 
    AuditEvents, 
    Bundles, 
    CodeSystems, 
    Conditions, 
    Consents, 
    Communications, 
    CommunicationRequests, 
    CarePlans, 
    CareTeams, 
    Devices, 
    DocumentReferences, 
    Encounters, 
    Endpoints, 
    HealthcareServices, 
    Immunizations, 
    InsurancePlans,
    Locations,  
    Medications, 
    Measures,
    MeasureReports,
    Networks,
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
    SearchParameters, 
    StructureDefinitions, 
    Subscriptions,
    Tasks, 
    ValueSets,
    VerificationResults,
    ServerStats    
} from 'meteor/clinical:hl7-fhir-data-infrastructure';


let collectionNames = [
        "AllergyIntolerances",
        "AuditEvents",
        "Bundles",
        "CodeSystems",
        "Conditions",
        "Consents",
        "Communications",
        "CommunicationRequests",
        "CarePlans",
        "CareTeams",
        "Devices",
        "DocumentReferences",
        "Encounters",
        "Endpoints",
        "HealthcareServices",
        "Immunizations",
        "InsurancePlans",
        "Locations",
        "Medications",
        "Measure",
        "MeasureReports",
        "Networks",
        "OAuthClients",
        "Observations",
        "Organizations",
        "OrganizationAffiliations",
        "Patients",
        "Practitioners",
        "PractitionerRoles",
        "Procedures",
        "Provenances",
        "Questionnaires",
        "QuestionnaireResponses",
        "Restrictions",
        "SearchParameters",
        "StructureDefinitions",
        "Subscriptions",
        "Tasks",
        "ValueSets",
        "VerificationResults",
        "UdapCertificates"
    ];

let Collections = {
    AllergyIntolerances: AllergyIntolerances,
    AuditEvents: AuditEvents,
    Bundles: Bundles,
    CodeSystems: CodeSystems,
    Conditions: Conditions,
    Consents: Consents,
    Communications: Communications,
    CommunicationRequests: CommunicationRequests,
    CarePlans: CarePlans,
    CareTeams: CareTeams,
    Devices: Devices,
    DocumentReferences: DocumentReferences,
    Encounters: Encounters,
    Endpoints: Endpoints,
    HealthcareServices: HealthcareServices,
    Immunizations: Immunizations,
    InsurancePlans: InsurancePlans,
    Locations: Locations,
    Medications: Medications,
    Measures: Measures,
    MeasureReports: MeasureReports,
    Networks: Networks,
    OAuthClients: OAuthChannel.OAuthClients,
    Observations: Observations,
    Organizations: Organizations,
    OrganizationAffiliations: OrganizationAffiliations,
    Patients: Patients,
    Practitioners: Practitioners,
    PractitionerRoles: PractitionerRoles,
    Procedures: Procedures,
    Provenances: Provenances,
    Questionnaires: Questionnaires,
    QuestionnaireResponses: QuestionnaireResponses,
    Restrictions: Restrictions,
    SearchParameters: SearchParameters,
    StructureDefinitions: StructureDefinitions,
    Subscriptions: Subscriptions,
    Tasks: Tasks,
    ValueSets: ValueSets,
    VerificationResults: VerificationResults,
    UdapCertificates: UdapChannel.UdapCertificates
};

// console.log('Collections.Organizations', Collections.Organizations)
// console.log('Collections.UdapCertificates', Collections.UdapCertificates)


function setCollectionDefaultQuery(collectionName, subscriptionRecord){
    let defaultQuery;

    switch (collectionName) {
        case "Organizations":
            defaultQuery = {$and: [{name: {$exists: true}}, {address: {$exists: true}}]}
            break;
        case "Locations":
            defaultQuery = {$and: [{name: {$exists: true}}, {address: {$exists: true}}]}
            break;
        default:
            defaultQuery = {};
            break;
    }

    if(get(subscriptionRecord, 'criteria')){
        let criteriaString = get(subscriptionRecord, 'criteria');
        let criteriaJson = JSON.parse(criteriaString);
        console.log('criteriaJson', criteriaJson);

        if(typeof criteriaJson === "object"){
            Object.assign(defaultQuery, criteriaJson);
        }
    }
    
    return defaultQuery
}


if(Meteor.isClient){
    // Collections = window;

  if(get(Meteor, 'settings.public.fhirAutoSubscribe')){

    // should we iterate through Meteor.settings.private.fhir.rest here?
    Object.keys(Collections).forEach(function(collectionName){
        console.log("Autosubscribing to the " + collectionName + " data channel.")
        Meteor.subscribe(collectionName);    
    });
  } else {
    // query the server for current subscriptions (based on userId)
    // for each resource type in list
    // subscribe to a DDS pubsub based on the FHIR Subscription record

    console.log("Subscriptions count: " + Subscriptions.find().count())
    Subscriptions.find().forEach(function(subscriptionRecord){
        console.log("Subscribing to " + collectionName + " DDP cursor.");
        Meteor.subscribe(get(subscriptionRecord, 'channel.endpoint'));
    });
  }
}

Meteor.startup(function(){

    console.log("Checking on Subscriptions...");

    if(Meteor.isServer){  
        if(get(Meteor, 'settings.private.fhir.autoGenerateSubscriptions')){
            console.log('Vault server initializing collections');
      
            Object.keys(Collections).forEach(function(collectionName){
                  let newSubscription = {
                      "resourceType": "Subscription",
                      "status": "active",
                      "criteria": "{}",
                      "channel": {
                          "type": "websocket",
                          "endpoint": collectionName
                      }
                  }
      
                  if(!Subscriptions.findOne({'channel.endpoint': collectionName})){
                      Subscriptions.insert(newSubscription);
                  }
            })
        };

        Subscriptions.after.insert(function (userId, newSubscription) {

            process.env.DEBUG && console.log("---------------------------------------------------")
            process.env.DEBUG && console.log('Subscriptions.after.insert ')
            process.env.TRACE && console.log(newSubscription)
            process.env.TRACE && console.log("")

            let collectionName = get(newSubscription, 'channel.')

            // ********** if websockets **********
            if(get(newSubscription, 'channel.type') === "websocket"){
                let subscriptionEndpoint = get(newSubscription, 'channel.endpoint');
                if(Collections[subscriptionEndpoint]){
                    Meteor.publish(subscriptionEndpoint, function(){
                        process.env.DEBUG && console.log('>>>>>> this.userId: ' + this.userId)               
                        if(this.userId){
                            defaultOptions.fields = {}
                        }         
                        return Collections[subscriptionEndpoint].find(defaultQuery, defaultOptions);
                    });        
                        
                }
            }

            // ********** if REST **********
            if(get(newSubscription, 'channel.type') === "rest-hook"){
                // insert onAfter hook
                let subscriptionEndpoint = get(newSubscription, 'channel.endpoint');

                let urlComponentsArray = subscriptionEndpoint.split("/");
                let resourceName = urlComponentsArray[urlComponentsArray.length - 1];

                let collectionName = FhirUtilities.pluralizeResourceName(resourceName);
                Collections[collectionName].after.insert(function (userId, doc) {

                    process.env.DEBUG && console.log("---------------------------------------------------")
                    process.env.DEBUG && console.log(collectionName + '.after.insert ')
                    process.env.DEBUG && console.log('Relay URL:  ')
                    process.env.TRACE && console.log(doc)
                    process.env.TRACE && console.log("")

                    // build URL string
                    if(doc.status === "draft"){
                        doc.status = "active";
                    }

                    let subscriptionUrl = new URL(subscriptionEndpoint); 
                    let absoluteUrl = new URL(Meteor.absoluteUrl());
                    
                    if(subscriptionUrl.host !== absoluteUrl.host){
                        HTTP.put(subscriptionEndpoint + "/" + get(doc, 'id'), {
                            data: doc
                        })    
                    }
                
                    return doc;
                });
                Collections[collectionName].after.update(function (userId, doc) {
                    //   // HIPAA Audit Log
                    process.env.DEBUG && console.log("---------------------------------------------------")
                    process.env.DEBUG && console.log(collectionName + '.after.update ')
                    process.env.DEBUG && console.log('Relay URL:  ')
                    process.env.TRACE && console.log(doc)
                    process.env.TRACE && console.log("")

                
                    if(doc.status === "draft"){
                        doc.status = "active";
                    }

                    let subscriptionUrl = new URL(subscriptionEndpoint); 
                    let absoluteUrl = new URL(Meteor.absoluteUrl());

                    // patch ???
                    if(subscriptionUrl.host !== absoluteUrl.host){
                        HTTP.put(subscriptionEndpoint + "/" + get(doc, 'id'), {
                            data: doc
                        })    
                    }

                    return doc;
                });
            }

            return newSubscription;
        });


    
        let defaultQuery = {};
        let defaultOptions = {
            limit: get(Meteor, 'settings.private.fhir.publicationLimit', 1000)
        }
        if(get(Meteor, 'settings.private.enableAccessRestrictions')){
            defaultOptions.fields = {
                address: 0
            };
        }
        // query the server for current subscriptions (based on userId)
        // for each resource type in list
        // publish a collection based on the specified FHIR Subscription record
        
        if(get(Meteor, 'settings.private.fhir.autopublishSubscriptions')){
            Object.keys(Collections).forEach(function(collectionName){        
                if(Collections[collectionName]){
                    console.log("Autopublishing DDP cursor for " + collectionName);
                    
                    let defaultQuery = setCollectionDefaultQuery(collectionName);

                    Meteor.publish(collectionName, function(){
                        process.env.DEBUG && console.log('>>>>>> this.userId: ' + this.userId)               
                        if(this.userId){
                            defaultOptions.fields = {}
                        }         
                        return Collections[collectionName].find(defaultQuery, defaultOptions);
                    });        
                    
                } else {
                    console.log(collectionName + " not found.")
                }
            });     
        } else {
            console.log("Publications count: " + Subscriptions.find().count())
            Subscriptions.find().forEach(function(subscriptionRecord){


                // ********** if websockets **********
                if(get(subscriptionRecord, 'channel.type') === "websocket"){
                    let collectionName = get(subscriptionRecord, 'channel.endpoint');
                    if(Collections[collectionName]){
                        console.log("Publishing DDP cursor for " + collectionName + " subscription.");

                        let defaultQuery = setCollectionDefaultQuery(collectionName, subscriptionRecord);
                        console.log('defaultQuery', defaultQuery)

                        Meteor.publish(collectionName, function(){
                            process.env.DEBUG && console.log('>>>>>> Meteor.publish: ' + collectionName);               
                            process.env.DEBUG && console.log('>>>>>> this.userId:    ' + this.userId);

                            if(this.userId){
                                defaultOptions.fields = {}
                            }         
   
                            return Collections[collectionName].find(defaultQuery, defaultOptions);
                        });        
                    }
                }


                // ********** if REST **********
                if(get(subscriptionRecord, 'channel.type') === "rest-hook"){

                    // insert onAfter hook
                    let subscriptionEndpoint = get(subscriptionRecord, 'channel.endpoint');

                    let urlComponentsArray = subscriptionEndpoint.split("/");
                    let resourceName = urlComponentsArray[urlComponentsArray.length - 1];

                    let collectionName = FhirUtilities.pluralizeResourceName(resourceName);

                    if(Collections[collectionName]){
                        // insert onAfter hook
                        Collections[collectionName].after.insert(function (userId, doc) {

                            process.env.DEBUG && console.log("---------------------------------------------------")
                            process.env.DEBUG && console.log(collectionName + '.after.insert ')
                            process.env.DEBUG && console.log('Relay URL:  ' + subscriptionEndpoint)
                            process.env.TRACE && console.log(doc)
                            process.env.TRACE && console.log("")

                            // build URL string
                            if(doc.status === "draft"){
                                doc.status = "active";
                            }

                            let subscriptionUrl = new URL(subscriptionEndpoint); 
                            let absoluteUrl = new URL(Meteor.absoluteUrl());

                            if(subscriptionUrl.host !== absoluteUrl.host){
                                let relayEndpoint = subscriptionEndpoint + "/" + get(doc, 'id')
                                process.env.DEBUG && console.log('Relay Endpoint:  ' + relayEndpoint)

                                let httpHeaders = { "headers": {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*',
                                }};

                                if(get(Meteor, 'settings.private.fhir.backendServices.basicAuthToken')){
                                    httpHeaders["Authorization"] = "Basic " + base64url.encode(get(Meteor, 'settings.private.fhir.backendServices.basicAuthToken')) + "==";
                                } else {
                        
                                    // TODO:  add OAuthClients SMART on FHIR connectivity
                        
                                    // TODO:  add JWT access
                        
                                    // TODO:  add UDAP connection
                                }
                                process.env.DEBUG && console.log('httpHeaders', httpHeaders);


                                HTTP.put(relayEndpoint, {
                                    headers: httpHeaders,
                                    data: doc
                                }, function(error, result){
                                    if(error){console.log('error', error)}
                                    if(result){console.log('result', result)}
                                })    
                            }              
                        
                            return doc;
                        });
                        Collections[collectionName].after.update(function (userId, doc) {
                            //   // HIPAA Audit Log
                            process.env.DEBUG && console.log("---------------------------------------------------")
                            process.env.DEBUG && console.log(collectionName + '.after.update ')
                            process.env.DEBUG && console.log('Relay URL:  ' + subscriptionEndpoint)
                            process.env.TRACE && console.log(doc)
                            process.env.TRACE && console.log("")

                        
                            if(doc.status === "draft"){
                                doc.status = "active";
                            }

                            let subscriptionUrl = new URL(subscriptionEndpoint); 
                            let absoluteUrl = new URL(Meteor.absoluteUrl());

                            if(subscriptionUrl.host !== absoluteUrl.host){
                                HTTP.put(subscriptionEndpoint + "/" + get(doc, 'id'), {
                                    data: doc
                                }, function(error, result){
                                    if(error){console.log('error', error)}
                                    if(result){console.log('result', result)}
                                })    
                            }               
                        
                            return doc;
                        });
                    } 
                }
            });

        }  
    
    }
})