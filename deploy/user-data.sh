#!/bin/bash
set -ex
export DEBIAN_FRONTEND=noninteractive

dnf update -y -q
# Do not install full "curl" — it conflicts with curl-minimal on AL2023.
dnf install -y nginx git

if [ -f /etc/nginx/conf.d/default.conf ]; then
  mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak
fi

curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs
npm install -g pm2

mkdir -p /var/www/govindji
mkdir -p /opt/govindji/backend

cat >/etc/nginx/conf.d/govindji.conf <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root /var/www/govindji;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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
NGINX

nginx -t
systemctl enable nginx
systemctl restart nginx

chown -R ec2-user:ec2-user /var/www/govindji /opt/govindji

echo '<html><head><title>Govind Ji Dry Fruits</title></head><body><h1>Server is ready</h1><p>Deploy the app from your laptop with <code>./deploy/deploy-to-ec2.sh</code> and copy <code>.env</code> to the instance.</p></body></html>' >/var/www/govindji/index.html
