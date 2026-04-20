#!/usr/bin/env bash
# Sync backend to EC2 and restart PM2. Usage: ./deploy-backend-to-ec2.sh [PUBLIC_IP]
# Optional: DEPLOY_PUSH_ENV=1 uploads backend/.env and rewrites localhost URLs to http://<PUBLIC_IP>;
# NODE_ENV is switched to production.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/.deploy"

PUB="${1:-}"
if [[ -z "$PUB" && -f "$DEPLOY_DIR/last-public-ip" ]]; then
  PUB=$(cat "$DEPLOY_DIR/last-public-ip")
fi
if [[ -z "$PUB" ]]; then
  echo "Usage: $0 <ec2-public-ip>"
  exit 1
fi

KEY_FILE="${SSH_KEY_FILE:-}"
if [[ -z "$KEY_FILE" && -f "$DEPLOY_DIR/last-key-file" ]]; then
  KEY_FILE=$(cat "$DEPLOY_DIR/last-key-file")
fi
if [[ -z "$KEY_FILE" || ! -f "$KEY_FILE" ]]; then
  echo "Set SSH_KEY_FILE to your .pem or run deploy/bootstrap-ec2.sh first."
  exit 1
fi

RSYNC_OPTS=( -avz --delete -e "ssh -i $KEY_FILE -o StrictHostKeyChecking=accept-new" )

rsync "${RSYNC_OPTS[@]}" \
  --exclude node_modules \
  --exclude .env \
  --exclude .claude \
  --exclude logs \
  --exclude '*.log' \
  "$REPO_ROOT/backend/" "ec2-user@$PUB:/opt/govindji/backend/"

# Push local backend/.env to the instance (rsync excludes .env). Rewrites localhost URLs to this host.
if [[ "${DEPLOY_PUSH_ENV:-}" == "1" ]]; then
  if [[ ! -f "$REPO_ROOT/backend/.env" ]]; then
    echo "DEPLOY_PUSH_ENV=1 but $REPO_ROOT/backend/.env not found." >&2
    exit 1
  fi
  echo "Syncing .env to ec2-user@$PUB (localhost -> http://$PUB, NODE_ENV=production)..."
  sed \
    -e "s|http://localhost:3000|http://$PUB|g" \
    -e "s|http://localhost:3001|http://$PUB|g" \
    -e "s|^NODE_ENV=development|NODE_ENV=production|" \
    "$REPO_ROOT/backend/.env" \
    | ssh -i "$KEY_FILE" -o StrictHostKeyChecking=accept-new "ec2-user@$PUB" \
        "cat > /opt/govindji/backend/.env && chmod 600 /opt/govindji/backend/.env"
fi

ssh -i "$KEY_FILE" -o StrictHostKeyChecking=accept-new "ec2-user@$PUB" bash -s <<REMOTE
set -e
cd /opt/govindji/backend
npm ci --omit=dev
if [[ ! -f .env ]]; then
  echo "WARNING: /opt/govindji/backend/.env is missing — create it from your local backend/.env"
fi
pm2 delete govindji-api 2>/dev/null || true
pm2 start server.js --name govindji-api
pm2 save
REMOTE

echo "Backend deployed to http://$PUB"
echo "If API fails, set FRONTEND_URL / BASE_URL / CLIENT_URL in server .env to http://$PUB and: ssh ... 'cd /opt/govindji/backend && pm2 restart govindji-api'"
