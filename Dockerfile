FROM node:20-alpine AS base
WORKDIR /app/jimma-ics-backend

RUN apk add --no-cache openssl

COPY jimma-ics-backend/package.json jimma-ics-backend/package-lock.json ./
RUN npm ci --omit=dev

COPY jimma-ics-backend/ ./
COPY jimma-ics-backend/permissions/ ./permissions/
RUN npm run prisma:generate

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "node --input-type=module -e \"import('./src/config/env.js')\" && npm run prisma:migrate:deploy && exec node src/server.js"]