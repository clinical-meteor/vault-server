
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
    Tasks, 
    ValueSets,
    VerificationResults,
    ServerStats
} from 'meteor/clinical:hl7-fhir-data-infrastructure';

if(Meteor.isClient){

  if(get(Meteor, 'settings.public.fhirAutoSubscribe')){
    Meteor.subscribe('AllergyIntolerances');
    Meteor.subscribe('AuditEvents');
    Meteor.subscribe('Bundles');
    Meteor.subscribe('CarePlans');
    Meteor.subscribe('CareTeams');
    Meteor.subscribe('CodeSystems');
    Meteor.subscribe('Conditions');
    Meteor.subscribe('Consents');
    Meteor.subscribe('Devices');
    Meteor.subscribe('DocumentReferences');
    Meteor.subscribe('Encounters');
    Meteor.subscribe('Endpoints');
    Meteor.subscribe('Goals');
    Meteor.subscribe('HealthcareServices');
    Meteor.subscribe('Immunizations');
    Meteor.subscribe('InsurancePlans');
    Meteor.subscribe('Locations');
    Meteor.subscribe('Lists');
    Meteor.subscribe('Medications');
    Meteor.subscribe('Observations');
    Meteor.subscribe('Organizations');
    Meteor.subscribe('OrganizationAffiliations');
    Meteor.subscribe('Patients');
    Meteor.subscribe('Practitioners');
    Meteor.subscribe('PractitionerRoles');
    Meteor.subscribe('Provenances');
    Meteor.subscribe('Procedures');
    Meteor.subscribe('Questionnaires');
    Meteor.subscribe('QuestionnaireResponses');
    Meteor.subscribe('Restrictions');      
    Meteor.subscribe('Tasks');
    Meteor.subscribe('ServerStats');
    Meteor.subscribe('SearchParameters');      
    Meteor.subscribe('StructureDefinitions');      
    Meteor.subscribe('ValueSets');      
    Meteor.subscribe('VerificationResults');      

  }
}

if(Meteor.isServer){  
  let defaultQuery = {};
  let defaultOptions = {limit: 5000}

  if(get(Meteor, 'settings.private.fhir.autopublishSubscriptions')){
    Meteor.publish('AllergyIntolerances', function(){
        return AllergyIntolerances.find(defaultQuery, defaultOptions);
    });  
    Meteor.publish('AuditEvents', function(){
        return AuditEvents.find(defaultQuery, defaultOptions);
    });  
    Meteor.publish('Bundles', function(){
        return Bundles.find(defaultQuery, defaultOptions);
    });  
    Meteor.publish('CarePlans', function(){
        return CarePlans.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('CareTeams', function(){
        return CareTeams.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('CodeSystems', function(){
        return CodeSystems.find(defaultQuery, defaultOptions);
    });  
    Meteor.publish('Conditions', function(){
        return Conditions.find(defaultQuery, defaultOptions);
    });  
    Meteor.publish('Consents', function(){
        return Consents.find(defaultQuery, defaultOptions);
    });  
    Meteor.publish('Communications', function(){
        return Communications.find(defaultQuery, defaultOptions);
    });  
    Meteor.publish('CommunicationRequests', function(){
        return CommunicationRequests.find(defaultQuery, defaultOptions);
    });  
    Meteor.publish('Devices', function(){
        return Devices.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('DocumentReferences', function(){
        return DocumentReferences.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('Encounters', function(){
        return Encounters.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('Endpoints', function(){
        return Endpoints.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('Goals', function(){
        return Goals.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('HealthcareServices', function(){
        return HealthcareServices.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('Immunizations', function(){
        return Immunizations.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('InsurancePlans', function(){
        return InsurancePlans.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('Lists', function(){
        return Lists.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('Locations', function(){
        return Locations.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('Medications', function(){
        return Medications.find(defaultQuery, defaultOptions);
    }); 
    Meteor.publish('Networks', function(){
        return Networks.find(defaultQuery, defaultOptions);
    }); 
    Meteor.publish('Observations', function(){
        return Observations.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('Organizations', function(){
        return Organizations.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('OrganizationAffiliations', function(){
        return OrganizationAffiliations.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('Patients', function(){
        return Patients.find(defaultQuery, defaultOptions);
    });   
    Meteor.publish('Practitioners', function(){
        return Practitioners.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('PractitionerRoles', function(){
        return PractitionerRoles.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('Procedures', function(){
        return Procedures.find(defaultQuery, defaultOptions);
    }); 
    Meteor.publish('Provenances', function(){
        return Provenances.find(defaultQuery, defaultOptions);
    });   
    Meteor.publish('Questionnaires', function(){
        return Questionnaires.find(defaultQuery, defaultOptions);
    });   
    Meteor.publish('QuestionnaireResponses', function(){
        return QuestionnaireResponses.find(defaultQuery, defaultOptions);
    });   
    Meteor.publish('Restrictions', function(){
        return Restrictions.find(defaultQuery, defaultOptions);
    });   
    Meteor.publish('Tasks', function(){
        return Tasks.find(defaultQuery, defaultOptions);
    });   
    Meteor.publish('ServerStats', function(){
        return ServerStats.find(defaultQuery, defaultOptions);
    });   
    Meteor.publish('SearchParameters', function(){
        return SearchParameters.find(defaultQuery, defaultOptions);
    });   
    Meteor.publish('StructureDefinitions', function(){
        return StructureDefinitions.find(defaultQuery, defaultOptions);
    });   
    Meteor.publish('ValueSets', function(){
        return ValueSets.find(defaultQuery, defaultOptions);
    });    
    Meteor.publish('VerificationResults', function(){
        return VerificationResults.find(defaultQuery, defaultOptions);
    });    
  };
}