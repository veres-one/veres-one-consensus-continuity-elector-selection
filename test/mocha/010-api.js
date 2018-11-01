/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const es = require('veres-one-consensus-continuity-elector-selection');
// const {expect} = global.chai;
const helpers = require('./helpers');
const mockData = require('./mock-data');

let ledgerNode;
let electorPoolDocument;
describe('Elector Selection APIs', () => {
  describe('getBlockElectors API', () => {
    describe('group a', () => {
      it('extracts one elector from an electorPool document', async function() {
        this.timeout(60000);
        const electorCount = 0;
        const embeddedServiceCount = 1;
        try {
          const r = await helpers.initializeLedger(
            {electorCount, embeddedServiceCount, mockData});
          ledgerNode = r.ledgerNode;
          electorPoolDocument = r.electorPoolDocument;
        } catch(err) {
          assertNoError(err);
        }
        const ledgerConfiguration = await ledgerNode.config.get();
        const latestBlockSummary = await ledgerNode.blocks.getLatestSummary();
        const blockHeight = latestBlockSummary.eventBlock.block.blockHeight + 1;
        const r = await es.getBlockElectors(
          {blockHeight, latestBlockSummary, ledgerConfiguration, ledgerNode});
        console.log('RRRRRRR', JSON.stringify(r, null, 2));
        should.exist(r);
        r.should.be.an('object');
        r.should.have.property('electors');
        r.should.have.property('recoveryElectors');
        const {electors, recoveryElectors} = r;
        electors.should.be.an('array');
        electors.should.have.length(1);
        // NOTE: the one elector specified in the electorPool document is sorted
        // to the top of the list above the genesisNode and only one elector
        // is returned
        electors.map(({id}) => id).should.have.same.members(
          mockData.endpoint.slice(0, 1));
        recoveryElectors.should.be.an('array');
        recoveryElectors.should.have.length(1);
        recoveryElectors.map(({id}) => id).should.have.same.members(
          mockData.endpoint.slice(0, 1));
      });
      it('extracts one elector from an electorPool document', async function() {
        this.timeout(60000);
        const embeddedServiceCount = 2;
        try {
          const r = await helpers.initializeLedger(
            {embeddedServiceCount, mockData});
          ledgerNode = r.ledgerNode;
          electorPoolDocument = r.electorPoolDocument;
        } catch(err) {
          assertNoError(err);
        }
        const ledgerConfiguration = await ledgerNode.config.get();
        const latestBlockSummary = await ledgerNode.blocks.getLatestSummary();
        const blockHeight = latestBlockSummary.eventBlock.block.blockHeight + 1;
        const r = await es.getBlockElectors(
          {blockHeight, latestBlockSummary, ledgerConfiguration, ledgerNode});
        console.log('RRRRRRR', JSON.stringify(r, null, 2));
        should.exist(r);
        r.should.be.an('object');
        r.should.have.property('electors');
        r.should.have.property('recoveryElectors');
        const {electors, recoveryElectors} = r;
        electors.should.be.an('array');
        electors.should.have.length(1);
        // NOTE: the two electors specified in the electorPool document are
        // sorted to the top of the list above the genesisNode and only one
        // elector is returned
        mockData.endpoint.slice(0, 2).should.include(
          electors.map(({id}) => id)[0]);
        recoveryElectors.should.be.an('array');
        recoveryElectors.should.have.length(2);
        recoveryElectors.map(({id}) => id).should.have.same.members(
          mockData.endpoint.slice(0, 2));
      });
    });
  });
});
