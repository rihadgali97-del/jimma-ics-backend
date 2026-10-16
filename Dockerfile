FROM node:20-alpine AS base
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .
RUN npm run prisma:generate

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "node --input-type=module -e \"import('./src/config/env.js')\" && npm run prisma:migrate:deploy && exec node src/server.js"]