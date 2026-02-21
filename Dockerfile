# Stage 1: Build React Frontend
FROM node:20-slim AS build-stage
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm install
COPY client/ ./client/
RUN cd client && npm run build

# Stage 2: Node.js Backend
FROM node:20-slim
WORKDIR /app

# Install dependencies for remote control (Samba)
RUN apt-get update && apt-get install -y samba-common-bin iputils-ping && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./server/
RUN cd server && npm install --production

# Copy built frontend from Stage 1
COPY --from=build-stage /app/client/dist ./client/dist

# Copy backend source
COPY server/ ./server/

EXPOSE 3000
CMD ["node", "server/server.js"]
