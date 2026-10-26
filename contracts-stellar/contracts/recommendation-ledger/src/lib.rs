#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Symbol};

/// Minimal decision-commitment ledger for the DiversiFi Guardian on Stellar.
///
/// Mirrors the EVM `RecommendationLedger` (reasoning stays hash-only on-chain;
/// the readable line lives off-chain keyed by `(agent, seq)`): each `record`
/// call stores a 32-byte reasoning-hash commitment under the recording agent's
/// own sequence and emits a `record` event carrying the agent, seq and hash.
/// No value moves; this is evidence, not custody.

const RECORDS: Symbol = symbol_short!("RECORDS");

#[contracttype]
#[derive(Clone)]
pub struct Record {
    pub agent: Address,
    pub reasoning_hash: BytesN<32>,
    pub ledger: u32,
}

#[contract]
pub struct RecommendationLedger;

#[contractimpl]
impl RecommendationLedger {
    /// Commit a reasoning hash for `agent`. Returns the assigned sequence.
    /// The agent authorizes the write itself — an agent's records can only be
    /// written by that agent's key.
    pub fn record(env: Env, agent: Address, reasoning_hash: BytesN<32>) -> u32 {
        agent.require_auth();
        let count = Self::count(env.clone(), agent.clone());
        let seq = count + 1;
        let record = Record {
            agent: agent.clone(),
            reasoning_hash: reasoning_hash.clone(),
            ledger: env.ledger().sequence(),
        };
        env.storage()
            .persistent()
            .set(&(RECORDS, agent.clone(), seq), &record);
        env.storage()
            .persistent()
            .set(&(RECORDS, agent), &seq);
        env.events().publish(
            (symbol_short!("record"), seq),
            reasoning_hash,
        );
        seq
    }

    /// How many records `agent` has committed.
    pub fn count(env: Env, agent: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&(RECORDS, agent))
            .unwrap_or(0)
    }

    /// Fetch record `seq` for `agent`, if it exists.
    pub fn get(env: Env, agent: Address, seq: u32) -> Option<Record> {
        env.storage().persistent().get(&(RECORDS, agent, seq))
    }
}

mod test;
