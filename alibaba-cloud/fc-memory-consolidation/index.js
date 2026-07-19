/**
 * Alibaba Cloud Function Compute — Memory Consolidation Handler
 *
 * This is the PROOF FILE for the Qwen Cloud Hackathon Track 1 (MemoryAgent)
 * Alibaba Cloud Deployment requirement. It demonstrates that the backend is
 * running on Alibaba Cloud infrastructure, using Alibaba Cloud services and
 * APIs.
 *
 * Alibaba Cloud services used:
 *   1. Function Compute (FC)  — serverless compute, runs this handler
 *   2. Tablestore             — Agent Memory store for persistent memory
 *   3. DashScope (Bailian)    — Qwen long-context LLM for consolidation
 *
 * Architecture:
 *
 *   Guardian Cron (Hetzner)
 *         │
 *         ▼
 *   HTTP trigger → Function Compute (this file)
 *         │
 *         ├──► Tablestore: searchMemories (recall raw memories)
 *         │
 *         ├──► DashScope: Qwen long-context consolidation
 *         │         │
 *         │         ▼
 *         │    Distilled user profile (3-7 statements)
 *         │
 *         ├──► Tablestore: addMemories (store profile as long-term memory)
 *         │
 *         └──► Tablestore: deleteMemory (evict absorbed raw memories)
 *
 * Deployment:
 *   Deploy via Serverless Devs (s.yaml) or the FC console.
 *   See README.md in this directory for step-by-step instructions.
 *
 * Trigger: HTTP trigger (called from the Guardian cron on Hetzner) or
 *          Timer trigger (runs on a schedule independently).
 */

'use strict';

const https = require('https');

// ─── Configuration (from FC environment variables) ────────────────────────

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const DASHSCOPE_BASE_URL =
  process.env.DASHSCOPE_BASE_URL ||
  'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DASHSCOPE_MODEL = process.env.DASHSCOPE_MODEL || 'qwen-plus';

const TABLESTORE_ENDPOINT = process.env.TABLESTORE_ENDPOINT || '';
const TABLESTORE_INSTANCE = process.env.TABLESTORE_INSTANCE_NAME || '';
const TABLESTORE_ACCESS_KEY_ID =
  process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '';
const TABLESTORE_ACCESS_KEY_SECRET =
  process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '';
const TABLESTORE_MEMORY_STORE_NAME =
  process.env.TABLESTORE_MEMORY_STORE_NAME || 'diversifi_agent_memory';
const TABLESTORE_APP_ID = process.env.TABLESTORE_APP_ID || 'diversifi';

const MIN_MEMORIES_TO_CONSOLIDATE = 8;
const CONSOLIDATION_POOL_SIZE = 40;

// ─── DashScope (Qwen) Consolidation ───────────────────────────────────────

const CONSOLIDATION_SYSTEM_PROMPT = `You are a memory consolidation engine for a risk-aware treasury management agent (DiversiFi).

You will be given a list of raw interaction memories between the agent and a single user, in chronological order. Each memory records what the user asked, what the agent recommended, and any action taken.

Your job: compress these raw interactions into a tight, distilled user profile that captures the durable, reusable signals — the things that should persist across sessions and inform future recommendations. Discard ephemeral details (specific token amounts that have already been traded, one-off questions, transient market conditions).

Extract and synthesize:
- Stated or revealed risk tolerance and philosophy (e.g. Africapitalism, Islamic Finance, Buen Vivir, capital preservation)
- Currency / regional concerns that recur (e.g. KES depreciation, USD concentration risk)
- Asset preferences and rejections (what they've accepted vs pushed back on)
- Behavioral patterns (e.g. prefers autonomous execution, asks for human confirmation on large trades, distrusts memecoins)
- Goals that span sessions (e.g. saving for a specific purpose, hedging a specific exposure)
- Any contradictions or evolution in their views over time

Output 3-7 concise profile statements, each one sentence, each a standalone fact that would help a future advisor turn give a more personalized response. Do not include ephemeral details. Do not include recommendations. Do not include the user's name or address. Just the durable signals.

Format strictly as a JSON array of strings. No prose, no markdown fences.`;

/**
 * Call DashScope (Qwen) via the OpenAI-compatible endpoint to consolidate
 * raw memories into a distilled user profile.
 *
 * Uses Alibaba Cloud's DashScope API (Bailian / Model Studio):
 *   https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
 */
