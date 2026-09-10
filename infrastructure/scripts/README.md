# Devlog Host Runtime Provisioning and Application Deployment

## Purpose of the Deployment and Runtime Layer

This directory contains host preparation, database initialization, application deployment automation, and service configuration templates for Devlog.
The runtime and deployment layer bridges cloud infrastructure provisioned by Terraform and the running application.
It establishes the operating system environment, local database, application source code builds, and service definitions without coupling application details into Terraform.

## Required Execution Lifecycle

The deployment process follows a strict sequential lifecycle:

```
Terraform apply
       │
       ▼
EC2 available through SSM
       │
       ▼
setup-host.sh
       │
       ▼
setup-db.sh
       │
       ▼
configure /etc/devlog/devlog.env
       │
       ▼
deploy-app.sh
       │
       ▼
public HTTP verification
```

1. **Step 1: Terraform Infrastructure Provisioning**
   Provisions VPC, public subnet, Internet Gateway, route table, security group allowing TCP port 80 ingress, IAM role with SSM policy, instance profile, and Ubuntu 24.04 EC2 compute instance.
2. **Step 2: Host Runtime Preparation (`setup-host.sh`)**
   Installs Node.js 20 LTS, PostgreSQL 16, Redis, and Nginx. Creates the unprivileged system user `devlog` and root directory `/opt/devlog/app`.
3. **Step 3: Database Initialization (`setup-db.sh`)**
   Executes locally on the host. Requires `DEVLOG_DB_PASSWORD` to create the `devlog` PostgreSQL user and database idempotently.
4. **Step 4: Runtime Environment Configuration**
   Operator creates `/etc/devlog/devlog.env` (permissions 0600) with production secrets and connection strings.
5. **Step 5: Application Deployment (`deploy-app.sh`)**
   Clones or updates repository source code in `/opt/devlog/app`, installs dependencies via `npm ci`, compiles backend TypeScript, generates Prisma client, bundles frontend static assets, synchronizes Prisma schema, configures systemd and Nginx, restarts services, and verifies local health.
6. **Step 6: Public HTTP Verification**
   Verifies public reachability over HTTP port 80 through Nginx.

## Deployment Prerequisites

Before running `deploy-app.sh` on the EC2 host:
* The host runtime must be prepared by running `setup-host.sh` as root.
* The local PostgreSQL database must be initialized by running `setup-db.sh` as root with `DEVLOG_DB_PASSWORD`.
* Redis service must be active and listening on `127.0.0.1:6379`.
* The production environment file `/etc/devlog/devlog.env` must exist with permissions `0600` and contain `DATABASE_URL`, `PORT=5005`, and application secrets.

## Public Access and Security Boundaries

Publicly accessible:
* HTTP port 80 (directed to Nginx reverse proxy)

Not publicly accessible:
* SSH port 22 (closed; administrative access is via AWS Systems Manager)
* HTTPS port 443 (closed; not yet configured for this MVP stage)
* Express backend port 5005 (closed; loopback only behind Nginx)
* PostgreSQL port 5432 and alternate 5435 (closed; loopback only on localhost)
* Redis port 6379 (closed; loopback only on localhost)

HTTP is intentionally used only for this infrastructure stage.
HTTPS and TLS will be added later as a separate phase.

Application traffic flow:

```
Public Internet
      │
      ▼
   Nginx :80
      │
      ├── React Static Files (/opt/devlog/app/frontend/dist)
      │
      └── Express :5005 (127.0.0.1:5005)
                │
                ├── PostgreSQL localhost:5432
                └── Redis localhost:6379
```

## Script Inventory and Responsibilities

### 1. `setup-host.sh` (Host Preparation)
Prepares the Ubuntu 24.04 LTS host with foundational system dependencies:
* Updates Ubuntu package catalogs and installs utility packages (`ca-certificates`, `curl`, `gnupg`, `git`).
* Installs Node.js 20 LTS using the NodeSource Debian package repository to ensure a consistent Node.js 20 package stream on Ubuntu.
* Installs PostgreSQL 16 and Redis server from official Ubuntu repositories and enables their systemd services.
* Installs Nginx web server and enables the systemd service.
* Creates the system user `devlog` with home directory `/opt/devlog` and no sudo privileges.
* Creates the application root directory `/opt/devlog/app` with permissions set to 750.

### 2. `setup-db.sh` (Database Initialization)
Initializes the local PostgreSQL database environment:
* Requires the `DEVLOG_DB_PASSWORD` runtime environment variable.
* Validates that the local PostgreSQL service is active before continuing.
* Escapes single quotes in the password safely to prevent SQL syntax errors.
* Queries the PostgreSQL catalog to determine whether role `devlog` exists, creating or updating it idempotently.
* Queries the PostgreSQL catalog to determine whether database `devlog` exists, creating it if absent and preserving existing data.
* Grants all privileges on the database and public schema to `devlog`.
* Never exposes credentials in logs, shell history, or repository files.

