FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
COPY apps ./apps
RUN npm ci
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY apps ./apps
COPY examples ./examples
COPY openapi ./openapi
COPY LICENSE README.md SECURITY.md ./
EXPOSE 3000
CMD ["node", "apps/api/server.mjs"]
