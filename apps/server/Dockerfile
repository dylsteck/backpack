# Build stage - use Bun for everything
FROM oven/bun:1.3.0 AS build

WORKDIR /app

# Copy package files for dependency installation
COPY package.json bun.lock ./
COPY /apps/server/package.json ./apps/server/package.json
COPY /packages/api/package.json ./packages/api/package.json
COPY /packages/auth/package.json ./packages/auth/package.json
COPY /packages/db/package.json ./packages/db/package.json

# Install dependencies with Bun
RUN bun install

# Copy source code
COPY /apps/server ./apps/server
COPY /packages/api ./packages/api
COPY /packages/auth ./packages/auth
COPY /packages/db ./packages/db
COPY tsconfig.base.json ./

# Compile to standalone binary
WORKDIR /app/apps/server
ENV NODE_ENV=production
RUN bun build \
    --compile \
    --minify-whitespace \
    --minify-syntax \
    --target bun-linux-x64 \
    --outfile server \
    ./src/index.ts

# Production stage - minimal distroless image
FROM gcr.io/distroless/base-debian12 AS production

WORKDIR /app

# Copy only the compiled binary
COPY --from=build /app/apps/server/server /app/server

ENV NODE_ENV=production

# Run the binary
CMD ["/app/server"]

EXPOSE 3000