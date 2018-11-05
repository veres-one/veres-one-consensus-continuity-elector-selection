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

  // TODO: simply count consensus event signers once and proof signers
  //   twice for now -- add comprehensive elector selection and
  //   recommended elector vote aggregating algorithm in v2
  const aggregate = {};
  // add merge event peers
  for(const id of mergeEventPeers) {
    aggregate[id] = {id, weight: 1};
  }

  // add peers from the electorPool
  for(const elector of electorPoolElectors) {
    const electorType = [].concat(elector.type);
    // electors defined in *any* way in the elector pool document should
    // have the greatest weight
    // FIXME: weight these like this?
    // FIXME: is type === Continuity2017Peer a real thing?  If so, what do we
    // do for that.
    let weight = 100;
    let recoveryElector = false;
    if(electorType.includes(ELECTOR_TYPE_RECOVERY)) {
      weight += 100;
      recoveryElector = true;
    }
    if(electorType.includes(ELECTOR_TYPE_GUARANTOR)) {
      weight += 100;
    }
    aggregate[elector.id] = {id: elector.id, recoveryElector, weight};
  }

  let electors = Object.values(aggregate);

  let electorCount;
  // the electorPool document may not be defined yet
  if(electorPoolElectors.length > 0) {
    // FIXME: `electorCount` in the ledgerConfiguration is used to specify a
    // *maximum* number of electors correct?
    // Therefore, electorCount is a maxiumum, so why would
    // `electorPoolElectors.length` be considered a maximum?
    electorCount = Math.min(
      ledgerConfiguration.electorSelectionMethod.electorCount,
      electorPoolElectors.length);
  } else {
    electorCount = ledgerConfiguration.electorSelectionMethod.electorCount;
  }

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

  // filter out unwanted properties
  electors = electors.map(
    e => ({id: e.id, recoveryElector: e.recoveryElector}));

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
  const recoveryElectors = electors.filter(e => e.recoveryElector === true);
  // FIXME: recoveryElectorCount = f+1
  // how should the size of `recoveryElectors` array be adjusted?
  return recoveryElectors;
};
