#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, BytesN, Env};

#[test]
fn record_assigns_sequence_and_reads_back() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RecommendationLedger, ());
    let client = RecommendationLedgerClient::new(&env, &contract_id);

    let agent = Address::generate(&env);
    let hash: BytesN<32> = BytesN::from_array(&env, &[7u8; 32]);
    let seq = client.record(&agent, &hash);
    assert_eq!(seq, 1);
    assert_eq!(client.count(&agent), 1);

    let record = client.get(&agent, &seq).unwrap();
    assert_eq!(record.agent, agent);
    assert_eq!(record.reasoning_hash, hash);
}

#[test]
fn sequences_are_per_agent() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RecommendationLedger, ());
    let client = RecommendationLedgerClient::new(&env, &contract_id);

    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let h = BytesN::from_array(&env, &[1u8; 32]);
    assert_eq!(client.record(&a, &h), 1);
    assert_eq!(client.record(&b, &h), 1);
    assert_eq!(client.record(&a, &h), 2);
    assert_eq!(client.get(&b, &2).is_none(), true);
}
