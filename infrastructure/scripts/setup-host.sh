#!/usr/bin/env bash
# Devlog Host Runtime Provisioning Script
# Prepares an Ubuntu 24.04 LTS host with runtime dependencies.
# This script sets up system packages, Node.js, PostgreSQL, Redis, Nginx,
# and the unprivileged application user and directory structure.
# Application code, database schemas, and service files are deferred to later steps.

set -euo pipefail

# Ensure the script runs with root privileges
if [ "${EUID}" -ne 0 ]; then
  echo "[Error] This script must be run as root or via sudo." >&2
  exit 1
fi

echo "=== Starting Devlog Host Runtime Provisioning ==="

# 1. Update system package index and install foundational utilities
echo "[1/6] Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  git

# 2. Install Node.js 20 LTS via NodeSource repository
echo "[2/6] Configuring Node.js 20 LTS..."
if command -v node >/dev/null 2>&1 && node -v | grep -q "^v20\."; then
  echo "Node.js $(node -v) is already installed."
else
  echo "Adding NodeSource Node.js 20 repository..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  echo "Installed Node.js $(node -v) and npm $(npm -v)."
fi

# 3. Install PostgreSQL
echo "[3/6] Installing PostgreSQL from Ubuntu repositories..."
apt-get install -y postgresql postgresql-contrib
systemctl enable --now postgresql
echo "PostgreSQL service is enabled and active."

# 4. Install Redis
echo "[4/6] Installing Redis server from Ubuntu repositories..."
apt-get install -y redis-server
systemctl enable --now redis-server
echo "Redis service is enabled and active."

# 5. Install Nginx
echo "[5/6] Installing Nginx web server from Ubuntu repositories..."
apt-get install -y nginx
systemctl enable --now nginx
echo "Nginx service is enabled and active."

# 6. Create unprivileged system user and application directory structure
echo "[6/6] Setting up system user and directory structure..."
APP_USER="devlog"
APP_DIR="/opt/devlog"
APP_CODE_DIR="/opt/devlog/app"

if id "${APP_USER}" >/dev/null 2>&1; then
  echo "User '${APP_USER}' already exists."
else
  useradd --system --shell /bin/bash --home-dir "${APP_DIR}" --create-home "${APP_USER}"
  echo "Created system user '${APP_USER}'."
fi

mkdir -p "${APP_CODE_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
chmod 750 "${APP_DIR}"

echo "Application directory '${APP_CODE_DIR}' ready with owner '${APP_USER}'."
echo "=== Devlog Host Runtime Provisioning Completed Successfully ==="
