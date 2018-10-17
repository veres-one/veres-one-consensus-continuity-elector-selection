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

// ms to wait for consensus after adding an operation
const consensusWaitTime = 3000;

let ledgerNode;
describe('Elector Selection APIs', () => {
  let electorPoolDocument;
  before(async function() {
    this.timeout(30000);

    const v1 = dids.methods.veres();

    const maintainerDidDocumentFull = await v1.generate();
    const {doc: maintainerDidDocument} = maintainerDidDocumentFull;
    const {id: maintainerDid} = maintainerDidDocument;
    const electorDidDocumentFull = await v1.generate();
    const {doc: electorDidDocument} = electorDidDocumentFull;
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
    electorPoolDocument.electorPool[0].capability[0].id = maintainerDid;
    electorPoolDocument.invoker = maintainerDid;
    try {
      // setup a new ledger
      ledgerNode = await brLedgerNode.add(null, {ledgerConfiguration});

      // add a DID document for a mock maintainer and wait for consensus
      let operation = helpers.wrap({didDocument: maintainerDidDocument});
      operation = await v1.attachProofs(
        {operation, options: {didDocument: maintainerDidDocumentFull}});
      await ledgerNode.operations.add({operation});
      await helpers.sleep(consensusWaitTime);

      // add a DID document for a mock elector and wait for it to reach
      // consensus, this allows for the possibility of the veres-one
      // operation validator to check for the existence of elector
      // DID documents when the electorPool document is added in the next step
      operation = helpers.wrap({didDocument: electorDidDocument});
      operation = await v1.attachProofs(
        {operation, options: {didDocument: electorDidDocumentFull}});
      await ledgerNode.operations.add({operation});
      // wait for the new operation to reach consensus
      await helpers.sleep(consensusWaitTime);

      // FIXME: ledgerNode.ledger is like
      // 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59'
      // is this correct?

      // the invocationTarget is the ledger ID
      electorPoolDocument.electorPool[0].capability[0].invocationTarget =
        ledgerNode.ledger;

      operation = v1.client.wrap({didDocument: electorPoolDocument});
      const invokePublicKey = maintainerDidDocumentFull.doc
        .capabilityInvocation[0].publicKey[0];
      const creator = invokePublicKey.id;
      const {privateKey: privateKeyBase58} =
        maintainerDidDocumentFull.keys[invokePublicKey.id];

      operation = await v1.attachInvocationProof({
        algorithm: 'Ed25519Signature2018',
        operation,
        capability: maintainerDid,
        // capabilityAction: operation.type,
        capabilityAction: 'RegisterDid',
        creator,
        privateKeyBase58
      });
      operation = await v1.attachInvocationProof({
        algorithm: 'Ed25519Signature2018',
        operation,
        capability: maintainerDid,
        // capabilityAction: operation.type,
        capabilityAction: 'AuthorizeRequest',
        creator,
        privateKeyBase58
      });

      // add an electorPool Document
      await ledgerNode.operations.add({operation});
      // wait for the new operation to reach consensus
      await helpers.sleep(consensusWaitTime);
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
