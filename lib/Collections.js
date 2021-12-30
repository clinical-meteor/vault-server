
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
  if(get(Meteor, 'settings.private.fhir.autopublishSubscriptions')){
    Meteor.publish('AllergyIntolerances', function(){
        return AllergyIntolerances.find();
    });  
    Meteor.publish('AuditEvents', function(){
        return AuditEvents.find();
    });  
    Meteor.publish('Bundles', function(){
        return Bundles.find();
    });  
    Meteor.publish('CarePlans', function(){
        return CarePlans.find();
    });    
    Meteor.publish('CareTeams', function(){
        return CareTeams.find();
    });    
    Meteor.publish('CodeSystems', function(){
        return CodeSystems.find();
    });  
    Meteor.publish('Conditions', function(){
        return Conditions.find();
    });  
    Meteor.publish('Consents', function(){
        return Consents.find();
    });  
    Meteor.publish('Communications', function(){
        return Communications.find();
    });  
    Meteor.publish('CommunicationRequests', function(){
        return CommunicationRequests.find();
    });  
    Meteor.publish('Devices', function(){
        return Devices.find();
    });    
    Meteor.publish('DocumentReferences', function(){
        return DocumentReferences.find();
    });    
    Meteor.publish('Encounters', function(){
        return Encounters.find();
    });    
    Meteor.publish('Endpoints', function(){
        return Endpoints.find();
    });    
    Meteor.publish('Goals', function(){
        return Goals.find();
    });    
    Meteor.publish('HealthcareServices', function(){
        return HealthcareServices.find();
    });    
    Meteor.publish('Immunizations', function(){
        return Immunizations.find();
    });    
    Meteor.publish('InsurancePlans', function(){
        return InsurancePlans.find();
    });    
    Meteor.publish('Lists', function(){
        return Lists.find();
    });    
    Meteor.publish('Locations', function(){
        return Locations.find();
    });    
    Meteor.publish('Medications', function(){
        return Medications.find();
    }); 
    Meteor.publish('Networks', function(){
        return Networks.find();
    }); 
    Meteor.publish('Observations', function(){
        return Observations.find();
    });    
    Meteor.publish('Organizations', function(){
        return Organizations.find();
    });    
    Meteor.publish('OrganizationAffiliations', function(){
        return OrganizationAffiliations.find();
    });    
    Meteor.publish('Patients', function(){
        return Patients.find();
    });   
    Meteor.publish('Practitioners', function(){
        return Practitioners.find();
    });    
    Meteor.publish('PractitionerRoles', function(){
        return PractitionerRoles.find();
    });    
    Meteor.publish('Procedures', function(){
        return Procedures.find();
    }); 
    Meteor.publish('Provenances', function(){
        return Provenances.find();
    });   
    Meteor.publish('Questionnaires', function(){
        return Questionnaires.find();
    });   
    Meteor.publish('QuestionnaireResponses', function(){
        return QuestionnaireResponses.find();
    });   
    Meteor.publish('Restrictions', function(){
        return Restrictions.find();
    });   
    Meteor.publish('Tasks', function(){
        return Tasks.find();
    });   
    Meteor.publish('ServerStats', function(){
        return ServerStats.find();
    });   
    Meteor.publish('SearchParameters', function(){
        return SearchParameters.find();
    });   
    Meteor.publish('StructureDefinitions', function(){
        return StructureDefinitions.find();
    });   
    Meteor.publish('ValueSets', function(){
        return ValueSets.find();
    });    
    Meteor.publish('VerificationResults', function(){
        return VerificationResults.find();
    });    
  };
}