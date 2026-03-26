# =============================================================================
# Stage 1 — deps
# Installe TOUTES les dépendances (dev incluses) pour le build TypeScript.
# Isolé dans un stage dédié : node_modules ne transit pas dans l'image finale.
# =============================================================================
FROM node:22-alpine AS deps
WORKDIR /app

# Désactive Husky dans Docker — pas de contexte git, les hooks n'ont pas de sens
ENV HUSKY=0

COPY package*.json ./
RUN npm ci

# =============================================================================
# Stage 2 — build
# Génère le client Prisma puis compile TypeScript → dist/.
# =============================================================================
FROM node:22-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate && npm run build

# =============================================================================
# Stage 3 — production
# Image minimale : node:alpine, deps de prod uniquement, utilisateur non-root.
#
# Bonnes pratiques sécurité appliquées :
#   - Aucun secret dans les layers (les vars d'env sont injectées au runtime)
#   - Utilisateur "node" (UID 1000) — jamais root en production
#   - Seuls dist/ et node_modules de prod sont copiés
#   - npm cache nettoyé pour réduire la surface d'attaque
# =============================================================================
FROM node:22-alpine AS production
WORKDIR /app

# Installe uniquement les dépendances de production.
# --ignore-scripts : évite d'exécuter "prepare" (husky absent en prod) et tout
#   autre lifecycle script. prisma generate est lancé explicitement ensuite.
COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev --ignore-scripts && \
    npx prisma generate && \
    npm cache clean --force

# Copie l'application compilée depuis le stage build
COPY --from=build /app/dist ./dist

# Donne la propriété de /app à node avant de basculer — évite les erreurs d'écriture
# silencieuses si NestJS écrit des fichiers temporaires au runtime
RUN chown -R node:node /app

USER node

EXPOSE 3000

# Healthcheck sans dépendance externe (node est toujours disponible)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => \
    r.statusCode === 200 ? process.exit(0) : process.exit(1) \
  ).on('error', () => process.exit(1))"

CMD ["node", "dist/src/main"]
