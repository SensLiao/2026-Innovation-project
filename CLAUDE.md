# Soma AI - CI/CD Reference

## Architecture

```
GitHub (SensLiao/2026-Innovation-project)
    ↓ mirror
GitLab (192.168.50.174/root/soma-ai)
    ↓ ArgoCD auto-sync
K3s Cluster (soma-ai namespace)
    ├── backend  (Node.js Express, port 3000)
    └── frontend (React Vite → nginx, port 80)
```

## Quick Commands

```bash
# Push code → auto deploy
cd /tmp/2026-Innovation-project
git add . && git commit -m "update" && git push gitlab main
# ArgoCD auto-syncs within ~3 min (or force refresh below)

# Force ArgoCD sync
kubectl annotate application soma-ai -n argocd argocd.argoproj.io/refresh=hard --overwrite

# Check status
kubectl get pods -n soma-ai
kubectl get application soma-ai -n argocd
```

## Infrastructure

| Component | Location | Details |
|-----------|----------|---------|
| GitLab | 192.168.50.174 | Omnibus Docker, project ID: 2 |
| ArgoCD | K3s (argocd ns) | admin / of4trXrO5ig5gOFJ |
| K3s Master | 192.168.50.210 | geniuscai / see secrets.env |
| Backend pod | k3s-v100 node | nodeSelector pinned |
| Frontend pod | any worker | no node constraint |

## GitLab API

```bash
PAT="glpat-2TkJGOdXvugjaQQnJAnn5G86MQp1OjEH.01.0w00yni6j"
# List projects
curl -s -H "PRIVATE-TOKEN: $PAT" http://192.168.50.174/api/v4/projects
# Trigger pipeline
curl -s -X POST -H "PRIVATE-TOKEN: $PAT" http://192.168.50.174/api/v4/projects/2/pipeline -d "ref=main"
```

## K8s Manifests

```
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── namespace.yaml
│   ├── backend-deployment.yaml   # 500m-2CPU, 2-4Gi RAM, /app/models volume
│   ├── frontend-deployment.yaml  # 100m-500m CPU, 128-256Mi RAM
│   ├── services.yaml             # backend:3000, frontend:80
│   └── ingress.yaml              # soma-ai.org + api.soma-ai.org
└── overlays/
    └── homelab/
        └── kustomization.yaml    # image tag overrides
```

## Secrets (K8s)

| Secret | Type | Keys |
|--------|------|------|
| soma-ai-env | Opaque | DATABASE_URL, JWT_SECRET, NODE_ENV, SKIP_MODELS |
| soma-ai-tls | kubernetes.io/tls | tls.crt, tls.key |
| cloudflare-api-token | Opaque | api-token |
| gitlab-registry | dockerconfigjson | .dockerconfigjson |

## Backend Details

- **Database**: Neon PostgreSQL (cloud, ap-southeast-2)
- **Models**: hostPath `/home/geniuscai/soma-models` on k3s-v100
- **SKIP_MODELS**: `true` (models not loaded at runtime currently)
- **Dependencies**: Express 5, Anthropic SDK, ONNX Runtime, Sharp

## Frontend Details

- **Framework**: React 19 + Vite 7 + Tailwind CSS
- **State**: Zustand
- **Routing**: React Router v7
- **Build**: `npm run build` → nginx serves static + proxies /api

## Domains

| Domain | Target |
|--------|--------|
| soma-ai.org | frontend (/ path) + backend (/api path) |
| api.soma-ai.org | backend directly |

TLS via cert-manager + Cloudflare DNS.

## CI/CD Pipeline (.gitlab-ci.yml)

Stages: `test` → `build` → `deploy`

- **test**: `npm run test:run` (frontend), `npm run test:mock` (backend)
- **build**: Docker build + push to GitLab Container Registry
- **deploy**: `kubectl apply -k` + Bark notification

> Registry enabled on port 5050. Images: `192.168.50.174:5050/root/soma-ai/{backend,frontend}`
> K3s nodes configured with insecure registry in `/etc/rancher/k3s/registries.yaml`

## Deployment Workflow

1. Developer pushes to `main` branch
2. GitLab CI runs tests (frontend vitest, backend mock)
3. GitLab CI builds Docker images → pushes to registry (192.168.50.174:5050)
4. GitLab CI deploy stage: `sed` updates kustomization.yaml with commit SHA tag → git push [skip ci]
5. ArgoCD detects manifest change → auto-syncs to K3s
6. Rolling update: new pods start → health check → old pods terminate
7. Bark notification on success

## Troubleshooting

```bash
# Pod not starting
kubectl describe pod <name> -n soma-ai
kubectl logs <name> -n soma-ai

# ArgoCD sync issues
kubectl get application soma-ai -n argocd -o yaml | grep -A5 conditions

# Force rollback
kubectl rollout undo deployment/backend -n soma-ai
kubectl rollout undo deployment/frontend -n soma-ai
```
