/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const brLedgerNode = require('bedrock-ledger-node');
const brLedgerUtils = require('bedrock-ledger-utils');
const crypto = require('crypto');
const logger = require('./logger');
const xor = require('buffer-xor');
require('bedrock-veres-one-context');

// maximum number of electors if not specified in the ledger configuration
const MAX_ELECTOR_COUNT = 10;

// module API
const api = {};
module.exports = api;

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
  let electors = await api._computeElectors({
    blockHeight, electorPoolElectors, latestBlockSummary, ledgerConfiguration,
    ledgerNode
  });

  let recoveryGenerationThreshold;

  let recoveryElectors = api._computeRecoveryElectors(
    {blockHeight, electors, electorPoolElectors});

  if(recoveryMode) {
    electors = api._computeElectorsForRecoveryMode(
      {blockHeight, electors, recoveryElectors});
    recoveryElectors = [];
  } else if(electors.length > 1) {

    // FIXME: some or all of this is no longer required?

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

  // TODO: simply count consensus event signers once and proof signers
  //   twice for now -- add comprehensive elector selection and
  //   recommended elector vote aggregating algorithm in v2
  const aggregate = {};
  // add merge event peers
  for(const id of mergeEventPeers) {
    aggregate[id] = {id, weight: 1};
  }

  // TODO: weight previous electors more heavily to encourage continuity
  // add consensusProof peers
  for(const id of consensusProofPeers) {
    if(id in aggregate) {
      aggregate[id].weight = 3;
    } else {
      aggregate[id] = {id, weight: 2};
    }
  }
  // add peers from the electorPool
  for(const {id} of electorPoolElectors) {
    // FIXME: weight these like this?
    aggregate[id] = {id, weight: 4};
  }

  let electors = Object.values(aggregate);

  // get elector count, defaulting to MAX_ELECTOR_COUNT if not set
  // (hardcoded, all nodes must do the same thing -- but ideally this would
  // *always* be set)

  // FIXME: should the default `MAX_ELECTOR_COUNT` be removed given the
  // requirements around recovery mode?  Specifically, *all* recovery mode mode
  // electors (whatever number) *must* be electors as well.
  // if so, the ledgerConfiguration validator must require `electorCount`
  const electorCount = ledgerConfiguration.electorCount || MAX_ELECTOR_COUNT;

  // TODO: could optimize by only sorting tied electors if helpful
  /*
  // fill positions
  let idx = -1;
  for(let i = 0; i < electorCount; ++i) {
    if(electors[i].weight > electors[i + 1].weight) {
      idx = i;
    }
  }
  // fill positions with non-tied electors
  const positions = electors.slice(0, idx + 1);
  if(positions.length < electorCount) {
    // get tied electors
    const tied = electors.filter(
      e => e.weight === electors[idx + 1].weight);
    // TODO: sort tied electors
  }
  }*/

  const {blockHash} = latestBlockSummary.eventBlock.meta;

  // break ties via sorting
  const baseHashBuffer = Buffer.from(blockHash);
  electors.sort((a, b) => {
    // 1. sort descending by weight
    if(a.weight !== b.weight) {
      // FIXME: with current weights, this prevents elector cycling
      //   if commented out, will force elector cycling, needs adjustment
      return b.weight - a.weight;
    }

    // generate and cache hashes
    // the hash of the previous block is combined with the elector id to
    // prevent any elector from *always* being sorted to the top
    a._hashBuffer = a._hashBuffer || xor(baseHashBuffer, Buffer.from(a.id));
    b._hashBuffer = b._hashBuffer || xor(baseHashBuffer, Buffer.from(b.id));

    // 2. sort by hash
    return Buffer.compare(a._hashBuffer, b._hashBuffer);
  });

  // select first `electorCount` electors
  electors = electors.slice(0, electorCount);

  // TODO: if there were no electors chosen or insufficient electors,
  // add electors from config

  // only include `id`
  electors = electors.map(e => ({id: e.id}));

  // reduce electors to highest multiple of `3f + 1`, i.e.
  // `electors.length % 3 === 1` or electors < 4 ... electors MUST be a
  // multiple of `3f + 1` for BFT or 1 for trivial dictator case
  while(electors.length > 1 && (electors.length % 3 !== 1)) {
    electors.pop();
  }

  return electors;
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

// it is useful to override this function in tests
api._computeRecoveryElectors = (
  {blockHeight, electors, electorPoolElectors}) => {
  // FIXME: if elector.type is a thing, filter by type?
  return Object.values(electorPoolElectors);
};
