/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config: {constants}} = require('bedrock');

const api = {};
module.exports = api;

api.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wrap a DID Document in a Web Ledger Operation.
 */
api.wrap = ({didDocument}) => ({
  '@context': [
    constants.WEB_LEDGER_CONTEXT_V1_URL, constants.VERES_ONE_CONTEXT_URL
  ],
  record: didDocument,
  type: 'CreateWebLedgerRecord',
});
