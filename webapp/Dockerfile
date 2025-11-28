# Stage 1 — Build frontend
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2 — Serve with Caddy
FROM caddy:2-alpine
WORKDIR /srv
COPY --from=builder /app/dist .
