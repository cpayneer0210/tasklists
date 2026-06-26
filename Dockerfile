FROM --platform=linux/amd64 node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV npm_config_build_from_source=true
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["node", "server/index.js"]
