# Stripe Transaction Sync Guide

## Quick Fix: Sync Stripe Transactions

### Step 1: Get Account IDs
```bash
curl -X POST http://localhost:3000/trpc/apps.getAvailableServers \
  -H "Content-Type: application/json" \
  -d '{"json":{}}' | jq '.result.data.servers[] | select(.id == "stripe") | .connection.connectionMetadata.accountIds'
```

### Step 2: Sync Transactions (replace ACCOUNT_ID with actual ID from step 1)
```bash
curl -X POST http://localhost:3000/trpc/stripe.syncAccountTransactions \
  -H "Content-Type: application/json" \
  -d '{"json":{"accountId":"ACCOUNT_ID"}}'
```

### Step 3: View Stripe Timeline Data
```bash
curl -X POST http://localhost:3000/trpc/timeline.getTimeline \
  -H "Content-Type: application/json" \
  -d '{"json":{"source":"stripe","limit":10}}' | jq '.result.data.items'
```

## Using the UI

1. **Click on Stripe** in the apps page - should navigate to `/apps/stripe`
2. **Go to Settings tab** - you'll see:
   - Connection status
   - Connected accounts (if any)
   - "Sync Transactions" button
3. **Click "Sync Transactions"** - this will fetch and store transactions
4. **Go to Home tab** - transactions will appear in the timeline

## What Was Fixed

1. ✅ App detail page now shows Stripe-specific info in Settings tab
2. ✅ Connected accounts are displayed
3. ✅ "Sync Transactions" button added
4. ✅ Empty state shows helpful message
5. ✅ Timeline automatically refreshes after sync

