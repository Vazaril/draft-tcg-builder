#!/bin/bash

set -a
source ../.env.local
set +a

BASE_URL="http://127.0.0.1:5001"

if [ -z "$TEST_ACCESS_TOKEN" ]; then
  echo "FEHLER: TEST_ACCESS_TOKEN wurde nicht gefunden."
  exit 1
fi

echo "Token wurde gefunden."

echo
echo "Health:"
curl -i "$BASE_URL/health"

echo
echo "Alle Decks:"
curl -i \
  -H "Authorization: Bearer $TEST_ACCESS_TOKEN" \
  "$BASE_URL/api/decks"

echo
echo "Deck Details:"
curl -i \
  -H "Authorization: Bearer $TEST_ACCESS_TOKEN" \
  "$BASE_URL/api/decks/e2d163fc-efc8-4aea-9255-b10db9594a5e"