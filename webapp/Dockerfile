# === Stage 1 — Build React ===
FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# === Stage 2 — Serve with Caddy ===
FROM caddy:2-alpine
WORKDIR /srv

COPY --from=builder /app/dist /srv

# Caddy automatically serves /srv with file_server
