# Hetzner Deployment Guide

## Overview

DiversiFi AI API is deployed on a Hetzner server to overcome Netlify's 10-second serverless function timeout. This allows AI operations (analysis, transcription, speech) to run with 90-second timeouts.

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Netlify       │         │   Hetzner       │         │   AI Providers  │
│   Frontend      │ ──────► │   API Server    │ ──────► │   (Venice, etc) │
│   (Static)      │         │   Port 6174     │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
      │                           │
      │ HTTPS                     │ HTTPS via Nginx
      │                           │ + SSL (Certbot)
```

## Components

### Server Configuration
- **Location**: Hetzner Cloud
- **Domain**: `api.diversifi.famile.xyz`
- **Port**: 6174 (internal), 443 (HTTPS via Nginx)
- **Process Manager**: PM2
- **Web Server**: Nginx (reverse proxy)
- **SSL**: Let's Encrypt (auto-renewing)

### API Endpoints

All AI agent endpoints are served from Hetzner:

| Endpoint | Description | Timeout |
|----------|-------------|---------|
| `/api/agent/analyze` | Portfolio analysis | 90s |
| `/api/agent/chat` | AI chat conversation | 90s |
| `/api/agent/speak` | Text-to-speech | 90s |
| `/api/agent/transcribe` | Speech-to-text | 90s |
| `/api/agent/vision` | Image analysis | 90s |
| `/api/agent/web-analyze` | Web page analysis | 90s |
| `/api/agent/deep-analyze` | Deep portfolio review | 90s |
| `/api/agent/status` | AI provider status check | 5s |
| `/api/agent/automation` | Zapier automation | 90s |
| `/api/agent/test-zapier` | Zapier integration test | 5s |
| `/api/agent/onramp-help` | Onramp assistance | 30s |
| `/api/agent/x402-gateway` | X402 payment gateway | 30s |

## Deployment Process

### Prerequisites
- Hetzner server with SSH access
- Domain pointed to server IP (`api.diversifi.famile.xyz`)
- Node.js 20+, pnpm installed
- PM2 installed globally

### Step 1: Environment Setup

```bash
ssh <server>
cd /opt/diversifi-api

# Create .env from example
cp .env.example .env

# Edit with required keys (minimum):
# - VENICE_API_KEY (primary AI provider)
# - GEMINI_API_KEY (fallback AI provider)
nano .env
```

### Step 2: Deploy

```bash
# Run deployment script
bash scripts/deploy-hetzner.sh
```

The script performs:
1. Git pull (latest main branch)
2. pnpm install
3. Next.js build
4. Server start on port 6174
5. Health check

### Step 3: SSL Certificate

```bash
# Obtain SSL certificate (first time only)
sudo certbot --nginx -d api.diversifi.famile.xyz
```

Certificate auto-renews via certbot systemd timer.

### Step 4: Verify Deployment

```bash
# Check server status
curl https://api.diversifi.famile.xyz/api/agent/status

# Check PM2 status
pm2 status diversifi-api

# View logs
tail -f /var/log/diversifi-api.log
```

## Nginx Configuration

Nginx reverse proxy config at `/etc/nginx/sites-available/api.diversifi.famile.xyz`:

```nginx
upstream diversifi_api {
    server 127.0.0.1:6174;
    keepalive 16;
}

server {
    server_name api.diversifi.famile.xyz;
    
    # CORS headers
    add_header Access-Control-Allow-Origin * always;
    add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS' always;
    add_header Access-Control-Allow-Headers 'Content-Type, Authorization' always;
    
    location / {
        # AI timeouts (90s headroom vs Netlify's 10s)
        proxy_connect_timeout 10s;
        proxy_send_timeout    90s;
        proxy_read_timeout    90s;
        
        proxy_pass http://diversifi_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # Only allow /api/* routes
    location ~* ^/(?!api/) {
        return 404;
    }
}
```

## Netlify Integration

### Environment Variable

In Netlify Dashboard → Site Settings → Environment Variables:

```
NEXT_PUBLIC_API_BASE_URL = https://api.diversifi.famile.xyz
```

This routes all `/api/agent/*` calls to Hetzner instead of Netlify functions.

### CSP Configuration

In `next.config.js`, ensure Hetzner domain is in Content-Security-Policy:

```javascript
connect-src 'self' https://api.diversifi.famile.xyz ...
```

## Monitoring

### PM2 Commands

```bash
# Status
pm2 status diversifi-api

# Logs
pm2 logs diversifi-api

# Restart
pm2 restart diversifi-api

# Stop
pm2 stop diversifi-api

# Delete
pm2 delete diversifi-api
```

### Log Files

- **Application**: `/var/log/diversifi-api.log`
- **Nginx Access**: `/var/log/nginx/diversifi-api.access.log`
- **Nginx Error**: `/var/log/nginx/diversifi-api.error.log`

### Health Check Endpoint

```bash
curl https://api.diversifi.famile.xyz/api/agent/status
```

Response:
```json
{
  "enabled": true,
  "isTestnet": true,
  "spendingLimit": 5,
  "capabilities": {
    "analysis": true,
    "analysisProviders": { "venice": true, "gemini": false },
    "transcription": false,
    "speech": true
  },
  "providers": {
    "venice": { "available": true },
    "gemini": { "available": false }
  }
}
```

## Troubleshooting

### Server Not Responding

```bash
# Check if process is running
pm2 status diversifi-api

# Check port is listening
ss -tlnp | grep 6174

# Restart server
pm2 restart diversifi-api
```

### SSL Certificate Issues

```bash
# Renew certificate
sudo certbot renew

# Check certificate expiry
sudo certbot certificates
```

### High Memory Usage

```bash
# Check PM2 memory
pm2 monit

# Restart if needed
pm2 restart diversifi-api
```

### API Keys Not Working

```bash
# Verify .env exists and has keys
ssh <server>
cat /opt/diversifi-api/.env | grep API_KEY

# Restart to load new env vars
pm2 restart diversifi-api
```

## Cost

- **Hetzner Cloud CX11**: ~€5/month (2 vCPU, 2GB RAM, 20GB storage)
- **SSL**: Free (Let's Encrypt)
- **Domain**: Existing (diversifi.famile.xyz)

## Security Considerations

1. **Firewall**: Only ports 22 (SSH), 80 (HTTP), 443 (HTTPS) open
2. **SSH Keys**: Key-based authentication only
3. **API Keys**: Stored server-side only (never exposed to client)
4. **CORS**: Restricted to Netlify domain in production
5. **Rate Limiting**: Implement at Nginx level if needed

## Backup & Recovery

### PM2 Process List

```bash
# Save PM2 process list (automatic on changes)
pm2 save

# Restore on server reboot (via PM2 startup)
pm2 startup
```

### Environment Variables

Keep `.env.example` in repo (committed), but actual `.env` is server-only.

### Git Deployment

All code changes deployed via:
```bash
bash scripts/deploy-hetzner.sh
# Does: git pull → pnpm install → pnpm build → restart
```

## Future Improvements

- [ ] Automated health checks with auto-restart
- [ ] Load balancing (multiple instances)
- [ ] Redis caching for repeated AI requests
- [ ] CDN for static assets
- [ ] Monitoring dashboard (PM2.io or custom)
- [ ] Automated rollback on deployment failure
