# Devlog Host Runtime Provisioning and Application Deployment

## Purpose of the Deployment and Runtime Layer

This directory contains host preparation, database initialization, application deployment automation, and service configuration templates for Devlog.
The runtime and deployment layer bridges cloud infrastructure provisioned by Terraform and the running application.
It establishes the operating system environment, local database, application source code builds, and service definitions without coupling application details into Terraform.

## Architectural Boundaries and Lifecycle

The Devlog AWS deployment maintains strict separation across distinct lifecycle stages:

1. **Stage 1: Cloud Infrastructure Foundation**
   Terraform provisions virtual hardware, networking, VPC, public subnet, route table, security group with inbound HTTP port 80 allowed, IAM role, instance profile, and the EC2 instance.

2. **Stage 2: Host Runtime Preparation (`setup-host.sh`)**
   Executes on the Ubuntu host as root. Installs Node.js 20, PostgreSQL 16, Redis, and Nginx. Creates the unprivileged system user `devlog` and prepares the root directory `/opt/devlog/app`.

3. **Stage 3: Database Initialization (`setup-db.sh`)**
   Executes locally on the host. Requires the `DEVLOG_DB_PASSWORD` environment variable. Creates the `devlog` PostgreSQL user and `devlog` database idempotently with safe password escaping.

4. **Stage 4: Runtime Environment Configuration**
   Creates the production environment file `/etc/devlog/devlog.env` with strict file permissions (0600) containing runtime connection strings, `PORT=5005`, and application secrets outside Git version control.

5. **Stage 5: Application Deployment (`deploy-app.sh`)**
   Clones or updates application code in `/opt/devlog/app`, installs dependencies, compiles backend TypeScript, bundles frontend static assets, synchronizes Prisma database schema, installs systemd and Nginx configurations, restarts services, and verifies local health.

6. **Stage 6: Public HTTP Verification**
   Verifies public reachability over HTTP port 80 through Nginx.

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
* **Prerequisites**: Host runtime prepared via `setup-host.sh`, PostgreSQL initialized via `setup-db.sh`, Redis running, and `/etc/devlog/devlog.env` created.
* **Environment File Requirement**: Requires `/etc/devlog/devlog.env` containing `DATABASE_URL`, `PORT=5005`, and application secrets. Fails immediately if absent.
* **Source Configuration**: Supports `DEVLOG_REPOSITORY_URL` (defaults to `https://github.com/chavaliadi/devlog.git`) and `DEVLOG_BRANCH` (defaults to `main`).
* **First Deployment Flow**: Clones the specified repository branch into `/opt/devlog/app` and assigns ownership to user `devlog`.
* **Subsequent Deployment Flow**: Fetches the branch, checks out cleanly, and runs a hard reset to `origin/${DEVLOG_BRANCH}` to guarantee deterministic state without merge conflicts.
* **Dependency Installation**: Runs `npm ci` as user `devlog` inside `backend/` and `frontend/` using existing lockfiles.
* **Backend Build**: Runs Prisma client generation and `npm run build` (`tsc`) as user `devlog`, verifying `/opt/devlog/app/backend/dist/index.js` exists.
* **Frontend Build**: Runs `npm run build` (`tsc -b && vite build`) as user `devlog`, verifying `/opt/devlog/app/frontend/dist/index.html` exists.
* **Prisma Schema Synchronization**: Executes `prisma db push --skip-generate` using `DATABASE_URL` extracted from `/etc/devlog/devlog.env`, applying schema changes without dropping data.
* **Systemd Configuration**: Copies `infrastructure/scripts/systemd/devlog-backend.service` to `/etc/systemd/system/devlog-backend.service`, reloads systemd, enables the service, and restarts it.
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

## What `deploy-app.sh` Does Not Do

The script intentionally omits:
* Cloud infrastructure provisioning (managed strictly by Terraform).
* PostgreSQL database creation or role password provisioning (managed by `setup-db.sh`).
* Secret generation (managed by operator in `/etc/devlog/devlog.env`).
* Container runtimes or process managers like Docker, Kubernetes, or PM2.
* Modifying application source code or business logic.
