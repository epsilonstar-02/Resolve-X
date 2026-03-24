# DBSCAN Clustering Microservice

Standalone FastAPI microservice that returns GeoJSON complaint clusters.

## Run locally

From this folder:

```powershell
uv sync
Copy-Item .env.example .env
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8010 --env-file .env
```

## API endpoints

- `GET /healthz`
- `GET /api/v1/analytics/clusters`

Swagger docs:

- `http://127.0.0.1:8010/docs`

## Test

```powershell
uv run pytest .\test_analytics_clustering.py
```
