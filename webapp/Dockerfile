# Stage 1 — Build Vite app
FROM node:18-alpine as builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2 — Serve with Caddy
FROM caddy:2-alpine
WORKDIR /srv

# Копируем билд фронтенда
COPY --from=builder /app/dist /srv

# Копируем наш Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile
