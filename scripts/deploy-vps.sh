#!/usr/bin/env bash
# =============================================================================
# Resolvaio — VPS Deployment Script (PM2 + Nginx, no Docker)
#
# Matches existing VPS setup: PM2 for app, Nginx for reverse proxy, Redis via apt.
# Resolvaio runs on port 3003 (3001=foundrvideo, 3002=synqall).
#
# Usage on VPS:
#   cd /var/www/resolvaio
#   bash scripts/deploy-vps.sh
# =============================================================================

set -euo pipefail

APP_DIR="/var/www/resolvaio"
PORT=3003
WORKER_NAME="resolvaio-worker"
APP_NAME="resolvaio"
DOMAIN="resolvaio.com"

echo ""
echo "-----------------------------------------"
echo "  Resolvaio — VPS Deployment"
echo "-----------------------------------------"
echo ""

# ------------------------------------------------------------------
# Pre-flight check
# ------------------------------------------------------------------
if [ ! -f "$APP_DIR/.env.local" ]; then
  echo "ERROR: .env.local not found!"
  echo ""
  echo "Create it first:"
  echo "  nano $APP_DIR/.env.local"
  echo ""
  echo "Paste your production environment variables, then re-run this script."
  exit 1
fi

# ------------------------------------------------------------------
# 1. Install pnpm if not present
# ------------------------------------------------------------------
if ! command -v pnpm &>/dev/null; then
  echo "[1/7] Installing pnpm..."
  npm install -g pnpm
else
  echo "[1/7] pnpm already installed: $(pnpm -v)"
fi

# ------------------------------------------------------------------
# 2. Install Redis if not present
# ------------------------------------------------------------------
if ! command -v redis-server &>/dev/null; then
  echo "[2/7] Installing Redis..."
  apt-get update -qq
  apt-get install -y redis-server

  # Read the Redis password from .env.local
  REDIS_PW=$(grep '^REDIS_PASSWORD=' "$APP_DIR/.env.local" | cut -d'=' -f2-)

  if [ -n "$REDIS_PW" ]; then
    # Set password in Redis config
    sed -i "s/^# requirepass .*/requirepass $REDIS_PW/" /etc/redis/redis.conf
    sed -i "s/^requirepass .*/requirepass $REDIS_PW/" /etc/redis/redis.conf

    # If requirepass line doesn't exist at all, add it
    if ! grep -q "^requirepass" /etc/redis/redis.conf; then
      echo "requirepass $REDIS_PW" >> /etc/redis/redis.conf
    fi
  fi

  # Bind to localhost only
  sed -i 's/^bind .*/bind 127.0.0.1/' /etc/redis/redis.conf

  systemctl enable redis-server
  systemctl restart redis-server
  echo "  Redis installed and configured."
else
  echo "[2/7] Redis already installed: $(redis-server --version | head -1)"
fi

# ------------------------------------------------------------------
# 3. Install dependencies
# ------------------------------------------------------------------
echo "[3/7] Installing Node dependencies..."
cd "$APP_DIR"
pnpm install --frozen-lockfile --prod=false

# ------------------------------------------------------------------
# 4. Build the Next.js app
# ------------------------------------------------------------------
echo "[4/7] Building Next.js app..."
cd "$APP_DIR"

# Load env vars for the build (NEXT_PUBLIC_* vars are baked in at build time)
set -a
source "$APP_DIR/.env.local"
set +a

pnpm build

# ------------------------------------------------------------------
# 5. Bundle the worker (same as Dockerfile does, but locally)
# ------------------------------------------------------------------
echo "[5/7] Bundling worker..."
npx esbuild src/workers/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=cjs \
  --outfile="$APP_DIR/worker.js" \
  --external:bullmq \
  --external:ioredis \
  --external:openai \
  --external:resend \
  --packages=external

# ------------------------------------------------------------------
# 6. Set up PM2 processes
# ------------------------------------------------------------------
echo "[6/7] Configuring PM2..."

# Write PM2 ecosystem file
cat > "$APP_DIR/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [
    {
      name: '$APP_NAME',
      script: 'node_modules/.bin/next',
      args: 'start -p $PORT',
      cwd: '$APP_DIR',
      env_file: '$APP_DIR/.env.local',
      env: {
        NODE_ENV: 'production',
        PORT: '$PORT',
      },
      max_memory_restart: '1G',
      instances: 1,
      autorestart: true,
    },
    {
      name: '$WORKER_NAME',
      script: '$APP_DIR/worker.js',
      cwd: '$APP_DIR',
      env_file: '$APP_DIR/.env.local',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      instances: 1,
      autorestart: true,
    },
  ],
};
EOF

# Stop existing resolvaio processes if running
pm2 delete "$APP_NAME" 2>/dev/null || true
pm2 delete "$WORKER_NAME" 2>/dev/null || true

# Start both processes
pm2 start "$APP_DIR/ecosystem.config.cjs"
pm2 save

echo "  PM2 processes started."

# ------------------------------------------------------------------
# 7. Set up Nginx
# ------------------------------------------------------------------
echo "[7/7] Configuring Nginx..."

cat > /etc/nginx/sites-available/resolvaio <<NGINX
# Resolvaio — resolvaio.com + app.resolvaio.com → port $PORT
server {
    listen 80;
    server_name resolvaio.com www.resolvaio.com app.resolvaio.com;

    client_max_body_size 15M;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120s;
    }
}
NGINX

# Enable the site (won't affect existing foundrvideo/synqall configs)
ln -sf /etc/nginx/sites-available/resolvaio /etc/nginx/sites-enabled/resolvaio

# Test and reload
if nginx -t 2>/dev/null; then
  nginx -s reload
  echo "  Nginx configured and reloaded."
else
  echo "  WARNING: Nginx config test failed. Check with: nginx -t"
fi

# ------------------------------------------------------------------
# Done
# ------------------------------------------------------------------
echo ""
echo "-----------------------------------------"
echo "  Deployment complete!"
echo "-----------------------------------------"
echo ""
echo "  App:    http://127.0.0.1:$PORT (PM2: $APP_NAME)"
echo "  Worker: PM2: $WORKER_NAME"
echo "  Redis:  127.0.0.1:6379"
echo ""
echo "  PM2 status:  pm2 list"
echo "  App logs:    pm2 logs $APP_NAME"
echo "  Worker logs: pm2 logs $WORKER_NAME"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Get SSL (once DNS propagates):"
echo "     certbot --nginx -d resolvaio.com -d www.resolvaio.com -d app.resolvaio.com"
echo ""
echo "  2. Update REDIS_URL in .env.local to use localhost:"
echo "     REDIS_URL=redis://:YOUR_PASSWORD@127.0.0.1:6379"
echo "     (not redis:6379 — that was for Docker networking)"
echo ""
echo "  3. Test:"
echo "     curl -I http://127.0.0.1:$PORT"
echo "     curl -I https://resolvaio.com"
echo ""
echo "  4. Set Paddle webhook URL to:"
echo "     https://app.resolvaio.com/api/webhooks/paddle"
echo ""
