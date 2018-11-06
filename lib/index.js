/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const brLedgerNode = require('bedrock-ledger-node');
const brLedgerUtils = require('bedrock-ledger-utils');
const logger = require('./logger');
const xor = require('buffer-xor');
require('bedrock-veres-one-context');

// module API
const api = {};
module.exports = api;

const ELECTOR_TYPE_REGULAR = 'Continuity2017Elector';
const ELECTOR_TYPE_RECOVERY = 'Continuity2017RecoveryElector';
const ELECTOR_TYPE_GUARANTOR = 'Continuity2017GuarantorElector';

// specify the consensus plugin(s) that work with this elector selection method
api.consensusMethod = 'Continuity2017';

api.type = 'VeresOne';

// register this ledger plugin
bedrock.events.on('bedrock.start', () => brLedgerNode.use(
  'VeresOne', {api, type: 'electorSelection'}));

api.getBlockElectors = async ({
  ledgerNode, ledgerConfiguration, latestBlockSummary, blockHeight,
  recoveryMode = false
}) => {
  // TODO: a cache may be added here to prevent running
  // `_getElectorPoolElectors` when recoveryMode switches from false to true.
  // There is already a cache in Continuity that prevents the `getBlockElectors`
  // API from being called more than once with the same `blockHeight` and
  // `recoverMode` values. Since recoveryMode should be rare, a cache may
  // be unncessary
  const electorPoolElectors = Object.values(
    await brLedgerUtils.getElectorPoolElectors(
      {ledgerConfiguration, ledgerNode}));

  let {electors, recoveryElectors} = await api._computeElectors({
    blockHeight, electorPoolElectors, latestBlockSummary, ledgerConfiguration,
    ledgerNode
  });

  let recoveryGenerationThreshold;

  if(recoveryMode) {
    electors = api._computeElectorsForRecoveryMode(
      {blockHeight, electors, recoveryElectors});
    recoveryElectors = [];
  } else if(electors.length > 1) {

    // FIXME: This should be variable, not a fixed number.
    // Not sure what to use yet.  I would start looking into minimum number
    // of merge events required to reach consensus as a start (12f+6) or
    // something like that... and choose something larger.

    // const minimumMergeEvents = api._computeRecoveryMinimumMergeEvents({f});
    const minimumMergeEvents = 20;
    // allow up to 10x inefficiency before trying to recover
    recoveryGenerationThreshold = minimumMergeEvents * 10;
  }

  logger.verbose(
    'Selected Electors:',
    {ledgerNode: ledgerNode.id, blockHeight, electors, recoveryElectors});

  return {
    // number of electors, must be 3f+1 (or 1 for dictator model), safe
    // for up to `f` byzantine failures
    electors,
    // optional `f+1` "trusted" electors that must not fail and can handle
    // catastrophic case where remaining `2f` electors cannot communicate
    // (recovery electors are not a failsafe against a coordinated byzantine
    // attack as the byzantine electors could collude to show different sides
    // of a fork, but safe against network failures preventing consensus)
    recoveryElectors,
    // number of generations of merge events where no new electors participate
    // and fewer than 2f+1 total electors (including self) participate causing
    // recovery mode to trigger because consensus cannot be reached
    recoveryGenerationThreshold,
  };
};

