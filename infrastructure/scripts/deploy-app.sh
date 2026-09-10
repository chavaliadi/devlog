#!/usr/bin/env bash
# Devlog Application Deployment Script
# Automates deployment and updates for Devlog on Ubuntu 24.04 LTS.
# Clones or updates source code into /opt/devlog/app,
# installs dependencies, builds backend and frontend,
# synchronizes Prisma database schema, configures systemd and Nginx,
# restarts services, and verifies local health.

set -euo pipefail

# 1. Privilege check
if [ "${EUID}" -ne 0 ]; then
  echo "[Error] This script must be run as root or via sudo." >&2
  exit 1
fi

echo "=== Starting Devlog Application Deployment ==="

# Directory and service path configuration
APP_USER="devlog"
APP_DIR="/opt/devlog/app"
ENV_FILE="/etc/devlog/devlog.env"
SYSTEMD_SOURCE="${APP_DIR}/infrastructure/scripts/systemd/devlog-backend.service"
SYSTEMD_TARGET="/etc/systemd/system/devlog-backend.service"
NGINX_SOURCE="${APP_DIR}/infrastructure/scripts/nginx/devlog.conf"
NGINX_AVAILABLE="/etc/nginx/sites-available/devlog"
NGINX_ENABLED="/etc/nginx/sites-enabled/devlog"
NGINX_DEFAULT_ENABLED="/etc/nginx/sites-enabled/default"

# Repository source configuration
DEVLOG_REPOSITORY_URL="${DEVLOG_REPOSITORY_URL:-https://github.com/chavaliadi/devlog.git}"
DEVLOG_BRANCH="${DEVLOG_BRANCH:-main}"

# 2. Runtime environment verification
echo "[1/10] Verifying runtime environment configuration..."
if [ ! -f "${ENV_FILE}" ]; then
  echo "[Error] Runtime environment file '${ENV_FILE}' was not found." >&2
  echo "Production deployment requires runtime configuration and secrets in '${ENV_FILE}'." >&2
  echo "Create the file with appropriate keys before running deployment." >&2
  exit 1
fi

if ! grep -q "^[[:space:]]*DATABASE_URL=" "${ENV_FILE}"; then
  echo "[Error] DATABASE_URL is required but not defined in '${ENV_FILE}'." >&2
  exit 1
fi

# Stop backend service if currently running before modifying runtime files
if systemctl is-active --quiet devlog-backend.service 2>/dev/null; then
  echo "Stopping active devlog-backend service before updating application files..."
  systemctl stop devlog-backend.service
fi

# 3. Source code deployment and update
echo "[2/10] Deploying application source into ${APP_DIR}..."
mkdir -p /opt/devlog
git config --system --add safe.directory "${APP_DIR}" || true

if [ ! -d "${APP_DIR}/.git" ]; then
  if [ -d "${APP_DIR}" ] && [ -n "$(ls -A "${APP_DIR}" 2>/dev/null)" ]; then
    echo "[Error] Target directory '${APP_DIR}' exists and is not empty, but is not a git repository." >&2
    exit 1
  fi
  echo "Cloning branch '${DEVLOG_BRANCH}' from repository..."
  git clone --branch "${DEVLOG_BRANCH}" "${DEVLOG_REPOSITORY_URL}" "${APP_DIR}"
else
  echo "Updating existing repository at '${APP_DIR}'..."
  git -C "${APP_DIR}" remote set-url origin "${DEVLOG_REPOSITORY_URL}"
  git -C "${APP_DIR}" fetch origin "${DEVLOG_BRANCH}"
  git -C "${APP_DIR}" checkout "${DEVLOG_BRANCH}"
  git -C "${APP_DIR}" reset --hard "origin/${DEVLOG_BRANCH}"
fi

chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

# 4. Install backend dependencies
echo "[3/10] Installing backend dependencies..."
if [ -f "${APP_DIR}/backend/package-lock.json" ]; then
  sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}/backend' && npm ci"
else
  sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}/backend' && npm install"
fi

# 5. Install frontend dependencies
echo "[4/10] Installing frontend dependencies..."
if [ -f "${APP_DIR}/frontend/package-lock.json" ]; then
  sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}/frontend' && npm ci"
else
  sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}/frontend' && npm install"
fi

# 6. Build backend
echo "[5/10] Building backend service..."
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}/backend' && ./node_modules/.bin/prisma generate"
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}/backend' && npm run build"

BACKEND_ENTRY="${APP_DIR}/backend/dist/index.js"
if [ ! -f "${BACKEND_ENTRY}" ]; then
  echo "[Error] Backend compiled entry point '${BACKEND_ENTRY}' was not generated." >&2
  exit 1
