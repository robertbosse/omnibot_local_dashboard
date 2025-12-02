# Stage 1: Build the Dashboard
FROM node:18-alpine as ui-builder
WORKDIR /app/dashboard

# Copy dashboard specific package files
COPY dashboard/package*.json ./
RUN npm install

# Copy source and build
COPY dashboard/ ./
RUN npm run build

# DEBUG: Show what was built
RUN echo "=== UI BUILD COMPLETE ===" && \
    echo "Contents of /app/dashboard:" && \
    ls -la /app/dashboard && \
    echo "" && \
    echo "Contents of /app/dashboard/dist:" && \
    ls -la /app/dashboard/dist && \
    echo "" && \
    echo "First 30 lines of index.html:" && \
    head -30 /app/dashboard/dist/index.html || echo "index.html NOT FOUND"

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
COPY --from=ui-builder /app/dashboard/dist ./dashboard/dist

# DEBUG: Verify files were copied to final image
RUN echo "=== FINAL IMAGE CHECK ===" && \
    echo "Contents of /app:" && \
    ls -la /app && \
    echo "" && \
    echo "Contents of /app/dashboard:" && \
    ls -la /app/dashboard && \
    echo "" && \
    echo "Contents of /app/dashboard/dist:" && \
    ls -la /app/dashboard/dist && \
    echo "" && \
    if [ -f /app/dashboard/dist/index.html ]; then \
      echo "✅ index.html EXISTS in final image"; \
      echo "File size: $(wc -c < /app/dashboard/dist/index.html) bytes"; \
      echo "First 20 lines:"; \
      head -20 /app/dashboard/dist/index.html; \
    else \
      echo "❌ index.html MISSING in final image"; \
    fi

# Expose ports
EXPOSE 4100 50051

# Run the server
CMD ["npx", "ts-node", "api/server.ts"]