function consolidateWithQwen(rawMemories) {
  const memoryBlock = rawMemories
    .map((m, i) => `[${i + 1}] ${m.content}`)
    .join('\n');

  const userPrompt = `Raw interaction memories (chronological):\n\n${memoryBlock}\n\nDistill these into a durable user profile. Output a JSON array of 3-7 concise strings.`;

  const body = JSON.stringify({
    model: DASHSCOPE_MODEL,
    messages: [
      { role: 'system', content: CONSOLIDATION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 800,
    response_format: { type: 'json_object' },
  });

  return new Promise((resolve, reject) => {
    const url = new URL(DASHSCOPE_BASE_URL + '/chat/completions');
    const options = {
      method: 'POST',
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 60000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`DashScope API error: ${res.statusCode} ${data}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content =
            parsed.choices?.[0]?.message?.content || '';
          resolve({ content, model: parsed.model || DASHSCOPE_MODEL });
        } catch (err) {
          reject(new Error(`DashScope parse error: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('DashScope request timeout')));
    req.write(body);
    req.end();
  });
}

// ─── Tablestore Agent Memory API ──────────────────────────────────────────

/**
 * Call the Tablestore Memory Storage HTTP API.
 *
 * The Memory Storage API is accessed via HTTP JSON protocol at:
 *   {endpoint}/api/v1/memory/{operation}
 *
 * See: https://www.alibabacloud.com/help/en/tablestore/memory-storage-api-reference
 */
function tablestoreCall(operation, payload) {
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const url = new URL(TABLESTORE_ENDPOINT + '/api/v1/memory/' + operation);
    const options = {
      method: 'POST',
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
        'x-ots-accesskeyid': TABLESTORE_ACCESS_KEY_ID,
        'x-ots-accesskeysecret': TABLESTORE_ACCESS_KEY_SECRET,
        'x-ots-instancename': TABLESTORE_INSTANCE,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(
            new Error(`Tablestore ${operation} error: ${res.statusCode} ${data}`)
          );
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Tablestore ${operation} parse error: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () =>
      reject(new Error(`Tablestore ${operation} timeout`))
    );
    req.write(body);
    req.end();
  });
}

/**
 * Search memories for a user via Tablestore's vector search.
 * Uses agentId: '*' and runId: '*' to search across all sessions.
 */
async function searchMemories(userId, query, topK) {
  const result = await tablestoreCall('searchMemories', {
    memoryStoreName: TABLESTORE_MEMORY_STORE_NAME,
    scope: {
      appId: TABLESTORE_APP_ID,
      tenantId: userId,
      agentId: '*',
      runId: '*',
    },
    query,
    topK: topK || 40,
  });

  return (result.results || []).map((item) => ({
    id: item.memoryId || item.id || '',
    content: item.text || item.content || '',
    score: item.score || 0,
    metadata: item.metadata || {},
  }));
}

/**
 * Add a memory (preprocessed text) to the Tablestore memory store.
 * The service extracts long-term memory signals in the background.
 */
async function addMemory(userId, text, metadata) {
  return tablestoreCall('addMemories', {
    memoryStoreName: TABLESTORE_MEMORY_STORE_NAME,
    scope: {
      appId: TABLESTORE_APP_ID,
      tenantId: userId,
      agentId: 'guardian',
      runId: 'consolidation',
    },
    text,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata,
    },
    sync: false,
  });
}

/**
 * Delete a memory by ID from the Tablestore memory store.
 */
async function deleteMemory(memoryId) {
  return tablestoreCall('deleteMemory', {
    memoryStoreName: TABLESTORE_MEMORY_STORE_NAME,
    memoryId,
  });
}

// ─── Main Handler ─────────────────────────────────────────────────────────

/**
 * Function Compute entry point.
 *
 * Called via HTTP trigger from the DiversiFi Guardian cron, or via Timer
 * trigger on a schedule. The handler:
 *
 *   1. Reads raw memories from Tablestore (searchMemories)
 *   2. Filters out previously-consolidated profiles
 *   3. Calls DashScope/Qwen to consolidate raw memories into a profile
 *   4. Stores the distilled profile back to Tablestore (addMemories)
 *   5. Evicts the absorbed raw memories (deleteMemory)
 *
 * @param {object} event - FC event (HTTP trigger or Timer trigger)
 *   For HTTP triggers: event.body contains JSON with { userId }
 *   For Timer triggers: parse userId from event.payload or process all users
 * @param {object} context - FC execution context
 * @param {function} callback - FC callback (err, response)
 */
