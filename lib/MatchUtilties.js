import RestHelpers from '../FhirServer/RestHelpers';
import fhirPathToMongo from '../FhirServer/FhirPath';

import { get, has, set, unset, cloneDeep, capitalize, findIndex, countBy } from 'lodash';
import moment from 'moment';
import { Meteor } from 'meteor/meteor';

const BASE_PROFILE = "http://hl7.org/fhir/us/identity-matching/StructureDefinition/IDI-Patient";
const LEVEL0_PROFILE = "http://hl7.org/fhir/us/identity-matching/StructureDefinition/IDI-Patient-L0";
const LEVEL1_PROFILE = "http://hl7.org/fhir/us/identity-matching/StructureDefinition/IDI-Patient-L1";

const ERROR_CODES = {
  "invalid profile": 1,
  "profile not met": 2
};

function validateMinimumRequirement(matchParams) {
  let profileAssertion = get(matchParams, 'meta.profile[0]');
  switch (profileAssertion) {
    case BASE_PROFILE:
      let nameExists = (!!get(matchParams, 'name[0].family') && !!get(matchParams, 'name[0].given[0]'));
      let addressExists = (!!get(matchParams, 'address[0].line') && !!get(matchParams, 'address[0].city'));
      console.log("address exists?", addressExists.toString());
      if (nameExists || !!get(matchParams, 'birthDate') || !!get(matchParams, 'telecom') || addressExists || !!get(matchParams, 'identifier')){
        return 0;
      }
      break;
    case LEVEL0_PROFILE:
      if (calculateWeight(matchParams) >= 10) {
        return 0;
      }
      break;
    case LEVEL1_PROFILE:
      if (calculateWeight(matchParams) >= 20) {
        return 0;
      }
      break;
    default:
      return ERROR_CODES['invalid profile'];
  }
  return ERROR_CODES['profile not met'];
}

function calculateWeight(matchParams) {
  return 20;
}

module.exports = {
  validateMinimumRequirement
}