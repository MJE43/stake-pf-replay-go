/**
 * Antebot Script for Pump Cadence Dashboard
 *
 * This script sends two types of messages to the live ingest endpoint:
 * 1. Heartbeat (every round): Updates nonce position for accurate streak tracking
 * 2. Bet (>= threshold): Full bet details for the stream tape
 *
 * Configure API_URL to match your dashboard's ingest endpoint.
 */

// === Required Game Variables ===
game = "pump";
difficulty = "expert";
betSize = 0.0; // Set to 0 for observation-only mode, or your actual bet size
rounds = 1; // Minimum rounds to get roundResultMultiplier
const initialBetSize = betSize;

// === Configuration ===
const API_URL = "http://127.0.0.1:8077/live/ingest"; // Match your dashboard port
const BET_THRESHOLD = 34; // Only send full bet details for >= this multiplier

// === Pause parameters ===
let userSpecifiedThresholdForLastBet = 48000;
let HIGH_MULTI_WINDOW = [];
let HIGH_MULTI_LIMIT = 1000;
let HIGH_MULTI_THRESHOLD = 1000;
let HIGH_MULTI_TRIGGER_COUNT = 3;

// === Helper: Map lastBet to bet API payload ===
function mapBetPayload(lastBet) {
  let iso = null;
  try {
    iso = new Date(lastBet.dateTime).toISOString();
  } catch (e) {
    iso = new Date().toISOString();
  }

  return {
    type: "bet",
    id: String(lastBet.id),
    dateTime: iso,
    nonce: Number(lastBet.nonce),
    amount: Number(lastBet.amount),
    payout: Number(lastBet.payout),
    difficulty: lastBet.state?.difficulty || difficulty,
    roundTarget: lastBet.state?.roundTargetMultiplier || null,
    roundResult: lastBet.state?.roundResultMultiplier || null,
    clientSeed: lastBet.clientSeed,
    serverSeedHashed: lastBet.serverSeedHashed,
  };
}

// === Helper: Map lastBet to heartbeat API payload ===
function mapHeartbeatPayload(lastBet) {
  return {
    type: "heartbeat",
    nonce: Number(lastBet.nonce),
    roundResult: lastBet.state?.roundResultMultiplier || 1.0,
    clientSeed: lastBet.clientSeed,
    serverSeedHashed: lastBet.serverSeedHashed,
  };
}

// === Helper: Send payload to API ===
function sendToAPI(payload) {
  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(function (err) {
    // Silently ignore errors to not disrupt betting
  });
}

// === Main: Process every bet placed ===
engine.onBetPlaced(async function (lastBet) {
  const result = lastBet.state?.roundResultMultiplier || 1.0;

  // Always send heartbeat for nonce tracking
  const heartbeat = mapHeartbeatPayload(lastBet);
  sendToAPI(heartbeat);

  // Send full bet details only for high multipliers
  if (result >= BET_THRESHOLD) {
    const betPayload = mapBetPayload(lastBet);
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(betPayload),
      keepalive: true,
    })
      .then(function (res) {
        if (res.ok) {
          return res.text();
        }
        throw new Error(res.status + " " + res.statusText);
      })
      .then(function (txt) {
        log(
          "Bet ingested: " + result.toFixed(2) + "x @ nonce " + lastBet.nonce
        );
      })
      .catch(function (err) {
        log("Bet ingest failed: " + err);
      });
  }

  // === Pause logic ===

  // Sliding window tracking
  HIGH_MULTI_WINDOW.push(result);
  if (HIGH_MULTI_WINDOW.length > HIGH_MULTI_LIMIT) {
    HIGH_MULTI_WINDOW.shift();
  }

  // Count high multis in window
  let highMultiCount = 0;
  for (let i = 0; i < HIGH_MULTI_WINDOW.length; i++) {
    if (HIGH_MULTI_WINDOW[i] >= HIGH_MULTI_THRESHOLD) {
      highMultiCount++;
    }
  }

  // Window rule: pause if too many high multis in window
  if (highMultiCount >= HIGH_MULTI_TRIGGER_COUNT) {
    notification(
      "Paused: multiplier >= " +
        HIGH_MULTI_THRESHOLD +
        " occurred " +
        highMultiCount +
        "x in last " +
        HIGH_MULTI_WINDOW.length +
        " rounds.",
      "warning"
    );
    engine.pause();
    return;
  }

  // Last bet rule: pause if we hit a huge multiplier
  if (
    userSpecifiedThresholdForLastBet &&
    result >= userSpecifiedThresholdForLastBet
  ) {
    notification(
      "Paused: multiplier " +
        result.toFixed(2) +
        "x meets threshold " +
        userSpecifiedThresholdForLastBet +
        ".",
      "warning"
    );
    engine.pause();
    return;
  }
});

// === On stop: play sound ===
engine.onBettingStopped(function (isManualStop, lastError) {
  playHitSound();
  if (lastError) {
    log("Betting stopped with error: " + lastError);
  } else {
    log("Betting stopped" + (isManualStop ? " (manual)" : ""));
  }
});
