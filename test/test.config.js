/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
const {config} = require('bedrock');
const path = require('path');

config.mocha.tests.push(path.join(__dirname, 'mocha'));

config.jsonld.strictSSL = false;

// MongoDB
config.mongodb.name = 'veres-one-cc-es_test';
config.mongodb.dropCollections.onInit = true;
config.mongodb.dropCollections.collections = [];

// enable consensus workers
config.ledger.jobs.scheduleConsensusWork.enabled = true;
