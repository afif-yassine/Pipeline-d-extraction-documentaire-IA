# Image unique : lance le pipeline, puis sert l'interface sur le port 5173.
# La clé API n'est jamais copiée dans l'image : elle est passée au démarrage (compose.yaml).
FROM node:22-slim

WORKDIR /app

# Dépendances d'abord : cette étape reste en cache tant que package*.json ne change pas.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# --host 0.0.0.0 : sinon Vite n'écoute que dans le conteneur et la page est inaccessible.
CMD ["sh", "-c", "npm run extract && npx vite interface --host 0.0.0.0"]
