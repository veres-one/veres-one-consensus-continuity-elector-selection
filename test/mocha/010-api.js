/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const es = require('veres-one-consensus-continuity-elector-selection');
const {expect} = global.chai;
const helpers = require('./helpers');
const mockData = require('./mock-data');

let ledgerNode;
let electorPoolDocument;
describe('Elector Selection APIs', () => {
  describe('_getElectorPoolElectors API', () => {
    it('returns null if electorPool is not defined', async () => {
      const ledgerConfiguration = mockData.ledgerConfiguration.alpha;
      const r = await es._getElectorPoolElectors(
        {ledgerConfiguration, ledgerNode});
      expect(r).to.be.null;
    });
    it('extracts one elector from an electorPool document', async function() {
      this.timeout(30000);
      const electorCount = 1;
      try {
        const r = await helpers.initializeLedger({electorCount, mockData});
        ledgerNode = r.ledgerNode;
        electorPoolDocument = r.electorPoolDocument;
      } catch(err) {
        assertNoError(err);
      }
      const ledgerConfiguration = mockData.ledgerConfiguration.beta;
      const r = await es._getElectorPoolElectors(
        {ledgerConfiguration, ledgerNode});
      Object.keys(r).should.have.same.members(
        electorPoolDocument.electorPool.map(e => e.elector));
      Object.values(r).map(e => e.id).should.have.same.members(
        mockData.endpoint.slice(0, electorCount));
    });
    it('extracts three elector from an electorPool document', async function() {
      this.timeout(30000);
      const electorCount = 3;
      try {
        const r = await helpers.initializeLedger({electorCount, mockData});
        ledgerNode = r.ledgerNode;
        electorPoolDocument = r.electorPoolDocument;
      } catch(err) {
        assertNoError(err);
      }
      const ledgerConfiguration = mockData.ledgerConfiguration.beta;
      const r = await es._getElectorPoolElectors(
        {ledgerConfiguration, ledgerNode});
      Object.values(r).map(e => e.id).should.have.same.members(
        mockData.endpoint.slice(0, electorCount));
    });
  });
});