fi
echo "Verified backend production entry point: ${BACKEND_ENTRY}"

# 7. Build frontend
echo "[6/10] Building frontend static assets..."
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}/frontend' && npm run build"

FRONTEND_ENTRY="${APP_DIR}/frontend/dist/index.html"
if [ ! -f "${FRONTEND_ENTRY}" ]; then
  echo "[Error] Frontend static output '${FRONTEND_ENTRY}' was not generated." >&2
  exit 1
fi
echo "Verified frontend production output: ${FRONTEND_ENTRY}"

# 8. Synchronize Prisma database schema
echo "[7/10] Synchronizing Prisma database schema..."
DATABASE_URL_VAL=$(grep -E '^[[:space:]]*DATABASE_URL=' "${ENV_FILE}" | head -n 1 | cut -d '=' -f 2- | sed -e 's/^[[:space:]]*["'"'"']//' -e 's/["'"'"'][[:space:]]*$//')
sudo -u "${APP_USER}" DATABASE_URL="${DATABASE_URL_VAL}" bash -c "cd '${APP_DIR}/backend' && ./node_modules/.bin/prisma db push --skip-generate"
echo "Prisma database schema synchronized successfully."

# 9. Configure and activate systemd service
echo "[8/10] Configuring systemd backend service..."
if [ ! -f "${SYSTEMD_SOURCE}" ]; then
  echo "[Error] Systemd service file '${SYSTEMD_SOURCE}' was not found in application source." >&2
  exit 1
fi

mkdir -p /etc/systemd/system
cp "${SYSTEMD_SOURCE}" "${SYSTEMD_TARGET}"
chmod 644 "${SYSTEMD_TARGET}"

if command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload
  systemctl enable devlog-backend.service
  systemctl restart devlog-backend.service
  echo "devlog-backend service restarted."
else
  echo "[Notice] systemctl not found; skipped service daemon-reload and restart."
fi

# 10. Configure and activate Nginx
echo "[9/10] Configuring Nginx reverse proxy..."
if [ ! -f "${NGINX_SOURCE}" ]; then
  echo "[Error] Nginx site configuration '${NGINX_SOURCE}' was not found in application source." >&2
  exit 1
fi

mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
cp "${NGINX_SOURCE}" "${NGINX_AVAILABLE}"
chmod 644 "${NGINX_AVAILABLE}"
ln -sf "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"

if [ -L "${NGINX_DEFAULT_ENABLED}" ]; then
  echo "Disabling default Nginx site link to prevent port 80 conflicts..."
  rm -f "${NGINX_DEFAULT_ENABLED}"
fi

if command -v nginx >/dev/null 2>&1; then
  echo "Validating Nginx configuration syntax..."
  nginx -t
  if command -v systemctl >/dev/null 2>&1; then
    systemctl reload nginx
    echo "Nginx reloaded successfully."
  fi
else
  echo "[Notice] nginx not found; skipped configuration test and reload."
fi

# 11. Deployment verification
echo "[10/10] Verifying deployment health..."

if command -v systemctl >/dev/null 2>&1; then
  if ! systemctl is-active --quiet devlog-backend.service; then
    echo "[Error] devlog-backend service is not active after restart." >&2
    echo "Inspect logs with: journalctl -u devlog-backend -n 50 --no-pager" >&2
    exit 1
  fi
  echo "Backend systemd service is active."
fi

if command -v curl >/dev/null 2>&1; then
  echo "Checking backend health at http://127.0.0.1:5005/health..."
  HEALTH_SUCCESS=false
  for i in {1..15}; do
    if curl -fsS http://127.0.0.1:5005/health >/dev/null 2>&1; then
      HEALTH_SUCCESS=true
      break
    fi
    sleep 2
  done

  if [ "${HEALTH_SUCCESS}" != "true" ]; then
    echo "[Error] Backend health check failed at http://127.0.0.1:5005/health." >&2
    echo "Inspect logs with: journalctl -u devlog-backend -n 50 --no-pager" >&2
    exit 1
  fi
  echo "Backend health check passed."

  if curl -fsS http://127.0.0.1/health >/dev/null 2>&1; then
    echo "Nginx reverse proxy health route verified at http://127.0.0.1/health."
  fi

  if curl -fsS http://127.0.0.1/ >/dev/null 2>&1; then
    echo "Nginx frontend static routing verified at http://127.0.0.1/."
  fi
fi

echo "=== Devlog Application Deployment Completed Successfully ==="
