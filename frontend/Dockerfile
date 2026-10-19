# FitCoach frontend — development image running the Vite dev server with HMR.
# Source is bind-mounted by docker-compose; node_modules stays in the container.
FROM node:20-slim

WORKDIR /app

# Dependencies in their own layer. npm ci uses package-lock.json for a reproducible
# install and is why the lockfile is copied alongside package.json.
COPY package.json package-lock.json ./
RUN npm ci

# Fallback copy; compose mounts ./frontend over this in normal use.
COPY . .

EXPOSE 5173

# vite.config.js sets port 5173 but no host, so Vite would bind localhost only and be
# unreachable from outside the container. The bare `--` forwards the flag to Vite.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