exports.handler = async (event, context, callback) => {
  // ─── Parse input ───────────────────────────────────────────────────────
  let userId;
  try {
    if (typeof event === 'string') {
      const parsed = JSON.parse(event);
      userId = parsed.userId;
    } else if (event.body) {
      const parsed = JSON.parse(event.body);
      userId = parsed.userId;
    } else if (event.payload) {
      const parsed = JSON.parse(event.payload);
      userId = parsed.userId;
    } else {
      userId = event.userId;
    }
  } catch {
    userId = null;
  }

  if (!userId) {
    const msg = 'Missing userId in event payload';
    console.error('[fc-memory-consolidation] ' + msg);
    if (callback) return callback(null, {
      statusCode: 400,
      body: JSON.stringify({ error: msg }),
    });
    return { error: msg };
  }

  console.log(`[fc-memory-consolidation] Starting consolidation for user: ${userId}`);

  // ─── 1. Read raw memories from Tablestore ──────────────────────────────
  let rawMemories;
  try {
    const all = await searchMemories(
      userId,
      'user preferences recommendations portfolio actions philosophy risk tolerance',
      CONSOLIDATION_POOL_SIZE
    );
    // Filter out previously-consolidated profiles
    rawMemories = all.filter(
      (m) => m.metadata?.type !== 'consolidated_profile'
    );
  } catch (err) {
    console.error('[fc-memory-consolidation] Tablestore search failed:', err.message);
    if (callback) return callback(null, {
      statusCode: 500,
      body: JSON.stringify({ error: 'tablestore_search_failed', detail: err.message }),
    });
    return { error: 'tablestore_search_failed', detail: err.message };
  }

  if (rawMemories.length < MIN_MEMORIES_TO_CONSOLIDATE) {
    const msg = `below_min_memories (${rawMemories.length}/${MIN_MEMORIES_TO_CONSOLIDATE})`;
    console.log(`[fc-memory-consolidation] Skipping: ${msg}`);
    if (callback) return callback(null, {
      statusCode: 200,
      body: JSON.stringify({
        consolidated: false,
        reason: msg,
        rawMemoriesRead: rawMemories.length,
      }),
    });
    return { consolidated: false, reason: msg, rawMemoriesRead: rawMemories.length };
  }

  // ─── 2. Consolidate with Qwen (DashScope) ──────────────────────────────
  let qwenResult;
  try {
    qwenResult = await consolidateWithQwen(rawMemories);
  } catch (err) {
    console.error('[fc-memory-consolidation] DashScope consolidation failed:', err.message);
    if (callback) return callback(null, {
      statusCode: 500,
      body: JSON.stringify({ error: 'qwen_consolidation_failed', detail: err.message }),
    });
    return { error: 'qwen_consolidation_failed', detail: err.message };
  }

  // ─── 3. Parse the distilled profile ────────────────────────────────────
  let profileStatements = [];
  try {
    const parsed = JSON.parse(qwenResult.content);
    if (Array.isArray(parsed)) {
      profileStatements = parsed.filter((s) => typeof s === 'string');
    } else if (parsed && typeof parsed === 'object') {
      const arr = parsed.profile ?? parsed.statements ?? parsed.result;
      if (Array.isArray(arr)) {
        profileStatements = arr.filter((s) => typeof s === 'string');
      }
    }
  } catch {
    // Non-JSON response — skip
  }

  if (profileStatements.length === 0) {
    if (callback) return callback(null, {
      statusCode: 200,
      body: JSON.stringify({
        consolidated: false,
        reason: 'empty_profile',
        rawMemoriesRead: rawMemories.length,
        model: qwenResult.model,
      }),
    });
    return { consolidated: false, reason: 'empty_profile', model: qwenResult.model };
  }

  // ─── 4. Store the distilled profile in Tablestore ──────────────────────
  const profileText = `CONSOLIDATED USER PROFILE:\n${profileStatements.map((s) => `- ${s}`).join('\n')}`;

  try {
    await addMemory(userId, profileText, {
      type: 'consolidated_profile',
      consolidatedAt: new Date().toISOString(),
      sourceMemoryCount: rawMemories.length,
      priority: 'high',
    });
  } catch (err) {
    console.error('[fc-memory-consolidation] Tablestore addMemory failed:', err.message);
    if (callback) return callback(null, {
      statusCode: 500,
      body: JSON.stringify({ error: 'tablestore_store_failed', detail: err.message }),
    });
    return { error: 'tablestore_store_failed', detail: err.message };
  }

  // ─── 5. Evict absorbed raw memories ────────────────────────────────────
  let evicted = 0;
  for (const memory of rawMemories) {
    if (!memory.id) continue;
    try {
      await deleteMemory(memory.id);
      evicted++;
    } catch {
      // Best-effort — the profile is already stored
    }
  }

  const result = {
    consolidated: true,
    rawMemoriesRead: rawMemories.length,
    profileStatements,
    provider: 'dashscope',
    model: qwenResult.model,
    evicted,
    timestamp: new Date().toISOString(),
  };

  console.log(`[fc-memory-consolidation] Success: ${profileStatements.length} statements, ${evicted} evicted`);

  if (callback) return callback(null, {
    statusCode: 200,
    body: JSON.stringify(result),
  });
  return result;
};
