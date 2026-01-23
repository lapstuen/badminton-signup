#!/bin/bash
cd "$(dirname "$0")"

PORT=8000

# Finn ledig port
while lsof -i :$PORT >/dev/null 2>&1; do
  echo "⚠️  Port $PORT er i bruk – prøver neste..."
  PORT=$((PORT + 1))
done

echo "🚀 Starter lokal server..."
echo "🌐 Åpne: http://localhost:$PORT"
echo ""
echo "⚠️  Når du kjører dette fra gTerminal, husk å krysse av for"
echo "    'Run in background' når du legger til kommandoen!"
echo ""

# Start serveren (venter på å bli avsluttet)
# Når dette kjøres fra gTerminal med "Run in background" aktivert,
# vil gTerminal håndtere bakgrunnskjøringen
python3 -m http.server $PORT
