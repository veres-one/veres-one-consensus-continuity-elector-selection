/*!
 * Copyright (c) 2018-2020 Digital Bazaar, Inc. All rights reserved.
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
    describe('Normal operation', () => {
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
        // the one guarantor should be the chosen elector
        electors.every(({id}) => mockData.endpoint.slice(0, 1).includes(id))
          .should.be.true;
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
        electors.every(({id}) => mockData.endpoint.slice(0, 4).includes(id))
          .should.be.true;
        recoveryElectors.should.be.an('array');
        recoveryElectors.should.have.length(2);
        // the recovery elector selected should be the same as the one elector
        recoveryElectors.every(({id}) =>
          electors.map(({id}) => id).includes(id)).should.be.true;
      });
      it('returns 7 electors w/9 in electorPool document', async function() {
        this.timeout(60000);
        const embeddedServiceCount = 9;
        const guarantorElectorCount = 7;
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
        // the electors chosen should be the seven guarantors
        electors.every(({id}) => mockData.endpoint.slice(0, 7).includes(id))
          .should.be.true;
        recoveryElectors.should.be.an('array');
        recoveryElectors.should.have.length(3);
        // the recovery elector selected should be the same as the one elector
        recoveryElectors.every(({id}) =>
          electors.map(({id}) => id).includes(id)).should.be.true;
      });
    }); // end normal operation
    describe('Recovery Mode', () => {
      it('returns 1 elector w/3 guarantor electors', async function() {
        this.timeout(60000);
        const embeddedServiceCount = 9;
        const guarantorElectorCount = 3;
        const recoveryMode = true;
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
        const r = await es.getBlockElectors({
          blockHeight, latestBlockSummary, ledgerConfiguration, ledgerNode,
          recoveryMode
        });
        should.exist(r);
        r.should.be.an('object');
        r.should.have.property('electors');
        r.should.have.property('recoveryElectors');
        const {electors, recoveryElectors} = r;
        electors.should.be.an('array');
        electors.should.have.length(1);
        // the chosen elector should be one of the three guarantors
        electors.every(({id}) => mockData.endpoint.slice(0, 3).includes(id))
          .should.be.true;
        recoveryElectors.should.be.an('array');
        recoveryElectors.should.have.length(0);
      });
      it('returns 4 electors w/4 guarantor electors', async function() {
        this.timeout(60000);
        const embeddedServiceCount = 9;
        const guarantorElectorCount = 4;
        const recoveryMode = true;
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
        const r = await es.getBlockElectors({
          blockHeight, latestBlockSummary, ledgerConfiguration, ledgerNode,
          recoveryMode
        });
        should.exist(r);
        r.should.be.an('object');
        r.should.have.property('electors');
        r.should.have.property('recoveryElectors');
        const {electors, recoveryElectors} = r;
        electors.should.be.an('array');
        electors.should.have.length(4);
        // the chosen elector should be one of the four guarantors
        electors.every(({id}) => mockData.endpoint.slice(0, 4).includes(id))
          .should.be.true;
        recoveryElectors.should.be.an('array');
        recoveryElectors.should.have.length(0);
      });
    }); // end recovery mode
  });
});
