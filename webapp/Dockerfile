# Build stage
FROM node:18-alpine as build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build


# PRODUCTION STATIC SERVER WITH CADDY
FROM caddy:latest

# Папка, которую Caddy отдаёт по умолчанию
WORKDIR /srv

# Копируем Vite build (dist) в /srv
COPY --from=build /app/dist /srv
