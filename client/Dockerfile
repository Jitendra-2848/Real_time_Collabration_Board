# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Build args can be passed for environment variables if needed
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN npm run build

# Stage 2: Serve static content with NGINX
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
