FROM --platform=linux/amd64 node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
ENV DATA_DIR=/data
ENV npm_config_build_from_source=true
COPY package.json ./
RUN npm install --include=optional
RUN npm install @rollup/rollup-linux-x64-gnu --no-save
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "server/index.js"]