### 3. `deploy-app.sh` (Application Deployment Automation)
Automates repeatable deployment and updates for the Devlog application:
* **Execution Environment**: Executed on the Ubuntu 24.04 EC2 host via root or sudo (for example through AWS Systems Manager Session Manager).
* **Source Configuration**: Supports `DEVLOG_REPOSITORY_URL` (defaults to `https://github.com/chavaliadi/devlog.git`) and `DEVLOG_BRANCH` (defaults to `main`).
* **First Deployment Flow**: If `/opt/devlog/app/.git` does not exist, clones the specified repository branch into `/opt/devlog/app` and assigns ownership to user `devlog`.
* **Subsequent Deployment Flow**: If `/opt/devlog/app/.git` exists, stops the active `devlog-backend` service to prevent partial reads during build, fetches the remote branch, checks out cleanly, and performs a hard reset to `origin/${DEVLOG_BRANCH}`.
* **Dependency Installation**: Runs `npm ci` as user `devlog` inside `backend/` and `frontend/` using existing lockfiles.
* **Backend Build**: Runs Prisma client generation and `npm run build` (`tsc`) as user `devlog`, verifying `/opt/devlog/app/backend/dist/index.js` exists.
* **Frontend Build**: Runs `npm run build` (`tsc -b && vite build`) as user `devlog`, verifying `/opt/devlog/app/frontend/dist/index.html` exists.
* **Prisma Schema Synchronization**: Executes `prisma db push --skip-generate` using `DATABASE_URL` extracted from `/etc/devlog/devlog.env`, applying schema changes without dropping data.
* **Systemd Configuration**: Copies `infrastructure/scripts/systemd/devlog-backend.service` to `/etc/systemd/system/devlog-backend.service`, reloads systemd, enables the service, and starts or restarts it.
* **Nginx Configuration**: Copies `infrastructure/scripts/nginx/devlog.conf` to `/etc/nginx/sites-available/devlog`, enables the site via `/etc/nginx/sites-enabled/devlog`, removes the default Ubuntu site link to eliminate port 80 conflicts, tests syntax with `nginx -t`, and reloads Nginx.
* **Health Verification**: Verifies `devlog-backend` service status with `systemctl is-active`, polls `http://127.0.0.1:5005/health` locally up to 30 seconds, verifies Nginx health proxy routing at `http://127.0.0.1/health`, and verifies Nginx frontend static asset delivery at `http://127.0.0.1/`.

### 4. `systemd/devlog-backend.service` (Process Management Template)
A systemd unit definition template for the backend:
* Runs under user `devlog` and group `devlog`.
* Working directory is `/opt/devlog/app/backend`.
* Specifies `Environment=PORT=5005` and `Environment=NODE_ENV=production` as explicit runtime defaults.
* Loads environment variables from `/etc/devlog/devlog.env`.
* Executes `/usr/bin/node dist/index.js` matching the production startup command from `package.json`.
* Configures automatic restarts on failure (`Restart=on-failure`, `RestartSec=5s`).
* Orders startup after `network.target`, `postgresql.service`, and `redis-server.service`.

### 5. `nginx/devlog.conf` (Web Server and Reverse Proxy Template)
An Nginx site configuration template:
* Serves compiled React frontend static files from `/opt/devlog/app/frontend/dist`.
* Provides single page application client routing fallback using `try_files $uri $uri/ /index.html;`.
* Reverse proxies `/api/` traffic to `http://127.0.0.1:5005` without stripping the `/api` prefix.
* Reverse proxies inbound GitHub webhook traffic on `/webhook/` to `http://127.0.0.1:5005`.
* Proxies `/health` to `http://127.0.0.1:5005/health` for monitoring.
* Sets standard proxy headers (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`).

## Production Port Alignment

To prevent port mismatches, all layers agree on port `5005`:

```
systemd unit default (PORT=5005)
         │
         ▼
/etc/devlog/devlog.env (PORT=5005)
         │
         ▼
Express backend (process.env.PORT || 5000) binds to 5005
         │
         ▼
Nginx upstream proxies to http://127.0.0.1:5005
```

## Idempotency and Safety Guarantees

Running `deploy-app.sh` multiple times provides strict idempotency:
* Deterministically updates source code to the target branch commit.
* Reinstalls dependencies via `npm ci` cleanly.
* Rebuilds backend and frontend production artifacts.
* Synchronizes Prisma schema safely without dropping database tables or records.
* Refreshes systemd unit and Nginx configuration templates.
* Restarts backend service and reloads Nginx gracefully after validation.
* Never alters or deletes `/etc/devlog/devlog.env`.
* Never runs `DROP DATABASE` or deletes PostgreSQL data.
* Never generates synthetic or placeholder production secrets.
* Never executes `terraform apply` or provisions cloud infrastructure.
* Never opens external security group firewall ports.

## Troubleshooting Guidance

* **Backend fails to start (`systemctl is-active` fails):**
  Inspect systemd logs via `journalctl -u devlog-backend -n 50 --no-pager`. Verify that `/etc/devlog/devlog.env` contains valid `DATABASE_URL` and `SESSION_SECRET` values, and that PostgreSQL is running.
* **Database connection errors during Prisma schema sync:**
  Verify that the password in `/etc/devlog/devlog.env` matches the password configured during `setup-db.sh`. Check PostgreSQL service status with `systemctl status postgresql`.
* **Health endpoint check timeout:**
  Check whether Redis is active using `systemctl status redis-server`. The backend health endpoint checks both PostgreSQL and Redis connectivity before returning HTTP 200.
* **Nginx configuration test failure:**
  Run `nginx -t` manually to view syntax error details. Verify that `/opt/devlog/app/frontend/dist` exists and contains `index.html`.
