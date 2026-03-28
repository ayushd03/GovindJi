#!/usr/bin/env bash
# Build frontend (same-origin API) and rsync app to EC2. Usage: ./deploy-to-ec2.sh [PUBLIC_IP]
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

export REACT_APP_API_URL="${REACT_APP_API_URL-}"
cd "$REPO_ROOT/frontend"
rm -rf node_modules
npm ci
# CRA fails the build on ESLint warnings when CI=true.
CI= npm run build

RSYNC_OPTS=( -avz --delete -e "ssh -i $KEY_FILE -o StrictHostKeyChecking=accept-new" )

rsync "${RSYNC_OPTS[@]}" "$REPO_ROOT/frontend/build/" "ec2-user@$PUB:/var/www/govindji/"

rsync "${RSYNC_OPTS[@]}" \
  --exclude node_modules \
  --exclude .env \
  --exclude .claude \
  --exclude logs \
  --exclude '*.log' \
  "$REPO_ROOT/backend/" "ec2-user@$PUB:/opt/govindji/backend/"

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

echo "Deployed to http://$PUB"
echo "If API fails, set FRONTEND_URL / BASE_URL / CLIENT_URL in server .env to http://$PUB and: ssh ... 'cd /opt/govindji/backend && pm2 restart govindji-api'"
