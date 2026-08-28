FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .
ARG VITE_API_BASE_URL=/api
ARG VITE_YANDEX_METRIKA_ID
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_YANDEX_METRIKA_ID=${VITE_YANDEX_METRIKA_ID}
RUN pnpm build

FROM nginx:1.27-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
