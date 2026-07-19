# DiversiFi MemoryAgent — Alibaba Cloud Function Compute Deployment

This directory contains the **Alibaba Cloud deployment proof** for the Qwen Cloud
Hackathon Track 1 (MemoryAgent) submission.

## Alibaba Cloud Services Used

| Service | Purpose | API / SDK |
|---------|---------|-----------|
| **Function Compute (FC)** | Serverless compute — runs the memory consolidation handler | FC HTTP trigger, Node.js 18 runtime |
| **Tablestore** | Persistent agent memory store with vector search and automatic long-term memory extraction | Tablestore Memory Storage HTTP API (`searchMemories`, `addMemories`, `deleteMemory`) |
| **DashScope (Bailian / Model Studio)** | Qwen long-context LLM for memory consolidation | OpenAI-compatible API at `dashscope.aliyuncs.com/compatible-mode/v1` |

## Architecture

```
Guardian Cron (Hetzner)
      │
      │  POST { userId }
      ▼
Function Compute (this handler)          ← Alibaba Cloud compute
      │
      ├──► Tablestore: searchMemories    ← Alibaba Cloud storage
      │    (recall raw memories)
      │
      ├──► DashScope: Qwen consolidation ← Alibaba Cloud AI
      │    (compress raw memories → profile)
      │
      ├──► Tablestore: addMemories
      │    (store distilled profile)
      │
      └──► Tablestore: deleteMemory
           (evict absorbed raw memories)
```

## Files

| File | Description |
|------|-------------|
| `index.js` | **Proof file** — FC handler that uses Tablestore + DashScope APIs |
| `s.yaml` | Serverless Devs deployment manifest |
| `package.json` | Node.js package metadata |

## Deployment

### 1. Prerequisites

- Alibaba Cloud account
- Serverless Devs CLI: `npm i -g @serverless-devs/s`
- Credentials configured: `s config add --AccessKeyID <key> --AccessKeySecret <secret> -a default`

### 2. Create Tablestore instance and memory store

1. Go to the [Tablestore console](https://otsnext.console.aliyun.com/)
2. Create an instance (CU mode, high-performance, region: ap-southeast-1)
3. Note the endpoint and instance name
4. Create a memory store named `diversifi_agent_memory` (via API or SDK)

### 3. Deploy the function

```bash
cd alibaba-cloud/fc-memory-consolidation
s deploy
```

### 4. Configure environment variables

In the FC console, set these environment variables for the function:

```
DASHSCOPE_API_KEY=<your-dashscope-api-key>
TABLESTORE_ENDPOINT=https://<instance>.ap-southeast-1.ots.aliyuncs.com
TABLESTORE_INSTANCE_NAME=<your-instance-name>
ALIBABA_CLOUD_ACCESS_KEY_ID=<your-access-key-id>
ALIBABA_CLOUD_ACCESS_KEY_SECRET=<your-access-key-secret>
```

### 5. Test

```bash
# HTTP trigger URL (from the FC console)
curl -X POST https://<function-url>.ap-southeast-1.fcapp.run \
  -H "Content-Type: application/json" \
  -d '{"userId": "0x1234..."}'
```

Expected response:
```json
{
  "consolidated": true,
  "rawMemoriesRead": 12,
  "profileStatements": [
    "User prefers capital preservation over high yield",
    "Recurring concern about KES depreciation against USD",
    "Philosophy aligned with Africapitalism"
  ],
  "provider": "dashscope",
  "model": "qwen-plus",
  "evicted": 12
}
```

## Integration with DiversiFi

The Guardian cron on Hetzner calls this FC function via HTTP when
`ALIBABA_CLOUD_FC_ENDPOINT` is set. When unset, the Guardian falls back to
the local consolidation path (Cognee + DashScope direct call). This keeps
Alibaba Cloud as an accelerator, not a dependency.

See `docs/alibaba-cloud-deployment.md` in the repo root for the full
architecture documentation.
