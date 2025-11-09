#!/bin/bash

# Test script to debug Stripe transaction sync
# This script tests the tRPC endpoint and shows what's happening

ACCOUNT_ID="fca_1SRfinIwGNu0FUmM9v7LGuB3"

echo "🔍 Testing Stripe Transaction Sync"
echo "Account ID: $ACCOUNT_ID"
echo ""

echo "📋 Step 1: Check if account exists in connections..."
curl -s "http://localhost:3000/trpc/apps.getAvailableServers" | \
  jq -r '.result.data.servers[] | select(.id == "stripe") | .connection.connectionMetadata.accountIds[]?' | \
  head -2

echo ""
echo "📋 Step 2: Testing tRPC mutation (check server logs for actual Stripe API errors)..."
echo ""

# Try the mutation - the JSON format might be the issue
# tRPC mutations typically need the input wrapped properly
RESPONSE=$(curl -s -X POST "http://localhost:3000/trpc/stripe.syncAccountTransactions" \
  -H "Content-Type: application/json" \
  -d "{\"json\":{\"accountId\":\"$ACCOUNT_ID\"}}")

echo "Response:"
echo "$RESPONSE" | jq '.'

echo ""
echo "💡 If you see 'accountId: received undefined', check:"
echo "   1. Server console logs for actual Stripe API errors"
echo "   2. The tRPC request format"
echo ""
echo "📝 To test Stripe API directly, run:"
echo "   cd apps/server && node -e \"const Stripe=require('stripe');require('dotenv/config');const s=new Stripe(process.env.STRIPE_SECRET_KEY,{apiVersion:'2025-02-24.acacia'});s.financialConnections.accounts.retrieve('$ACCOUNT_ID').then(a=>console.log('Account:',JSON.stringify({id:a.id,transaction_refresh:a.transaction_refresh},null,2))).catch(e=>console.error('Error:',e.message))\""

