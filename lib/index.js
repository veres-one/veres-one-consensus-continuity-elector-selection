/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const _ = require('lodash');
const bedrock = require('bedrock');
const brLedgerNode = require('bedrock-ledger-node');
const crypto = require('crypto');
const logger = require('./logger');
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
  let electors = await api._computeElectors(
    {blockHeight, latestBlockSummary, ledgerConfiguration, ledgerNode});

  let recoveryGenerationThreshold;
  let recoveryDecisionThreshold;

  // set recovery electors to be the first `f+1` of the electors
  const f = (electors.length - 1) / 3;
  let recoveryElectors = api._computeRecoveryElectors(
    {blockHeight, electors, f});

  if(recoveryMode) {
    electors = api._computeElectorsForRecoveryMode(
      {blockHeight, electors, recoveryElectors});
    recoveryElectors = [];
  } else if(electors.length > 1) {
    const minimumMergeEvents = api._computeRecoveryMinimumMergeEvents({f});
    // allow up to 10x inefficiency before trying to recover
    recoveryGenerationThreshold = minimumMergeEvents * 10;
    // require a majority of recovery electors to decide
    recoveryDecisionThreshold = Math.floor(recoveryElectors.length / 2) + 1;
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
    // number of recovery electors that must have seen a consensus decision
    // prior to triggering recovery mode in order for the decision to be
    // accepted, avoiding recovery mode; can also be thought of as the number
    // of recovery electors an attacker must take over (and if the attacker
    // can prevent the other recovery electors from communicating with the
    // non-recovery electors) to cause a fork whereby recovery mode is both
    // triggered and consensus is decided
    recoveryDecisionThreshold
  };
};

// it is useful to override this function in tests
api._computeElectors = async (
  {blockHeight, latestBlockSummary, ledgerConfiguration, ledgerNode}) => {
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
  let electors = mergeEventPeers.map(id => aggregate[id] = {id, weight: 1});

  // TODO: weight previous electors more heavily to encourage continuity
  consensusProofPeers.map(id => {
    if(id in aggregate) {
      aggregate[id].weight = 3;
    } else {
      aggregate[id] = {id, weight: 2};
    }
  });
  electors = Object.values(aggregate);

  // get elector count, defaulting to MAX_ELECTOR_COUNT if not set
  // (hardcoded, all nodes must do the same thing -- but ideally this would
  // *always* be set)
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
  electors.sort((a, b) => {
    // 1. sort descending by weight
    if(a.weight !== b.weight) {
      // FIXME: with current weights, this prevents elector cycling
      //   if commented out, will force elector cycling, needs adjustment
      return b.weight - a.weight;
    }

    // FIXME: when mixing in data, why not `xor` instead of sha-256?

    // generate and cache hashes
    // the hash of the previous block is combined with the elector id to
    // prevent any elector from *always* being sorted to the top
    a.hash = a.hash || _sha256(blockHash + _sha256(a.id));
    b.hash = b.hash || _sha256(blockHash + _sha256(b.id));

    // 2. sort by hash
    return a.hash.localeCompare(b.hash);
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
  // for this implementation, simply pick the first recovery elector
  recoveryElectors.sort((a, b) => a.id.localeCompare(b.id));
  return [recoveryElectors[0]];
};

// it is useful to override this function in tests
api._computeRecoveryElectors = ({blockHeight, electors, f}) =>
  electors.slice(0, f + 1);

// it is useful to override this function in tests
api._computeRecoveryMinimumMergeEvents = ({f}) => 12 * f + 6;

// FIXME: should this entire operation fail (as it does now) if there is an
// issue with any subset of the electors?
api._getElectorPoolElectors = async ({ledgerConfiguration, ledgerNode}) => {
  const {electorPool: electorPoolDocId} =
    ledgerConfiguration.electorSelectionMethod;
  if(!electorPoolDocId) {
    return null;
  }
  // get the electorPool document
  // FIXME: include maxBlockHeight?
  const {record: {electorPool}} = await ledgerNode.records.get(
    {recordId: electorPoolDocId});
  const electors = {};
  for(const e of electorPool) {
    // service may be a string referencing a serviceId or an embedded service
    // descriptor
    if(typeof e.service === 'string') {
      // dereference elector's DID document to locate the service descriptor
      const {record: {service: electorService}} = await ledgerNode.records.get(
        {recordId: e.elector});
      if(!electorService) {
        // TODO: fixup error
        throw new Error('Elector\'s DID document does not contain a '
          + 'service descriptor.');
      }
      // FIXME: is type an array or a string?
      const service = _.find(electorService, {
        id: e.service, type: 'Continuity2017Peer'
      });
      if(!service) {
        // TODO: fixup error
        throw new Error('Elector\'s DID document does not contain a '
          + 'service descriptor.');
      }
      electors[e.elector] = {id: service.endpoint};
    }
  }
  // the current return map allows for correlation of elector DIDs to their
  // service endpoints
  return electors;
};

function _sha256(x) {
  return crypto.createHash('sha256').update(x).digest('hex');
}
