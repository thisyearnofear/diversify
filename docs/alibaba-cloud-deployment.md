# Alibaba Cloud Deployment — Proof Documentation

**Qwen Cloud Global AI Hackathon — Track 1: MemoryAgent**

This document proves that the DiversiFi backend uses Alibaba Cloud services
and APIs. It accompanies the submission form fields:

- *URL to code file showing proof of Alibaba Cloud Deployment*
- *Screenshot showing proof of Alibaba Cloud Deployment*

## Proof Files

The following code files in the repository demonstrate use of Alibaba Cloud
services and APIs:

| File | Alibaba Cloud Service | Purpose |
|------|----------------------|---------|
| [`alibaba-cloud/fc-memory-consolidation/index.js`](../alibaba-cloud/fc-memory-consolidation/index.js) | **Function Compute** + **Tablestore** + **DashScope** | FC handler that runs on Alibaba Cloud — reads memories from Tablestore, consolidates with Qwen via DashScope, writes profile back |
| [`packages/shared/src/services/tablestore-memory-service.ts`](../packages/shared/src/services/tablestore-memory-service.ts) | **Tablestore** | Memory adapter using the Tablestore Memory Storage HTTP API (`searchMemories`, `addMemories`, `deleteMemory`) |
| [`packages/shared/src/services/ai/providers/dashscope-provider.ts`](../packages/shared/src/services/ai/providers/dashscope-provider.ts) | **DashScope (Bailian)** | Qwen long-context LLM provider via the OpenAI-compatible DashScope API |
| [`packages/shared/src/services/memory-consolidation-service.ts`](../packages/shared/src/services/memory-consolidation-service.ts) | **Function Compute** (via HTTP delegation) + **Tablestore** + **DashScope** | Orchestrates the consolidation pipeline — delegates to FC when `ALIBABA_CLOUD_FC_ENDPOINT` is set, falls back to local Tablestore/Cognee |

**Primary proof file:** `alibaba-cloud/fc-memory-consolidation/index.js`

This is a Function Compute handler that runs on Alibaba Cloud infrastructure
and uses three Alibaba Cloud services:

1. **Function Compute (FC)** — the serverless compute platform hosting the handler
2. **Tablestore** — the Agent Memory store for persistent memory with vector search
3. **DashScope (Bailian / Model Studio)** — the Qwen long-context LLM API

## Alibaba Cloud Services Used

### 1. Function Compute (FC)

The memory consolidation handler is deployed as a Node.js 18 function on
Alibaba Cloud Function Compute. It exposes an HTTP trigger that the Guardian
cron (running on Hetzner) calls to trigger memory consolidation for a specific
user.

- **Runtime:** Node.js 18
- **Memory:** 512 MB
- **Timeout:** 120s (Qwen long-context consolidation can be slow)
- **Trigger:** HTTP (POST)
- **Region:** ap-southeast-1 (Singapore)

Deployment manifest: [`alibaba-cloud/fc-memory-consolidation/s.yaml`](../alibaba-cloud/fc-memory-consolidation/s.yaml)

### 2. Tablestore (Agent Memory)

Tablestore's Agent Memory feature provides:

- **Long-term memory storage** with automatic extraction from conversation messages
- **Vector search** (`searchMemories`) for semantic recall across sessions
- **Short-term vs long-term separation** — raw messages are short-term, extracted signals are long-term
- **Scoped by app/tenant/agent/session** — multi-user, multi-agent isolation

APIs used (via HTTP JSON protocol):

| API | Purpose |
|-----|---------|
| `searchMemories` | Vector search for recalling relevant memories |
| `addMemories` | Store new memories (with background long-term extraction) |
| `deleteMemory` | Evict stale/absorbed memories (hard forgetting) |
| `listMemories` | List all memories for a user (GDPR forget) |

Adapter: [`packages/shared/src/services/tablestore-memory-service.ts`](../packages/shared/src/services/tablestore-memory-service.ts)

### 3. DashScope (Bailian / Model Studio)

DashScope is Alibaba Cloud's AI model serving platform. We use the
OpenAI-compatible endpoint to access Qwen long-context models for memory
consolidation:

