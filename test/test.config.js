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

// tune consensus to work within the test framework
config['ledger-consensus-continuity'].writer.debounce = 250;
config['ledger-consensus-continuity'].worker.session.maxTime = 6000;
