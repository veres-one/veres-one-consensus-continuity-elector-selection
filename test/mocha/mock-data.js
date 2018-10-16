/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {config} = bedrock;
const {constants} = config;

const api = {};
module.exports = api;

const electorPoolDocument = api.electorPoolDocument = {};
electorPoolDocument.alpha = {
  // FIXME: is this correct?
  '@context': constants.VERES_ONE_CONTEXT_URL,
  // corresponds to ledgerConfiguration.beta
  id: 'urn:uuid:b3275fed-daf4-4c07-b63a-747fa8857609',
  veresOneTicketRate: 10, /* TBD */
  electorPool: [{
    id: 'urn:uuid:89a62413-0ada-461b-b672-1b28afefaca8',
    elector: 'did:v1:nym:50f28192-8f52-4bf2-a9b1-d203f6611456',
    service: 'urn:uuid:50f28192-8f52-4bf2-a9b1-d203f6611456',
    // other restrictions/capabilities like guarantor, recovery,
    // or ocap w/ticket caveat
    capability: [{
      id: '<id of ocap, e.g. on Veres One, a `did:v1:uuid`>',
      caveat: [{
        type: 'VeresOneElectorTicketAgent' /* TBD */
      }]
    }]
  }]
};

const endpoint = api.endpoint = {};

endpoint.alpha = 'https://example.com/consensus/continuity2017/voters/' +
  'z6MkpuVHNa8Vv9UDKKnkBs5XHapY4f1faKKtH1v7YDQ93KRJ';
endpoint.beta = 'https://example.com/consensus/continuity2017/voters/' +
  'z6MkwTs4RvbreqWT9xUF85WCTD4D8zq2P1vzg4inFj72R734';

const ledgerConfiguration = api.ledgerConfiguration = {};
// no electorPool defined
ledgerConfiguration.alpha = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'WebLedgerConfiguration',
  ledger: 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59',
  consensusMethod: 'Continuity2017',
  electorSelectionMethod: {
    type: 'VeresOne',
  },
};

ledgerConfiguration.beta = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'WebLedgerConfiguration',
  ledger: 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59',
  consensusMethod: 'Continuity2017',
  electorSelectionMethod: {
    type: 'VeresOne',
    // corresponds to electorPoolDocument.alpha
    electorPool: 'urn:uuid:b3275fed-daf4-4c07-b63a-747fa8857609',
  },
  operationValidator: [{
    type: 'VeresOneValidator2017',
    validatorFilter: [{
      type: 'ValidatorFilterByType',
      validatorFilterByType: ['CreateWebLedgerRecord']
    }]
  }]
};
