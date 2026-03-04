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

COPY server/package.json ./
RUN npm ci --omit=dev

COPY server/index.js ./index.js
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 3000
CMD ["node", "index.js"]
