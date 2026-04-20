#!/usr/bin/env bash
# Build frontend and rsync static files to EC2. Usage: ./deploy-frontend-to-ec2.sh [PUBLIC_IP]
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

echo "Frontend deployed to http://$PUB"
