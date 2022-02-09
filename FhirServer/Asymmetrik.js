
// import './profiles/patient.service.js';

const { initialize, loggers, constants } = require('@asymmetrik/node-fhir-server-core');
const { VERSIONS } = constants;

let config = {
  profiles: {
    patient: {
      // service: '../../../isopacks/clinical_vault-server/web.browser/FhirServer/profiles/patient.service.js',
      service: '../../programs/web.browser/app/profiles/patient.service.js',
      versions: [VERSIONS['4_0_0']]
    }
  }
};

let server = initialize(config);
let logger = loggers.get('default');

server.listen(3333, () => {
  logger.info('Starting the FHIR Server at localhost:3333');
});