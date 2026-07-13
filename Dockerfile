FROM node:20-alpine AS builder

WORKDIR /app

# Copy the package.json and lockfile
COPY altleads_website-main/package.json altleads_website-main/package-lock.json ./
RUN npm install

# Copy the rest of the application code
COPY altleads_website-main/ ./

# Build the Next.js application
RUN npm run build

# Start a new stage for a smaller production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy necessary files from the builder stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
