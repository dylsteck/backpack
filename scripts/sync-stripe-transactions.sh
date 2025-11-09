#!/bin/bash

# Script to sync Stripe transactions and show data

echo "🔍 Checking Stripe connection..."
API_RESPONSE=$(curl -s -X POST http://localhost:3000/trpc/apps.getAvailableServers \
  -H "Content-Type: application/json" \
  -d '{"json":{}}')

STRIPE_DATA=$(echo "$API_RESPONSE" | jq '.result.data.servers[] | select(.id == "stripe")')

if [ -z "$STRIPE_DATA" ] || [ "$STRIPE_DATA" == "null" ]; then
  echo "❌ Stripe app not found"
  echo "Available apps:"
  echo "$API_RESPONSE" | jq -r '.result.data.servers[].id' | head -5
  exit 1
fi

CONNECTION_STATUS=$(echo "$STRIPE_DATA" | jq -r '.connection.status // "disconnected"')

if [ "$CONNECTION_STATUS" != "connected" ]; then
  echo "❌ Stripe is not connected (status: $CONNECTION_STATUS)"
  exit 1
fi

echo "✅ Stripe connection found (status: $CONNECTION_STATUS)"
echo ""

# Get account IDs
ACCOUNT_IDS=$(echo "$STRIPE_DATA" | jq -r '.connection.connectionMetadata.accountIds[]?' 2>/dev/null)

if [ -z "$ACCOUNT_IDS" ]; then
  echo "❌ No account IDs found in connection metadata"
  echo "Connection data:"
  echo "$STRIPE_DATA" | jq '.connection.connectionMetadata'
  exit 1
fi

echo "📋 Found account IDs:"
echo "$ACCOUNT_IDS" | while read -r account_id; do
  echo "  - $account_id"
done
echo ""

# Sync transactions for each account
SYNCED_TOTAL=0
for account_id in $ACCOUNT_IDS; do
  echo "🔄 Syncing transactions for account: $account_id"
  SYNC_RESULT=$(curl -s -X POST http://localhost:3000/trpc/stripe.syncAccountTransactions \
    -H "Content-Type: application/json" \
    -d "{\"json\":{\"accountId\":\"$account_id\"}}")
  
  SYNCED=$(echo "$SYNC_RESULT" | jq -r '.result.data.transactions_synced // 0')
  TOTAL=$(echo "$SYNC_RESULT" | jq -r '.result.data.total_fetched // 0')
  
  echo "  ✅ Synced $SYNCED new transactions (total fetched: $TOTAL)"
  SYNCED_TOTAL=$((SYNCED_TOTAL + SYNCED))
done

echo ""
echo "✨ Total synced: $SYNCED_TOTAL transactions"
echo ""

# Show timeline data
echo "📊 Fetching Stripe timeline data..."
TIMELINE=$(curl -s -X POST http://localhost:3000/trpc/timeline.getTimeline \
  -H "Content-Type: application/json" \
  -d '{"json":{"source":"stripe","limit":10}}')

STRIPE_COUNT=$(echo "$TIMELINE" | jq '.result.data.items | length')
echo "Found $STRIPE_COUNT Stripe transactions in timeline"
echo ""

if [ "$STRIPE_COUNT" -gt 0 ]; then
  echo "📝 Sample transactions:"
  echo "$TIMELINE" | jq -r '.result.data.items[0:3][] | "  - \(.data.description // "N/A") | \(.data.amount/100) \(.data.currency) | \(.timestamp)"'
else
  echo "⚠️  No transactions found. Make sure:"
  echo "  1. Your Stripe account has transaction data"
  echo "  2. The accounts are properly connected"
  echo "  3. Try syncing again"
fi

