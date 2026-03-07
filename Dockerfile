# Stage 1: Build frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine
WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN apk add --no-cache python3 make g++ && \
    npm ci --omit=dev && \
    apk del python3 make g++

COPY server/index.js ./server/index.js
COPY --from=build /app/dist ./dist

ENV DATA_DIR=/app/data
RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "server/index.js"]
