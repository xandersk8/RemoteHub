# Stage 1: Build React Frontend
FROM node:20-bookworm AS build-stage
WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY client/package*.json ./client/
RUN cd client && npm install
COPY client/ ./client/
RUN cd client && npm run build

# Stage 2: Node.js Backend
FROM node:20-bookworm-slim
WORKDIR /app

# Install dependencies for remote control (Samba + Ping) with retries
RUN apt-get update || (sleep 5 && apt-get update) && \
    apt-get install -y --no-install-recommends \
    samba-common-bin \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./server/
RUN cd server && npm install --production

# Copy built frontend from Stage 1
COPY --from=build-stage /app/client/dist ./client/dist

# Copy backend source
COPY server/ ./server/

EXPOSE 3080
ENV NODE_ENV=production
ENV PORT=3080

CMD ["node", "server/server.js"]
