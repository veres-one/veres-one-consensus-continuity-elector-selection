/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
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
      try {
        const r = await helpers.initializeLedger({mockData});
        ledgerNode = r.ledgerNode;
        electorPoolDocument = r.electorPoolDocument;
      } catch(err) {
        assertNoError(err);
      }

      const ledgerConfiguration = mockData.ledgerConfiguration.beta;
      const r = await es._getElectorPoolElectors(
        {ledgerConfiguration, ledgerNode});
      // console.log(r, electorPoolDocument.electorPool.map(e => e.elector));
      Object.keys(r).should.have.same.members(
        electorPoolDocument.electorPool.map(e => e.elector));
      Object.values(r).map(e => e.id).should.have.same.members(
        mockData.endpoint.slice(0, 1));
    });
    it('extracts one elector from an electorPool document', async function() {
      this.timeout(30000);
      try {
        const r = await helpers.initializeLedger({electorCount: 2, mockData});
        ledgerNode = r.ledgerNode;
        electorPoolDocument = r.electorPoolDocument;
      } catch(err) {
        assertNoError(err);
      }

      const ledgerConfiguration = mockData.ledgerConfiguration.beta;
      const r = await es._getElectorPoolElectors(
        {ledgerConfiguration, ledgerNode});
      // console.log(r, electorPoolDocument.electorPool.map(e => e.elector));
      // Object.keys(r).should.have.same.members(
      //   electorPoolDocument.electorPool.map(e => e.elector));
      // Object.values(r).map(e => e.id).should.have.same.members([
      //   mockData.endpoint.alpha
      // ]);
      console.log('RRRRRR', r);
    });
  });
});
