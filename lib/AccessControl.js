
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


Object.keys(Collections).forEach(function(collectionName){

    Collections[collectionName].allow({
        insert(userId, doc) {
            // // The user must be logged in and the document must be owned by the user.
            // return userId && doc.owner === userId;

            // // The user must be logged in.
            return userId;
        },
    
        update(userId, doc, fields, modifier) {
            // // Can only change your own documents.
            // return doc.owner === userId;

            // Must be logged in
            return userId;
        },
    
        remove(userId, doc) {
            // // Can only remove your own documents.
            // return doc.owner === userId;

            // Must be logged in
            return userId;
        },
    
        fetch: ['owner']
    });
    
    Collections[collectionName].deny({
        update(userId, doc, fields, modifier) {
            // // Can't change owners.
            // return _.contains(fields, 'owner');

            // Must be logged in
            return userId;
        },
    
        remove(userId, doc) {
            // Can't remove locked documents.
            return doc.locked;
        },

        fetch: ['locked'] // No need to fetch `owner`
    });
    
});


