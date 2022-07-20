import { get, has, set, unset, cloneDeep, pullAt, findIndex } from 'lodash';

import * as mongoQuery from 'mongo-query';

import { 
    AllergyIntoleranceSchema,
    AuditEventSchema,
    BundleSchema,
    CarePlanSchema,
    CareTeamSchema,
    CodeSystemSchema,
    CommunicationSchema,
    CommunicationRequestSchema,
    CompositionSchema,
    ConditionSchema,
    ConsentSchema,
    DeviceSchema,
    DiagnosticReportSchema,
    DocumentReferenceSchema,
    EncounterSchema,
    EndpointSchema,
    GoalSchema,
    HealthcareServiceSchema,
    ImmunizationSchema,
    InsurancePlanSchema,
    ListSchema,
    LocationSchema,
    MedicationSchema,
    MedicationOrderSchema,
    MeasureSchema,
    NetworkSchema,
    MeasureReportSchema,
    ObservationSchema,
    OrganizationSchema,
    OrganizationAffiliationSchema,
    PatientSchema,
    PractitionerSchema,
    PractitionerRoleSchema,
    ProcedureSchema,
    ProvenanceSchema,
    QuestionnaireSchema,
    QuestionnaireResponseSchema,
    RestrictionSchema,
    RelatedPersonSchema,
    RiskAssessmentSchema,
    SearchParameterSchema,
    ServiceRequestSchema,
    StructureDefinitionSchema,
    SubscriptionSchema,
    TaskSchema,
    ValueSetSchema,
    VerificationResultSchema
  } from 'meteor/clinical:hl7-fhir-data-infrastructure';


function parseQueryComponent(searchParameter, req, resourceType, expression){
  let queryComponent = {};

  if(!expression.includes('extension')){
    // let trimmedExpression = (expression.replace(resourceType + ".", "")).trim();
    let trimmedExpression = get(searchParameter, 'xpath');

    let isFuzzy = false;
    if(Array.isArray(searchParameter.modifier)){
      searchParameter.modifier.forEach(function(mod){
        if(mod === "contains"){
          isFuzzy = true;
        }
      })
    }
    
    if(isFuzzy){
      queryComponent[trimmedExpression] = {$regex: get(req.query, get(searchParameter, 'code')), $options: '-i'};                
    } else {
      // queryComponent[trimmedExpression] = get(req.query, get(searchParameter, 'code'));
      
      let codeComponents = (get(req.query, get(searchParameter, 'code'))).split(",");
      if(Array.isArray(codeComponents) && (codeComponents.length > 1)){
        queryComponent[trimmedExpression] = {$in: []};
        codeComponents.forEach(function(part){
          queryComponent[trimmedExpression].$in.push(part);
        });
      } else {
        queryComponent[trimmedExpression] = get(req.query, get(searchParameter, 'code'));
      }

    }
  }

  return queryComponent;
}

export function fhirPathToMongo(searchParameter, queryKey, req){
    let mongoQueryObj = {};
  
    if(typeof searchParameter === "object"){
      let resourceType = get(searchParameter, 'base.0');

      // if(get(searchParameter, 'xpath')){        
      //   mongoQueryObj[get(searchParameter, 'xpath')] = req.query[queryKey];
      // } else {
        let expresionString = get(searchParameter, 'expression');
        let expressionArray = expresionString.split('|');

        if(Array.isArray(expressionArray)){
          if(expressionArray.length === 1){
            mongoQueryObj = parseQueryComponent(searchParameter, req, resourceType, expresionString);
          } else if (expressionArray.length > 1){
            
            let componentArray = [];
            expressionArray.forEach(function(expression){
              componentArray.push(parseQueryComponent(searchParameter, req, resourceType, expression));
            })
            mongoQueryObj = {$or: componentArray }
          }
        }
      // }      
    }

    if(process.env.DEBUG){
      console.log('mongoQueryObj', mongoQueryObj)
    }
    return mongoQueryObj;
  }

  export default fhirPathToMongo;