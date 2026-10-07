FROM node:22-bookworm-slim

WORKDIR /app
RUN corepack enable \
    && corepack prepare pnpm@11.25.0 --activate \
    && pnpm --version

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

ENV NODE_ENV=production \
    PORT=4000
EXPOSE 4000
CMD ["node", "dist/src/server.js"]
