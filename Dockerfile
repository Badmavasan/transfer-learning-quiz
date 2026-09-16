# Backend: Node.js API server (also able to serve static files for standalone runs).
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json ./
RUN npm install --omit=dev

# App source. Copy everything .dockerignore allows rather than listing files:
# a hand-maintained list silently drops newly added modules and the container
# then fails to start.
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Lightweight container healthcheck hitting the API.
HEALTHCHECK --interval=15s --timeout=4s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://localhost:'+ (process.env.PORT||3000) +'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
