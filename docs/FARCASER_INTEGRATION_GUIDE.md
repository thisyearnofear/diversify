# Farcaster Mini App Integration Guide (2026 Standards)

This guide documents the Farcaster mini app integration for DiversiFi MiniPay.

## 🎯 Overview

DiversiFi MiniPay is now fully configured as a Farcaster mini app compliant with 2026 standards. This integration provides:

- **Seamless wallet connection** through Farcaster context
- **Enhanced user experience** with Farcaster-specific UI elements
- **Event handling** via webhook endpoint
- **Comprehensive error handling** for Farcaster environments
- **Analytics and logging** for Farcaster user interactions

## 🚀 Key Features

### 1. Farcaster Webhook Endpoint

**Location:** `pages/api/farcaster-webhook.ts`

**Supported Events:**
- `frame_action` - Button clicks, input submissions
- `frame_event` - Frame lifecycle events (load, error, close)

**Usage:**
```typescript
// Handles button clicks
POST /api/farcaster-webhook
{
  "type": "frame_action",
  "action": "button_click",
  "fid": 12345,
  "username": "user",
  "buttonIndex": 1,
  "state": {}
}
```

### 2. Farcaster UI Components

#### FarcasterUserInfo
**Location:** `components/FarcasterUserInfo.tsx`

Displays:
- User profile picture (PFP)
- Username and display name
- FID (Farcaster ID)
- Verification status
- Welcome message

#### FarcasterWalletButton
**Location:** `components/FarcasterWalletButton.tsx`

Features:
- Farcaster-branded styling (purple theme)
- Shows connected address with Farcaster username
- Dropdown menu for wallet management
- Loading states and error handling

### 3. Enhanced Wallet Hook

**Location:** `hooks/use-wallet.ts`

**New Functions:**

- `connectFarcasterWallet()`: Connects wallet using Farcaster context
- `getFarcasterErrorMessage(error)`: Returns Farcaster-specific error messages
- `logFarcasterUserInfo(context)`: Logs user analytics data

**Auto-Connection:**
- Automatically connects if Farcaster context contains a wallet address
- Falls back to regular wallet connection if needed

### 4. Configuration Files

#### Farcaster Manifest
**Location:** `public/.well-known/farcaster.json`

**Key Fields:**
```json
{
  "frame": {
    "version": "1",
    "name": "DiversiFi",
    "webhookUrl": "/api/farcaster-webhook",
    "description": "DiversiFi - Decentralized Finance for Everyone on Farcaster",
    "features": {
      "walletConnection": true,
      "tokenSwaps": true,
      "portfolioManagement": true,
      "multiChainSupport": true,
      "inflationProtection": true
    },
    "supportedChains": ["celo", "ethereum", "polygon", "arbitrum"]
  }
}
```

#### Meta Tag
**Location:** `pages/index.tsx`

```html
<meta
  name="fc:miniapp"
  content='{"version":"1","name":"DiversiFi","iconUrl":"/icon.png","splashImageUrl":"/splash.png","webhookUrl":"/api/farcaster-webhook","description":"DiversiFi - Decentralized Finance for Everyone on Farcaster"}'
/>
```

## 🔧 Development Guide

### Detecting Farcaster Environment

```typescript
import { useWalletContext } from '../components/WalletProvider';

const { isFarcaster, farcasterContext } = useWalletContext();

if (isFarcaster && farcasterContext) {
  const { fid, username, displayName, pfp } = farcasterContext;
  // Use Farcaster user data
}
```

### Connecting Farcaster Wallet

```typescript
import { useWalletContext } from '../components/WalletProvider';

const { connectFarcasterWallet } = useWalletContext();

<button onClick={connectFarcasterWallet}>
  Connect with Farcaster
</button>
```

### Handling Farcaster Errors

```typescript
import { useWalletContext } from '../components/WalletProvider';

const { error, getFarcasterErrorMessage } = useWalletContext();

if (error) {
  const farcasterError = getFarcasterErrorMessage(error);
  if (farcasterError) {
    // Show Farcaster-specific error message
    return <div className="text-red-500">{farcasterError}</div>;
  }
  // Show generic error message
  return <div className="text-red-500">{error}</div>;
}
```

## 🧪 Testing

### Run Integration Test

```bash
node scripts/test-farcaster-integration.js
```

### Manual Testing

1. **Farcaster Environment Detection**
   - Open the app in a Farcaster frame
   - Verify `isFarcaster` is `true`
   - Check that Farcaster UI components are visible

2. **Wallet Connection**
   - Click "Connect Farcaster Wallet" button
   - Verify wallet connects automatically if address is in context
   - Test fallback to regular wallet connection

3. **Webhook Testing**
   - Send test events to `/api/farcaster-webhook`
   - Verify proper event handling and logging

4. **Error Handling**
   - Test various error scenarios
   - Verify Farcaster-specific error messages appear

## 📊 Analytics

The integration includes comprehensive logging for:

- Farcaster user detection and context
- Wallet connection attempts and successes
- Button clicks and user interactions
- Error conditions and recovery

## 🎨 Styling Guide

### Farcaster Color Palette

```css
/* Primary Farcaster purple */
.bg-purple-500 { background-color: #8B5CF6; }
.text-purple-500 { color: #8B5CF6; }

/* Farcaster accent colors */
.bg-purple-600 { background-color: #7C3AED; }
.text-purple-600 { color: #7C3AED; }

/* Light Farcaster background */
.bg-purple-50 { background-color: #F5F3FF; }
```

### Component Styling

Use these classes for Farcaster-specific components:

```jsx
<div className="farcaster-user-info bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mb-4">
  {/* Farcaster content */}
</div>

<button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg">
  Farcaster Action
</button>
```

## 🔮 Future Enhancements

Consider adding:

1. **Farcaster Frame Navigation** - Multi-step frames with navigation
2. **Farcaster Notifications** - Push notifications for important events
3. **Farcaster Social Features** - Share portfolio updates to Farcaster
4. **Farcaster Analytics Dashboard** - Track user engagement and metrics
5. **Farcaster Deep Links** - Direct links to specific app sections

## 📚 Resources

- [Farcaster Mini App Documentation](https://docs.farcaster.xyz/mini-apps)
- [Farcaster SDK Reference](https://github.com/farcasterxyz/miniapp-sdk)
- [Farcaster Frame Standards](https://docs.farcaster.xyz/frames)

## 🤝 Support

For issues or questions about the Farcaster integration:

- Check the Farcaster SDK documentation
- Review the test script output for configuration issues
- Consult the Farcaster developer community
- File issues in the project repository

---

**Last Updated:** 2026
**Farcaster SDK Version:** 0.2.1
**Standards Compliance:** Farcaster Mini App 2026 Standards