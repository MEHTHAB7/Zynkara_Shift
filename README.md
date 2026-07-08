# ZynkaraShift PaaS Platform

ZynkaraShift is a self-hosted, multi-tenant PaaS designed to run on a local Linux or Windows host using Docker Desktop. It integrates outbound Cloudflare Tunnels (for public availability without opening ports), Traefik (for dynamic subdomain routing via Docker labels), Docker container orchestration with memory/CPU hard caps, and a database subscription gateway that limits free users to 3 active projects.

## 1. System Topology Diagram

Below is the secure traffic routing architecture from public clients to isolated containerized services:

```
                  ┌──────────────────────────────┐
                  │      Public Web Client       │
                  └──────────────┬───────────────┘
                                 │
                                 │ HTTPS (Wildcard: *.zynkarashift.duckdns.org)
                                 ▼
                  ┌──────────────────────────────┐
                  │   Cloudflare Edge Network    │
                  │  (Wildcard Edge SSL Certs)   │
                  └──────────────┬───────────────┘
                                 │
                                 │ Encrypted Tunnel Protocol (Outbound Connection)
                                 ▼
                  ┌──────────────────────────────┐
                  │  cloudflared Tunnel Daemon   │
                  │   (Internal Docker Network)  │
                  └──────────────┬───────────────┘
                                 │
                                 │ HTTP (Forwarded internally)
                                 ▼
                  ┌──────────────────────────────┐
                  │    Traefik Reverse Proxy     │
                  │  (Host Header: app.your...)  │
                  └──────────────┬───────────────┘
                                 │
            ┌────────────────────┴────────────────────┐
            │ Traefik Net: zynkarashift-traefik-net   │
            └────────────────────┬────────────────────┘
                                 │
                                 ▼
     ┌────────────────────────────────────────────────────────┐
     │ Project Isolated Network: zynkarashift-net-{project_id}│
     │                                                        │
     │  ┌───────────────────────┐       ┌──────────────────┐  │
     │  │   App Container       │◄─────►│   DB Container   │  │
     │  │  (Labels: traefik.     │       │ (Postgres/MySQL/ │  │
     │  │   enable=true;        │       │  MongoDB/Redis)  │  │
     │  │   mem_limit=512m;     │       │ (Volume mapped,  │  │
     │  │   nano_cpus=0.5 CPU)  │       │  No exposed ports│  │
     │  └───────────────────────┘       └──────────────────┘  │
     │                                                        │
     └────────────────────────────────────────────────────────┘
```

---

## 2. Infrastructure Design Highlights

### Networking & Reverse Proxy Hardening
1. **Cloudflare Tunnel (`cloudflared`):** Establishes a secure, outbound connection to the Cloudflare network, pulling in traffic for `*.yourplatform.com`. This completely eliminates the need for exposing ports to the public internet or configuring host firewalls.
2. **Dynamic Traefik Subdomains:** Traefik listens on `/var/run/docker.sock` and automatically discovers newly created application containers. Based on labels dynamically injected by the Python orchestration service (e.g. `traefik.http.routers.zynkarashift-router-{id}.rule=Host(...)`), Traefik maps the custom subdomain dynamically without restarting.
3. **Container Isolation (Dual-Network Architecture):**
   - The application container is attached to both `zynkarashift-traefik-net` (so Traefik can proxy HTTP traffic to it) and `zynkarashift-net-{project_id}` (so it can query its database).
   - The database container (Postgres, MySQL, MongoDB, or Redis) is **only** attached to the isolated project network `zynkarashift-net-{project_id}`.
   - **Zero Exposed Ports for Databases:** Database ports are not published to the host or the public internet. Communication occurs strictly over the private bridge network via Docker's internal DNS (`db-service`).

### Dynamic Orchestration Service
- **Volumetric Persistence:** Dynamically maps volumes on the host system to prevent data loss during container restarts (bind-mapped at `/var/zynkarashift/volumes/{tenant_id}/{project_id}/{db_type}`).
- **Hard Resource Caps:** To prevent host resource starvation, containers are restricted to a maximum of **512MB RAM** and **0.5 CPU cores** using the official Docker SDK parameters:
  - `mem_limit="512m"`
  - `nano_cpus=500000000` (which caps the execution time to half a core in nanoseconds).

### Relational Database Schema
The platform control plane utilizes a PostgreSQL database to manage state:
- `User`: Handles accounts and tracks `subscription_status` (`'free'` or `'premium'`).
- `Project`: Tracks workspaces, subdomains, database types, and statuses.
- `Deployment`: Tracks image tags, injection environment variables, and build/stdout logs.

### The 3-Free-Projects Subscription Gate
- **FastAPI Dependency Guardrail:** Evaluates the user's active project count upon project creation. If they have 3 active projects and are not premium, the request is immediately halted and returned with an HTTP `403 Forbidden` response:
  ```json
  {
    "detail": {
      "error": "Subscription required",
      "message": "You have reached the maximum limit of 3 free deployed projects. Please upgrade to a premium tier to unlock unlimited deployments."
    }
  }
  ```
- **Stripe Payment Gateway Checkout Modal:** The UI catches the `403` response, locks the deployment utility, and displays a glassmorphic Stripe card-checkout modal allowing simulated upgrades.

---

## 3. Getting Started

### Prerequisites
- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) on Windows or Linux.
- Retrieve a Cloudflare Tunnel Token if you wish to run it on a public domain. (Otherwise, it resolves locally at `http://zynkarashift.localhost` on your machine via Traefik).

### Startup Instructions
1. Clone or copy the project files to your folder.
2. In the folder root, start the platform control plane:
   ```bash
   # Run without Cloudflare tunnel (resolves on http://zynkarashift.localhost)
   docker compose up -d

   # OR run with your Cloudflare Tunnel Token
   TUNNEL_TOKEN="your_token_here" docker compose up -d
   ```
3. Open your browser and navigate to `http://localhost:8000` or `http://zynkarashift.localhost` to access the ZynkaraShift dashboard.

### Demo Credentials (Seeded)
During container initialization, the control plane automatically seeds two accounts to make testing easy:
* **Standard Free Account:** `free@zynkarashift.local` (Password: `password123`)
* **Premium Unlimited Account:** `premium@zynkarashift.local` (Password: `password123`)

---

## 4. Verification Workflow

1. **Verify 3-Project Limit (Free User):**
   - Log in using `free@sovereign.local`.
   - Deploy 3 test applications (e.g., using manual quick deploy or the AI assistant, e.g., `"Deploy image nginx:alpine name app-1"`).
   - Try to deploy a 4th application.
   - **Expected behavior:** The backend returns a `403 Forbidden` response. The UI dashboard immediately intercepts this, locks the deploy form, and slides in the Stripe Checkout overlay.
2. **Upgrade to Premium:**
   - Complete the Stripe card payment form and click **Pay $15**.
   - **Expected behavior:** The client makes a `POST` request to `/api/subscription/upgrade`. The database is updated, the user tier badge turns into `PREMIUM`, the progress bar unlocks, and the 4th deployment successfully completes immediately!

3. **Verify Isolated Databases:**
   - Run `docker inspect zynkarashift-db-<project_id>` in your host terminal.
   - Notice that the database container has no public ports mapped to the host, and it resides strictly on `zynkarashift-net-{project_id}`.
   - Run `docker inspect zynkarashift-app-<project_id>` and verify it is connected to both `zynkarashift-traefik-net` and `zynkarashift-net-{project_id}`.
