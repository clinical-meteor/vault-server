
import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';

import moment from 'moment';
import { get } from 'lodash';

import SimpleSchema from 'simpl-schema';
import { BaseSchema, DomainResourceSchema } from 'meteor/clinical:hl7-resource-datatypes';

// OAuthClients = new Mongo.Collection('OAuthClients');

import OAuthChannel from './OAuthClients.schema.js';
import UdapChannel from './UdapCertificates.schema.js';




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
        "Locations ",
        "Medications",
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



if(Meteor.isClient){
    // Collections = window;

  if(get(Meteor, 'settings.public.fhirAutoSubscribe')){

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

    
        let defaultQuery = {};
        let defaultOptions = {
            limit: get(Meteor, 'private.fhir.publicationLimit', 1000)
        }
        
        // query the server for current subscriptions (based on userId)
        // for each resource type in list
        // publish a collection based on the specified FHIR Subscription record
        
        if(get(Meteor, 'settings.private.fhir.autopublishSubscriptions')){
            Object.keys(Collections).forEach(function(collectionName){        
                if(Collections[collectionName]){
                    console.log("Autopublishing DDP cursor for " + collectionName);
                    Meteor.publish(collectionName, function(){
                        return Collections[collectionName].find(defaultQuery, defaultOptions);
                    });        
                } else {
                    console.log(collectionName + " not found.")
                }
            });     
        } else {
            console.log("Pub lications count: " + Subscriptions.find().count())
            Subscriptions.find().forEach(function(subscriptionRecord){
                let collectionName = get(subscriptionRecord, 'channel.endpoint');
                if(Collections[collectionName]){
                    console.log("Publishing DDP cursor for " + collectionName + " subscription.");

                    // ********** if websockets **********
                    if(get(subscriptionRecord, 'channel.type') === "websocket"){
                        Meteor.publish(collectionName, function(){
                            return Collections[collectionName].find(defaultQuery, defaultOptions);
                        });        
                    }

                    // ********** if REST **********
                    if(get(subscriptionRecord, 'channel.type') === "rest-hook"){
                        // insert onAfter hook
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
                        
                            return doc;
                        });
                    }
                } else {
                    console.log(collectionName + " not found.")
                }
            });
        }  
    
    }
})