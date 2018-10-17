/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const brLedgerNode = require('bedrock-ledger-node');
const {config: {constants}} = bedrock;
const dids = require('did-io');
const uuid = require('uuid/v4');

dids.use('jsonld', bedrock.jsonld);

const api = {};
module.exports = api;

api.initializeLedger = async ({electorCount = 1, mockData}) => {
  // ms to wait for consensus after adding an operation
  const consensusWaitTime = 3000;

  const v1 = dids.methods.veres();

  const maintainerDidDocumentFull = await v1.generate();
  const {doc: maintainerDidDocument} = maintainerDidDocumentFull;
  const {id: maintainerDid} = maintainerDidDocument;

  const electors = [];
  for(let i = 0; i < electorCount; ++i) {
    const electorDidDocumentFull = await v1.generate();
    const {doc: electorDidDocument} = electorDidDocumentFull;
    const electorServiceId = `urn:uuid:${uuid()}`;
    electorDidDocument.service = [{
      id: electorServiceId,
      type: 'Continuity2017Peer',
      serviceEndpoint: mockData.endpoint[i],
    }];
    electors.push(electorDidDocumentFull);
  }

  const ledgerConfiguration = bedrock.util.clone(
    mockData.ledgerConfiguration.beta);
  const electorPoolDocument = bedrock.util.clone(
    mockData.electorPoolDocument.alpha);

  // setup a new ledger
  const ledgerNode = await brLedgerNode.add(null, {ledgerConfiguration});

  for(const elector of electors) {
    const electorDocument = bedrock.util.clone(mockData.electorDocument.alpha);
    const {id: electorDid} = elector.doc;
    const {id: electorServiceId} = elector.doc.service[0];
    electorDocument.elector = electorDid;
    electorDocument.service = electorServiceId;
    electorDocument.capability[0].id = maintainerDid;
    // the invocationTarget is the ledger ID

    // FIXME: ledger ID `ledgerNode.ledger` is currently like
    // did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59 correct?

    electorDocument.capability[0].invocationTarget = ledgerNode.ledger;
    electorPoolDocument.electorPool.push(electorDocument);
  }
  electorPoolDocument.invoker = maintainerDid;

  // add a DID document for a mock maintainer and wait for consensus
  let operation = api.wrap({didDocument: maintainerDidDocument});
  operation = await v1.attachProofs(
    {operation, options: {didDocument: maintainerDidDocumentFull}});
  await ledgerNode.operations.add({operation});
  await api.sleep(consensusWaitTime);

  // add a DID document for a mock electors and wait for it to reach
  // consensus, this allows for the possibility of the veres-one
  // operation validator to check for the existence of elector
  // DID documents when the electorPool document is added in the next step
  for(const elector of electors) {
    operation = api.wrap({didDocument: elector.doc});
    operation = await v1.attachProofs(
      {operation, options: {didDocument: elector}});
    await ledgerNode.operations.add({operation});
  }
  // wait for the new operation to reach consensus
  await api.sleep(consensusWaitTime);

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
  await api.sleep(consensusWaitTime);

  return {
    electorPoolDocument,
    ledgerNode,
  };
};

api.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wrap a DID Document in a Web Ledger Operation.
 */
api.wrap = ({didDocument}) => ({
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  record: didDocument,
  type: 'CreateWebLedgerRecord',
});
