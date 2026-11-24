FROM node:20-slim

WORKDIR /app

# Install dependencies (only production deps)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application files
COPY src/ ./src/
COPY migrate.js ./
COPY docker-entrypoint.js ./

# Create uploads directory structure
RUN mkdir -p uploads/firmware

# Default environment settings
ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    UDP_PORT=9001 \
    TZ=Asia/Kolkata

EXPOSE 3001 9001/udp

ENTRYPOINT ["node", "docker-entrypoint.js"]
CMD ["src/index.js"]

