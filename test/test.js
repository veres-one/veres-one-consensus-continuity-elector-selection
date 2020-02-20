/*!
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
const bedrock = require('bedrock');
require('bedrock-ledger-node');
require('bedrock-mongodb');
require('bedrock-ledger-consensus-continuity');
require('veres-one-consensus-continuity-elector-selection');
require('veres-one-validator');

// FIXME: remove if not needed
/*
bedrock.events.on('bedrock.init', () => {
  const jsonld = bedrock.jsonld;
  // const mockData = require('./mocha/mock.data');

  const oldLoader = jsonld.documentLoader;

  // load mock documents
  jsonld.documentLoader = function(url, callback) {
    if(Object.keys(mockData.ldDocuments).includes(url)) {
      return callback(null, {
        contextUrl: null,
        document: mockData.ldDocuments[url],
        documentUrl: url
      });
    }
    oldLoader(url, callback);
  };
});
*/

require('bedrock-test');
bedrock.start();
