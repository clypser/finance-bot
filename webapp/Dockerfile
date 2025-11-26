# Build stage
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Serve stage (Nginx is better, but using simple preview for simplicity here)
FROM node:18-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/vite.config.js ./
RUN npm install typescript vite
CMD ["npx", "vite", "preview", "--port", "80", "--host"]