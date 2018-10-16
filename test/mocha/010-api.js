/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brLedgerNode = require('bedrock-ledger-node');
const dids = require('did-io');
const es = require('veres-one-consensus-continuity-elector-selection');
const {expect} = global.chai;
const helpers = require('./helpers');
const mockData = require('./mock-data');
const uuid = require('uuid/v4');

let ledgerNode;
describe('Elector Selection APIs', () => {
  let electorPoolDocument;
  before(async () => {
    const v1 = dids.methods.veres();
    const {doc: electorDidDocument} = await v1.generate();
    const {id: electorDid} = electorDidDocument;
    const electorServiceId = `urn:uuid:${uuid()}`;
    electorDidDocument.service = [{
      id: electorServiceId,
      type: 'Continuity2017Peer',
      serviceEndpoint: mockData.endpoint.alpha,
    }];

    const ledgerConfiguration = mockData.ledgerConfiguration.beta;
    electorPoolDocument = mockData.electorPoolDocument.alpha;
    electorPoolDocument.electorPool[0].elector = electorDid;
    electorPoolDocument.electorPool[0].service = electorServiceId;
    try {
      // setup a new ledger
      ledgerNode = await brLedgerNode.add(null, {ledgerConfiguration});

      // add a DID document for a mock elector and wait for it to reach
      // consensus, this allows for the possibility of the veres-one
      // operation validator to check for the existence of elector
      // DID documents when the electorPool document is added in the next step
      await ledgerNode.operations.add(
        {operation: helpers.wrap({didDocument: electorDidDocument})});
      // wait for the new operation to reach consensus
      await helpers.sleep(3000);

      // add an electorPool Document
      await ledgerNode.operations.add(
        {operation: helpers.wrap({didDocument: electorPoolDocument})});
      // wait for the new operation to reach consensus
      await helpers.sleep(3000);
    } catch(err) {
      assertNoError(err);
    }
  });
  describe('_getElectorPoolElectors API', () => {
    it('returns null if electorPool is not defined', async () => {
      const ledgerConfiguration = mockData.ledgerConfiguration.alpha;
      const r = await es._getElectorPoolElectors(
        {ledgerConfiguration, ledgerNode});
      expect(r).to.be.null;
    });
    it('extracts one elector from an electorPool document', async () => {
      const ledgerConfiguration = mockData.ledgerConfiguration.beta;
      const r = await es._getElectorPoolElectors(
        {ledgerConfiguration, ledgerNode});
      // console.log(r, electorPoolDocument.electorPool.map(e => e.elector));
      Object.keys(r).should.have.same.members(
        electorPoolDocument.electorPool.map(e => e.elector));
      Object.values(r).map(e => e.id).should.have.same.members([
        mockData.endpoint.alpha
      ]);
    });
  });
});
