# Stage 1: Build the Dashboard
FROM node:18-alpine as ui-builder
WORKDIR /app/dashboard
# Copy dashboard specific package files
COPY dashboard/package*.json ./
RUN npm install
# Copy source and build
COPY dashboard/ ./
RUN npm run build

# Stage 2: Build the API
FROM node:18-alpine
WORKDIR /app

# Install root dependencies (for the API)
COPY package*.json ./
RUN npm install

# Copy API source code
COPY api ./api
COPY tsconfig.json ./

# Copy the built assets from Stage 1 into the expected location
# This puts them in /app/dashboard/dist, matching the path in server.ts
COPY --from=ui-builder /app/dashboard/dist ./dashboard/dist

# Expose ports
EXPOSE 4100 50051

# Run the server
CMD ["npx", "ts-node", "api/server.ts"]