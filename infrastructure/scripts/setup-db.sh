#!/usr/bin/env bash
# Devlog PostgreSQL Database Initialization Script
# Prepares the PostgreSQL role and database for Devlog on the local host.
# Requires DEVLOG_DB_PASSWORD passed as a runtime environment variable.
# This script does not create tables or run migrations; Prisma handles schema creation.

set -euo pipefail

# Verify root or sudo execution to administer local PostgreSQL
if [ "${EUID}" -ne 0 ]; then
  echo "[Error] This script must be run as root or via sudo." >&2
  exit 1
fi

# Verify the required database password environment variable is supplied
if [ -z "${DEVLOG_DB_PASSWORD:-}" ]; then
  echo "[Error] DEVLOG_DB_PASSWORD environment variable is required but not set." >&2
  echo "Usage: DEVLOG_DB_PASSWORD='secure_password' sudo -E ./setup-db.sh" >&2
  exit 1
fi

echo "=== Starting Devlog Database Initialization ==="

# Check that PostgreSQL service is active and listening
if ! sudo -u postgres pg_isready -q; then
  echo "[Error] PostgreSQL service is not reachable. Ensure postgresql is running." >&2
  exit 1
fi

DB_USER="devlog"
DB_NAME="devlog"

# Escape single quotes in password for safe SQL string literal usage
SAFE_PASSWORD="${DEVLOG_DB_PASSWORD//\'/\'\'}"

# Idempotently create or update the application PostgreSQL role
echo "Configuring PostgreSQL role '${DB_USER}'..."
ROLE_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}'")
if [ "${ROLE_EXISTS}" != "1" ]; then
  echo "Creating role '${DB_USER}'..."
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOF >/dev/null
CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${SAFE_PASSWORD}';
EOF
  echo "Role '${DB_USER}' created."
else
  echo "Role '${DB_USER}' already exists. Updating password..."
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOF >/dev/null
ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${SAFE_PASSWORD}';
EOF
  echo "Role '${DB_USER}' password updated."
fi

# Idempotently create the application database if it does not already exist
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'")
if [ "${DB_EXISTS}" != "1" ]; then
  echo "Creating database '${DB_NAME}' with owner '${DB_USER}'..."
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  echo "Database '${DB_NAME}' created."
else
  echo "Database '${DB_NAME}' already exists. Preserving existing database."
fi

# Ensure role possesses all required privileges on the database and public schema
echo "Granting permissions on database '${DB_NAME}' to role '${DB_USER}'..."
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" >/dev/null

echo "=== Devlog Database Initialization Completed Successfully ==="