- **Endpoint:** `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **Default model:** `qwen-plus` (balance of quality and cost)
- **For large memory pools:** `qwen-long` (1M-token context window)
- **For highest quality:** `qwen-max`

Provider: [`packages/shared/src/services/ai/providers/dashscope-provider.ts`](../packages/shared/src/services/ai/providers/dashscope-provider.ts)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User (Browser)                           │
│                    DiversiFi Next.js App                        │
│                   (Vercel — Frontend + API)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ Chat / Advisor / Swap
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Guardian Cron (Hetzner)                      │
│            Every 5 min — auto-execution loop                    │
│  Every ~6h: triggers memory consolidation per active user       │
└──────────┬──────────────────────────────┬───────────────────────┘
           │                              │
           │  POST { userId }             │  (fallback: local
           │                              │   consolidation)
           ▼                              ▼
┌──────────────────────────┐   ┌─────────────────────────────────┐
│  Alibaba Cloud FC        │   │  Local Consolidation             │
│  (Function Compute)      │   │  (Hetzner / Vercel)              │
│                          │   │                                 │
│  index.handler           │   │  memoryConsolidationService      │
│  ┌────────────────────┐  │   │  ┌───────────────────────────┐  │
│  │ 1. searchMemories  │──┼───┼──│ Tablestore (if configured)│  │
│  │   (Tablestore)     │  │   │  │ or Cognee (fallback)      │  │
│  │ 2. Qwen consolidate│  │   │  └───────────────────────────┘  │
│  │   (DashScope)      │  │   │  ┌───────────────────────────┐  │
│  │ 3. addMemories     │──┼───┼──│ Qwen (DashScope) or       │  │
│  │   (Tablestore)     │  │   │  │ fallback LLM chain        │  │
│  │ 4. deleteMemory    │──┼───┼──│ for consolidation          │  │
│  │   (Tablestore)     │  │   │  └───────────────────────────┘  │
│  └────────────────────┘  │   └─────────────────────────────────┘
└──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Alibaba Cloud Tablestore                      │
│               Agent Memory Store (persistent)                   │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐     │
│  │ Short-term  │  │ Long-term   │  │ Vector Search Index │     │
│  │ (raw msgs)  │  │ (profiles)  │  │ (semantic recall)   │     │
│  └─────────────┘  └─────────────┘  └─────────────────────┘     │
│                                                                 │
│  Automatic long-term memory extraction from conversations       │
│  Scoped by appId / tenantId / agentId / runId                   │
└─────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Alibaba Cloud DashScope (Bailian)                  │
│                  Qwen Long-Context LLM API                      │
│                                                                 │
│  Models: qwen-plus (default) | qwen-long (1M ctx) | qwen-max   │
│  Endpoint: dashscope.aliyuncs.com/compatible-mode/v1            │
│  Used for: memory consolidation (raw → distilled profile)       │
└─────────────────────────────────────────────────────────────────┘
```

## Memory Pipeline (Track 1: MemoryAgent)

The consolidation pipeline implements the three Track 1 requirements:

### 1. Efficient memory storage and retrieval

- Raw interactions are stored via `addMemories` (Tablestore) or `remember` (Cognee)
- Recall uses vector search (`searchMemories`) for semantic retrieval
- A consolidated profile is stored as a high-priority memory with `metadata.type = 'consolidated_profile'`

### 2. Timely forgetting of outdated information

- **Soft forgetting (decay):** memories older than TTL (30 days) have their recall score penalized proportional to age; at 2×TTL the score reaches zero
- **Hard forgetting (sweep):** `sweepStaleMemories` evicts memories with decayed score below the threshold via `deleteMemory`
- After consolidation, absorbed raw memories are evicted to prevent the store from growing unbounded

### 3. Recalling critical memories within limited context windows

- Qwen long-context models (`qwen-long` supports 1M tokens) consolidate up to 40 raw memories into 3-7 distilled profile statements
- The distilled profile is prioritized in recall (high-priority flag, score > 0.5 filter)
- This keeps the advisor's context window focused on durable signals, not ephemeral details

## Deployment Instructions

### Prerequisites

1. Alibaba Cloud account
2. Serverless Devs CLI: `npm i -g @serverless-devs/s`
3. Credentials: `s config add --AccessKeyID <key> --AccessKeySecret <secret> -a default`
4. DashScope API key from [Bailian console](https://bailian.console.aliyun.com/)

### Step 1: Create Tablestore instance

1. Go to the [Tablestore console](https://otsnext.console.aliyun.com/)
2. Create an instance (CU mode, high-performance, region: ap-southeast-1)
3. Note the endpoint (`https://<instance>.ap-southeast-1.ots.aliyuncs.com`) and instance name
4. Create a memory store named `diversifi_agent_memory` (via the API or SDK)

### Step 2: Deploy the Function Compute handler

```bash
cd alibaba-cloud/fc-memory-consolidation
s deploy
```

### Step 3: Configure environment variables

In the FC console, set these environment variables for the function:

```
DASHSCOPE_API_KEY=<your-dashscope-api-key>
TABLESTORE_ENDPOINT=https://<instance>.ap-southeast-1.ots.aliyuncs.com
TABLESTORE_INSTANCE_NAME=<your-instance-name>
ALIBABA_CLOUD_ACCESS_KEY_ID=<your-access-key-id>
ALIBABA_CLOUD_ACCESS_KEY_SECRET=<your-access-key-secret>
```

### Step 4: Wire the Guardian cron

Set `ALIBABA_CLOUD_FC_ENDPOINT` in the DiversiFi `.env.local` to the FC HTTP
trigger URL. The Guardian cron will now delegate consolidation to Alibaba Cloud.

### Step 5: Take the workbench screenshot

1. Open the [Function Compute console](https://fcnext.console.aliyun.com/)
2. Navigate to the `diversifi-memory-consolidation` function
3. Take a screenshot showing the function running (code tab, trigger tab, or invocations tab)
4. Upload this screenshot to the Devpost submission form

## Optionality

All Alibaba Cloud services are behind environment variables. When unset:

| Env var unset | Behavior |
|---------------|----------|
| `ALIBABA_CLOUD_FC_ENDPOINT` | Guardian cron does local consolidation instead of delegating to FC |
| `TABLESTORE_ENDPOINT` | Memory backend falls back to Cognee |
| `DASHSCOPE_API_KEY` | LLM consolidation falls back to Gemini → Venice → ... chain |

The app is fully functional without any Alibaba Cloud services configured.
Alibaba Cloud is an accelerator, not a dependency.
