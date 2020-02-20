/*!
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
const {config} = require('bedrock');
const path = require('path');

config.mocha.tests.push(path.join(__dirname, 'mocha'));

// MongoDB
config.mongodb.name = 'veres-one-cc-es_test';
config.mongodb.dropCollections.onInit = true;
config.mongodb.dropCollections.collections = [];

// enable consensus workers
config.ledger.jobs.scheduleConsensusWork.enabled = false;

// tune consensus to work within the test framework
config['ledger-consensus-continuity'].writer.debounce = 100;
config['ledger-consensus-continuity'].merge.fixedDebounce = 100;

// Set mode to 'test', so that DIDs are created as 'did:v1:test:...' in tests
config['veres-one-validator'].environment = 'test';
