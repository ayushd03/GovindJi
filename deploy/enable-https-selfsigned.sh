#!/usr/bin/env bash
# Self-signed TLS for the EC2 public IP. Browsers show a warning until you use a domain + Let's Encrypt.
# Usage: ./enable-https-selfsigned.sh <public-ipv4> [path-to-key.pem]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PUB_IP="${1:?usage: $0 <public-ipv4> [key.pem]}"
KEY_FILE="${2:-}"
if [[ -z "$KEY_FILE" && -f "$REPO_ROOT/.deploy/last-key-file" ]]; then
  KEY_FILE=$(cat "$REPO_ROOT/.deploy/last-key-file")
fi
[[ -f "$KEY_FILE" ]] || { echo "Set key path or run bootstrap-ec2.sh first." >&2; exit 1; }

ssh -i "$KEY_FILE" -o StrictHostKeyChecking=accept-new "ec2-user@$PUB_IP" \
  env PUB_IP="$PUB_IP" bash -s <<'REMOTE'
export PUB_IP="$PUB_IP"
set -e
sudo mkdir -p /etc/pki/nginx/private
sudo openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout /etc/pki/nginx/private/govindji.key \
  -out /etc/pki/nginx/govindji.crt \
  -subj "/CN=${PUB_IP}" \
  -addext "subjectAltName=IP:${PUB_IP}"
sudo chmod 600 /etc/pki/nginx/private/govindji.key

sudo tee /etc/nginx/conf.d/govindji.conf >/dev/null <<'NGX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;
    ssl_certificate /etc/pki/nginx/govindji.crt;
    ssl_certificate_key /etc/pki/nginx/private/govindji.key;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_protocols TLSv1.2 TLSv1.3;
    root /var/www/govindji;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        client_max_body_size 200M;
        proxy_read_timeout 300s;
    }
    location /product-images/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        client_max_body_size 200M;
    }
    location /category-images/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        client_max_body_size 200M;
    }
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        client_max_body_size 200M;
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGX

sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak.selfsigned
sudo python3 <<'PY'
from pathlib import Path
p = Path("/etc/nginx/nginx.conf")
lines = p.read_text().splitlines(True)
out, i = [], 0
while i < len(lines):
    line = lines[i]
    if line.strip() == "server {" and i + 1 < len(lines) and "listen       80;" in lines[i + 1]:
        depth = 0
        while i < len(lines):
            l = lines[i]
            depth += l.count("{") - l.count("}")
            out.append("# " + l if l.strip() else l)
            i += 1
            if depth == 0:
                break
        continue
    out.append(line)
    i += 1
p.write_text("".join(out))
PY
sudo nginx -t
sudo systemctl reload nginx
echo "OK: https://$PUB_IP/"
REMOTE

echo "Set FRONTEND_URL, BASE_URL, CLIENT_URL on the server to https://$PUB_IP if you have not already."
