# Product Overview

## What We're Building

Stake PF Replay is a deterministic game outcome replay tool for Stake Originals games. It reconstructs what your bets would have produced given an unhashed server seed, client seed, and nonce range.

## Core Purpose

- **Evidence Machine**: Scan hundreds of thousands to ~1M nonces to find specific conditions (e.g., "show me all nonces where Limbo ≥ 10x")
- **Provable Fairness Verification**: Validate game outcomes using HMAC-SHA256 with published server seeds
- **Research Tool**: Generate distributions, analyze patterns, and validate fairness claims

## Key Principles

- **Deterministic**: Same inputs → same outputs, always
- **Fast**: Linear scaling with CPU cores, allocation-free hot paths
- **Transparent**: Versioned payout tables, engine version echoed in responses
- **Auditable**: Bit-for-bit reproducible results across machines

## Target Users

- **Seed Replayers**: Players exploring alternate timelines after seed rotation
- **Researchers/Analysts**: Validating provable fairness and gathering data
- **Support Staff**: Quick resolution of "what would have happened?" queries

## Not a Betting Bot

This tool replays outcomes - it does not place bets, optimize seeds, or connect to live casino systems.