
import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';

import moment from 'moment';
import { get } from 'lodash';

import SimpleSchema from 'simpl-schema';
import { BaseSchema, DomainResourceSchema } from 'meteor/clinical:hl7-resource-datatypes';

OAuthClients = new Mongo.Collection('OAuthClients');

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
    SearchParamenters, 
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
        "InsurancePlan",
        "Locations ",
        "Medications",
        "Network",
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
        "SearchParamenters",
        "StructureDefinitions",
        "Subscription",
        "Tasks",
        "ValueSet",
        "VerificationResult"
    ];

let Collections = {};

if(Meteor.isClient){
  Collections = window;
}
if(Meteor.isServer){
    Collections.AllergyIntolerances = AllergyIntolerances;
    Collections.AuditEvents = AuditEvents;
    Collections.Bundles = Bundles;
    Collections.CodeSystems = CodeSystems;
    Collections.Conditions = Conditions;
    Collections.Consents = Consents;
    Collections.Communications = Communications;
    Collections.CommunicationRequests = CommunicationRequests;
    Collections.CarePlans = CarePlans;
    Collections.CareTeams = CareTeams;
    Collections.Devices = Devices;
    Collections.DocumentReferences = DocumentReferences;
    Collections.Encounters = Encounters;
    Collections.Endpoints = Endpoints;
    Collections.HealthcareServices = HealthcareServices;
    Collections.Immunizations = Immunizations;
    Collections.InsurancePlans = InsurancePlan;
    Collections.Locations = Locations ;
    Collections.Medications = Medications;
    Collections.Networks = Network;
    Collections.Observations = Observations;
    Collections.Organizations = Organizations;
    Collections.OrganizationAffiliations = OrganizationAffiliations;
    Collections.Patients = Patients;
    Collections.Practitioners = Practitioners;
    Collections.PractitionerRoles = PractitionerRoles;
    Collections.Procedures = Procedures;
    Collections.Provenances = Provenances;
    Collections.Questionnaires = Questionnaires;
    Collections.QuestionnaireResponses = QuestionnaireResponses;
    Collections.SearchParamenters = SearchParamenters;
    Collections.StructureDefinitions = StructureDefinitions;
    Collections.Subscriptions = Subscription;
    Collections.Tasks = Tasks;
    Collections.ValueSets = ValueSet;
    Collections.VerificationResults = VerificationResult;
}


if(Meteor.isClient){

  if(get(Meteor, 'settings.public.fhirAutoSubscribe')){

    Object.keys(Collections).forEach(function(collectionName){
        Meteor.subscribe(collectionName);
    });
  } else {
    // query the server for current subscriptions (based on userId)
    // for each resource type in list
    // subscribe to a DDS pubsub based on the FHIR Subscription record

    console.log("Subscriptions count: " + Subscriptions.find().count())
    Subscriptions.find().forEach(function(subscriptionRecord){
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
        let defaultOptions = {limit: 5000}
        
        // query the server for current subscriptions (based on userId)
        // for each resource type in list
        // publish a collection based on the specified FHIR Subscription record
        
        if(get(Meteor, 'settings.private.fhir.autopublishSubscriptions')){
            Object.keys(Collections).forEach(function(collectionName){        
                if(Collections[collectionName]){
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
                    Meteor.publish(collectionName, function(){
                        return Collections[collectionName].find(defaultQuery, defaultOptions);
                    });    
                } else {
                    console.log(collectionName + " not found.")
                }
            });
        }  
    
    }
})