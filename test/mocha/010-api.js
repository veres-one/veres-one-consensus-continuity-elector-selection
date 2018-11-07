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
    describe('All electorPool electors are guarantors', () => {
      it('extracts one elector from an electorPool document', async function() {
        this.timeout(60000);
        const electorCount = 0;
        const embeddedServiceCount = 1;
        const guarantorElectorCount = 1;
        try {
          const r = await helpers.initializeLedger({
            electorCount, embeddedServiceCount, mockData, guarantorElectorCount
          });
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
        should.exist(r);
        r.should.be.an('object');
        r.should.have.property('electors');
        r.should.have.property('recoveryElectors');
        const {electors, recoveryElectors} = r;
        electors.should.be.an('array');
        electors.should.have.length(1);
        electors.map(({id}) => id).should.have.same.members(
          mockData.endpoint.slice(0, 1));
        recoveryElectors.should.be.an('array');
        recoveryElectors.should.have.length(1);
        recoveryElectors.map(({id}) => id).should.have.same.members(
          mockData.endpoint.slice(0, 1));
      });
      it('returns one elector w/3 in electorPool document', async function() {
        this.timeout(60000);
        const embeddedServiceCount = 3;
        const guarantorElectorCount = 1;
        try {
          const r = await helpers.initializeLedger(
            {embeddedServiceCount, mockData, guarantorElectorCount});
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
        should.exist(r);
        r.should.be.an('object');
        r.should.have.property('electors');
        r.should.have.property('recoveryElectors');
        const {electors, recoveryElectors} = r;
        electors.should.be.an('array');
        electors.should.have.length(1);
        mockData.endpoint.slice(0, 3).should.include(
          electors.map(({id}) => id)[0]);
        recoveryElectors.should.be.an('array');
        recoveryElectors.should.have.length(1);
        // the recovery elector selected should be the same as the one elector
        recoveryElectors.map(({id}) => id).should.have.same.members(
          electors.map(({id}) => id));
      });
      it('returns 4 electors w/4 in electorPool document', async function() {
        this.timeout(60000);
        const embeddedServiceCount = 4;
        const guarantorElectorCount = 2;
        try {
          const r = await helpers.initializeLedger(
            {embeddedServiceCount, mockData, guarantorElectorCount});
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
        should.exist(r);
        r.should.be.an('object');
        r.should.have.property('electors');
        r.should.have.property('recoveryElectors');
        const {electors, recoveryElectors} = r;
        electors.should.be.an('array');
        electors.should.have.length(4);
        mockData.endpoint.slice(0, 4).should.include(
          electors.map(({id}) => id)[0]);
        recoveryElectors.should.be.an('array');
        recoveryElectors.should.have.length(2);
        // the recovery elector selected should be the same as the one elector
        recoveryElectors.every(({id}) =>
          electors.map(({id}) => id).includes(id)).should.be.true;
      });
      it('returns 7 electors w/9 in electorPool document', async function() {
        this.timeout(60000);
        const embeddedServiceCount = 9;
        const guarantorElectorCount = 3;
        try {
          const r = await helpers.initializeLedger(
            {embeddedServiceCount, mockData, guarantorElectorCount});
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
        should.exist(r);
        r.should.be.an('object');
        r.should.have.property('electors');
        r.should.have.property('recoveryElectors');
        const {electors, recoveryElectors} = r;
        electors.should.be.an('array');
        electors.should.have.length(7);
        mockData.endpoint.slice(0, 7).should.include(
          electors.map(({id}) => id)[0]);
        recoveryElectors.should.be.an('array');
        recoveryElectors.should.have.length(3);
        // the recovery elector selected should be the same as the one elector
        recoveryElectors.every(({id}) =>
          electors.map(({id}) => id).includes(id)).should.be.true;
      });
    });
  });
});