// it is useful to override this function in tests
api._computeElectors = async ({
  blockHeight, electorPoolElectors, latestBlockSummary, ledgerConfiguration,
  ledgerNode
}) => {
  // get partipicants for the last block
  const {_blocks} = ledgerNode.consensus;
  const {consensusProofPeers, mergeEventPeers} = await _blocks.getParticipants(
    {blockHeight: blockHeight - 1, ledgerNode});

  // TODO: we should be able to easily remove previously detected
  // byzantine nodes (e.g. those that forked at least) from the electors

  // the genesis node functions as a dictator until the electorPool document
  // is established
  if(electorPoolElectors.length === 0) {
    return {electors: [{id: consensusProofPeers[0]}], recoveryElectors: []};
  }

  const {blockHash} = latestBlockSummary.eventBlock.meta;
  const baseHashBuffer = Buffer.from(blockHash);
  // the hash of the previous block is combined with the elector id to
  // prevent any elector from *always* being sorted to the top
  electorPoolElectors.sort((a, b) => {
    // generate and cache hashes
    a._hashBuffer = a._hashBuffer || xor(baseHashBuffer, Buffer.from(a.id));
    b._hashBuffer = b._hashBuffer || xor(baseHashBuffer, Buffer.from(b.id));

    // sort by hash
    return Buffer.compare(a._hashBuffer, b._hashBuffer);
  });

  // TODO: allow the electorPool document to specify an electorCount. Use the
  // value from the electorPool document first if available and if absent,
  // use the value specified in the ledgerConfiguration.

  let electorCount = Math.min(
    ledgerConfiguration.electorSelectionMethod.electorCount,
    electorPoolElectors.length);

  // adjust electorCount to the form 3f+1
  electorCount = _computeTargetElectorCount(
    {coefficient: 3, originalCount: electorCount});

  const recoveryElectorCount = _computeTargetElectorCount(
    {coefficient: 1, originalCount: electorCount});

  const electors = [];
  const recoveryElectors = [];
  const recoveryElectorCandidates = [];
  const guarantorElectorCandidates = [];
  const regularElectorCandidates = [];

  // sort electorPoolElectors into categories based on elector.type
  let i = electorPoolElectors.length;
  while(i--) {
    const elector = electorPoolElectors.pop();
    const electorType = [].concat(elector.type);
    if(electorType.includes(ELECTOR_TYPE_RECOVERY)) {
      recoveryElectorCandidates.push(elector);
    } else if(electorType.includes(ELECTOR_TYPE_GUARANTOR)) {
      guarantorElectorCandidates.push(elector);
    } else if(electorType.includes(ELECTOR_TYPE_REGULAR)) {
      regularElectorCandidates.push(elector);
    }
  }

  // populate electors and recoveryElectors
  // populate electors by:
  //   1. use all recoveryElectorCandidates
  //   2. use all guarantorElectorCandidates
  //   3. use regularElectorCandidates to fill remaining spots
  while(electors.length < electorCount) {
    let elector;
    let recoveryElectorCandidate = false;
    if(recoveryElectorCandidates.length > 0) {
      elector = recoveryElectorCandidates.pop();
      recoveryElectorCandidate = true;
    } else if(guarantorElectorCandidates.length > 0) {
      elector = guarantorElectorCandidates.pop();
    } else if(regularElectorCandidates.length > 0) {
      // TODO: possibly prefer cadidates in this class that are participating?
      elector = regularElectorCandidates.pop();
    }
    electors.push({id: elector.id});

    if(recoveryElectors.length === recoveryElectorCount) {
      // recoveryElectors is already populated
      continue;
    }
    if(!recoveryElectorCandidate) {
      // FIXME: throw a proper error
      throw new Error(
        'There are not enough recovery electors in the elector pool.');
    }
    recoveryElectors.push({id: elector.id});
  }

  return {electors, recoveryElectors};
};

// it is useful to override this function in tests
api._computeElectorsForRecoveryMode = (
  {blockHeight, electors, recoveryElectors}) => {
  // reduce electors to highest multiple of `3f + 1`, i.e.
  // `electors.length % 3 === 1` or electors < 4 ... electors MUST be a
  // multiple of `3f + 1` for BFT or 1 for trivial dictator case
  const recoveryModeElectors = bedrock.util.clone(recoveryElectors);
  while(recoveryModeElectors.length > 1 &&
    (recoveryModeElectors.length % 3 !== 1)) {
    recoveryModeElectors.pop();
  }
  return recoveryModeElectors;
};

function _computeTargetElectorCount({coefficient, originalCount}) {
  if(originalCount === 0) {
    return 0;
  }
  // compute target length
  const f = Math.ceil(originalCount / 3);
  return coefficient * (f - 1) + 1;
}
