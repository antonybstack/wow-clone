FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY src ./src
COPY server/presence ./server/presence
COPY public/HavokPhysics.wasm ./public/HavokPhysics.wasm
COPY public/ashen-reach/presence-v1 ./public/ashen-reach/presence-v1
COPY public/ashen-reach/region-actors-v1 ./public/ashen-reach/region-actors-v1
ENV ASHEN_PRESENCE_HOST=0.0.0.0
EXPOSE 2577
USER node
CMD ["node","server/presence/main.js"]
