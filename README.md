## Vault Server (The Free Version!)  

Welcome to the Node-On-FHIR Vault Server.  This library provides a free FHIR server, and is intended for rapid prototyping of workflows.  

#### HIPAA Compliance & Warantees

This library is for evaluation purposes only, and comes with no guarantees.  We continue to endeavored to make this library as robust as possible, but at the current time it is only HIPAA compliant if it is used entirely behind a VPN firewall.  Please note that this library does not encrypt data over the wire nor at rest, and it does not enforce user authentication or audit logs.  It does provide FHIR APIs suitable for connectathons.  


#### API  

```bash
# install the vault server module
meteor add clinical:vault-server-freemium  

# or run it with a template
meteor run --extra-packages clinical:vault-server-freemium --settings path/to/my/config/settings.json
```

#### Settings File  

You will want to modify the Meteor.settings file.

```json
{
  "private": {
    "fhir": {
      "disableOauth": true,
      "schemaValidation": {
        "filter": false,
        "validate": false
      },
      "fhirPath": "baseR4",
      "rest": {
        "AuditEvent": {
          "interactions": ["read", "create"],
          "search": true
        },
        "Condition": {
          "interactions": ["read", "create", "update"],
          "search": true
        },
        "Device": {
          "interactions": ["read", "create", "update", "delete"],
          "search": true
        },
        "Encounter": {
          "interactions": ["read", "create", "update"],
          "search": true
        },
        "Medication": {
          "interactions": ["read", "create", "update"],
          "search": true
        },
        "Observation": {
          "interactions": ["read", "create", "update"],
          "search": true
        },
        "Organization": {
          "interactions": ["read", "create", "update"],
          "search": true
        },
        "Patient": {
          "interactions": ["read", "create", "update"],
          "search": true
        },
        "Provider": {
          "interactions": ["read", "create", "update"],
          "search": true
        }
      }
    }
  }
}
```


#### License  
All Rights Reserved.  The contents of this repository are available via the Clarified Artistic License.   
https://spdx.org/licenses/ClArtistic.html  



