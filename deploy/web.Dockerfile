# Frontend do Kliny (S.7): o build do Vite servido pelo nginx, que também repassa /api para a
# API. Contexto: a raiz do repositório. O nginx roda sem root (imagem nginx-unprivileged, porta 8080).

FROM node:24-alpine AS build
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build && node scripts/check-csp.ts

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 8080
