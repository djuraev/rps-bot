FROM node:22-alpine
WORKDIR /app

# 1) dependencies first: this layer is cached until package*.json changes
COPY package*.json ./
RUN npm ci --omit=dev

# 2) then our code: changes here do not reinstall the dependencies
COPY . .

# run as the unprivileged "node" user, not root
USER node
EXPOSE 3000
CMD ["node", "server.js"]
