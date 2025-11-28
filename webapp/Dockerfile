# webapp/Dockerfile — production build + Caddy to serve static files
# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app

# copy package files and install
COPY package*.json ./
RUN npm install --production=false

# copy source and build
COPY . .
# ensure base in vite.config.js is './' (you already set it)
RUN npm run build

# Stage 2: Production - Caddy serves the built files
FROM caddy:2-alpine

# copy built static files into caddy's site root
COPY --from=builder /app/dist /srv

# copy Caddyfile if you want custom config (we'll add one)
COPY Caddyfile /etc/caddy/Caddyfile

# run Caddy (image's default entrypoint will run caddy)
