#!/usr/bin/env bash
# Set up Let's Encrypt TLS for a real domain via certbot + nginx.
# Usage: ./enable-https-letsencrypt.sh <domain> <admin-email> [path-to-key.pem]
# Example: ./enable-https-letsencrypt.sh govindjidryfruits.com admin@govindjidryfruits.com
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DOMAIN="${1:?usage: $0 <domain> <admin-email> [key.pem]}"
EMAIL="${2:?usage: $0 <domain> <admin-email> [key.pem]}"
KEY_FILE="${3:-}"
if [[ -z "$KEY_FILE" && -f "$REPO_ROOT/.deploy/last-key-file" ]]; then
  KEY_FILE=$(cat "$REPO_ROOT/.deploy/last-key-file")
fi
[[ -f "$KEY_FILE" ]] || { echo "Set key path or run bootstrap-ec2.sh first." >&2; exit 1; }

PUB_IP=""
if [[ -f "$REPO_ROOT/.deploy/last-public-ip" ]]; then
  PUB_IP=$(cat "$REPO_ROOT/.deploy/last-public-ip")
fi

echo "Setting up Let's Encrypt for $DOMAIN (email: $EMAIL)..."

ssh -i "$KEY_FILE" -o StrictHostKeyChecking=accept-new "ec2-user@$DOMAIN" \
  env DOMAIN="$DOMAIN" EMAIL="$EMAIL" bash -s <<'REMOTE'
set -e

# ── 1. Update nginx server_name to the real domain ──────────────────────────
sudo sed -i "s/server_name _;/server_name $DOMAIN www.$DOMAIN;/g" \
  /etc/nginx/conf.d/govindji.conf

# Temporarily allow HTTP so the ACME challenge works (certbot will re-add HTTPS)
sudo tee /etc/nginx/conf.d/govindji.conf >/dev/null <<NGINX
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name $DOMAIN www.$DOMAIN;
    root /var/www/govindji;
    index index.html;

    location /.well-known/acme-challenge/ { root /var/www/govindji; }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 200M;
        proxy_read_timeout 300s;
    }
    location /product-images/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        client_max_body_size 200M;
    }
    location /category-images/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        client_max_body_size 200M;
    }
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        client_max_body_size 200M;
    }
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

# Restore main nginx.conf if it was commented out by the self-signed script
if grep -q '^# .*listen.*80' /etc/nginx/nginx.conf 2>/dev/null; then
  sudo cp /etc/nginx/nginx.conf.bak.selfsigned /etc/nginx/nginx.conf 2>/dev/null || true
fi

sudo nginx -t
sudo systemctl reload nginx

# ── 2. Install certbot ───────────────────────────────────────────────────────
if ! command -v certbot &>/dev/null; then
  sudo dnf install -y python3-certbot-nginx 2>/dev/null || \
  sudo pip3 install --quiet certbot certbot-nginx
fi

# ── 3. Obtain certificate ────────────────────────────────────────────────────
sudo certbot --nginx \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --non-interactive --agree-tos \
  --email "$EMAIL" \
  --redirect

# ── 4. Auto-renewal cron (certbot installs a timer; add fallback cron too) ──
(sudo crontab -l 2>/dev/null | grep -v certbot; \
 echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") \
 | sudo crontab -

# ── 5. Update backend .env URLs ──────────────────────────────────────────────
ENV_FILE=/opt/govindji/backend/.env
if [[ -f "$ENV_FILE" ]]; then
  sudo sed -i \
    -e "s|^FRONTEND_URL=.*|FRONTEND_URL=https://$DOMAIN|" \
    -e "s|^BASE_URL=.*|BASE_URL=https://$DOMAIN|" \
    -e "s|^CLIENT_URL=.*|CLIENT_URL=https://$DOMAIN|" \
    -e "s|^BACKEND_URL=.*|BACKEND_URL=https://$DOMAIN|" \
    -e "s|^NODE_ENV=.*|NODE_ENV=production|" \
    "$ENV_FILE"
  echo "Updated $ENV_FILE"
  pm2 restart govindji-api
else
  echo "WARNING: $ENV_FILE not found — create it with the correct URLs."
fi

echo ""
echo "Done! Site is live at https://$DOMAIN"
REMOTE

echo ""
echo "Certificate installed. Visit https://$DOMAIN"
echo "Renewal is automatic via cron (runs daily at 3am)."
