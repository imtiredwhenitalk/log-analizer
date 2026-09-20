FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/loglens.db
EXPOSE 3000

CMD ["npm", "start"]
