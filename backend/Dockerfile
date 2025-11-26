FROM node:18-alpine

WORKDIR /app

# Устанавливаем OpenSSL, который нужен для Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY . .

# Генерируем клиент Prisma
RUN npx prisma generate

EXPOSE 3000
CMD ["npm", "start"]