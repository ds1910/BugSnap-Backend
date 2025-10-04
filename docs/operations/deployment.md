# BugSnap Deployment Guide

## 🚀 Production Deployment

This guide covers deploying BugSnap backend to production environments with proper configuration, monitoring, and security.

## 🏗️ Infrastructure Requirements

### Minimum System Requirements

#### Production Server
```yaml
CPU: 2 vCPUs (4 vCPUs recommended)
RAM: 4GB (8GB recommended)
Storage: 50GB SSD (100GB recommended)
Network: 1Gbps bandwidth
OS: Ubuntu 20.04 LTS or CentOS 8
```

#### Database Requirements
```yaml
MongoDB:
  - Version: 5.0 or higher
  - RAM: 4GB minimum
  - Storage: 100GB minimum
  - Replica Set: Recommended for production

Redis:
  - Version: 6.0 or higher
  - RAM: 2GB minimum
  - Persistence: RDB + AOF enabled
```

### Cloud Provider Recommendations

#### AWS Deployment
```yaml
Application Server:
  - EC2: t3.medium or t3.large
  - Load Balancer: Application Load Balancer
  - Auto Scaling: Min 2, Max 10 instances

Database:
  - MongoDB Atlas: M10 or higher
  - ElastiCache: cache.t3.medium

Storage:
  - CloudFront: CDN for static assets
  - S3: File storage backup
```

#### Google Cloud Platform
```yaml
Application Server:
  - Compute Engine: n1-standard-2
  - Load Balancer: HTTP(S) Load Balancer
  - Instance Groups: Managed instance groups

Database:
  - MongoDB Atlas: M10 or higher
  - Memorystore: Redis standard tier

Storage:
  - Cloud CDN: Static asset delivery
  - Cloud Storage: File backups
```

#### Microsoft Azure
```yaml
Application Server:
  - VM: Standard_B2s or Standard_D2s_v3
  - Load Balancer: Application Gateway
  - Scale Sets: Virtual Machine Scale Sets

Database:
  - MongoDB Atlas: M10 or higher
  - Azure Cache: Redis Premium

Storage:
  - Azure CDN: Content delivery
  - Blob Storage: File storage
```

---

## 🔧 Environment Configuration

### Production Environment Variables

Create a comprehensive `.env` file for production:

```bash
# Application Configuration
NODE_ENV=production
PORT=8019
APP_NAME=BugSnap
API_VERSION=1.0.0

# Server Configuration
HOST=0.0.0.0
CORS_ORIGIN=https://bugsnap.codemine.tech,https://www.bugsnap.codemine.tech
TRUST_PROXY=true

# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/bugsnap?retryWrites=true&w=majority
MONGODB_OPTIONS='{"useNewUrlParser":true,"useUnifiedTopology":true,"maxPoolSize":10,"serverSelectionTimeoutMS":5000,"socketTimeoutMS":45000}'

# Redis Configuration
REDIS_HOST=redis-cluster.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_TLS=true
REDIS_DB=0

# Authentication
ACCESS_TOKEN_SECRET=your_very_secure_access_token_secret_256_bits_minimum
REFRESH_TOKEN_SECRET=your_very_secure_refresh_token_secret_256_bits_minimum
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Email Configuration
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
EMAIL_FROM=noreply@bugsnap.codemine.tech

# File Storage
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Security
ENCRYPTION_KEY=your_256_bit_encryption_key_for_aes
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
HEALTH_CHECK_PATH=/health
METRICS_PATH=/metrics

# External Services
WEBHOOK_SECRET=your_webhook_verification_secret
API_TIMEOUT=30000
MAX_FILE_SIZE=10485760

# Performance
CLUSTER_MODE=true
MAX_WORKERS=4
COMPRESSION_ENABLED=true
CACHE_TTL=3600
```

### Docker Configuration

#### Dockerfile
```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bugsnap -u 1001 -G nodejs

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy from builder stage
COPY --from=builder --chown=bugsnap:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=bugsnap:nodejs /app .

# Switch to non-root user
USER bugsnap

# Expose port
EXPOSE 8019

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node health-check.js || exit 1

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
```

#### docker-compose.yml
```yaml
version: '3.8'

services:
  bugsnap-api:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: bugsnap-api
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    ports:
      - "8019:8019"
    volumes:
      - ./logs:/app/logs
    depends_on:
      - redis
    networks:
      - bugsnap-network
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'

  redis:
    image: redis:7-alpine
    container_name: bugsnap-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"
    networks:
      - bugsnap-network

  nginx:
    image: nginx:alpine
    container_name: bugsnap-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - bugsnap-api
    networks:
      - bugsnap-network

volumes:
  redis-data:

networks:
  bugsnap-network:
    driver: bridge
```

### Nginx Configuration

```nginx
# nginx.conf
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    # Upstream servers
    upstream bugsnap_backend {
        least_conn;
        server bugsnap-api:8019 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # API Server
    server {
        listen 80;
        listen 443 ssl http2;
        server_name api.bugsnap.codemine.tech;

        # SSL certificates
        ssl_certificate /etc/nginx/ssl/api.bugsnap.codemine.tech.crt;
        ssl_certificate_key /etc/nginx/ssl/api.bugsnap.codemine.tech.key;

        # Redirect HTTP to HTTPS
        if ($scheme != "https") {
            return 301 https://$server_name$request_uri;
        }

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
        add_header Content-Security-Policy "default-src 'self'";

        # Health check endpoint (no rate limiting)
        location /health {
            proxy_pass http://bugsnap_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Login endpoints (strict rate limiting)
        location ~ ^/(user/login|user/signup|auth/) {
            limit_req zone=login burst=5 nodelay;
            proxy_pass http://bugsnap_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 5s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # API endpoints (general rate limiting)
        location / {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://bugsnap_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 5s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            
            # Handle WebSocket connections
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  REGISTRY: ghcr.io
  IMAGE_NAME: bugsnap/api

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:5.0
        ports:
          - 27017:27017
      redis:
        image: redis:7
        ports:
          - 6379:6379
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linting
        run: npm run lint
      
      - name: Run tests
        run: npm test
        env:
          NODE_ENV: test
          MONGODB_URI: mongodb://localhost:27017/bugsnap_test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          ACCESS_TOKEN_SECRET: test_secret
          REFRESH_TOKEN_SECRET: test_secret
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
      - name: Deploy to production
        uses: appleboy/ssh-action@v0.1.7
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/bugsnap
            docker-compose pull
            docker-compose up -d --remove-orphans
            docker system prune -f
      
      - name: Health check
        run: |
          sleep 30
          curl -f https://api.bugsnap.codemine.tech/health || exit 1
      
      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()
```

### Deployment Script

```bash
#!/bin/bash
# deploy.sh - Production deployment script

set -e

# Configuration
APP_NAME="bugsnap-api"
DEPLOY_DIR="/opt/bugsnap"
BACKUP_DIR="/opt/backups/bugsnap"
LOG_FILE="/var/log/bugsnap-deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Pre-deployment checks
pre_deploy_checks() {
    log "Running pre-deployment checks..."
    
    # Check if running as root or with sudo
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root"
    fi
    
    # Check if required commands exist
    command -v docker >/dev/null 2>&1 || error "Docker is not installed"
    command -v docker-compose >/dev/null 2>&1 || error "Docker Compose is not installed"
    
    # Check if deployment directory exists
    if [[ ! -d "$DEPLOY_DIR" ]]; then
        error "Deployment directory $DEPLOY_DIR does not exist"
    fi
    
    # Check if .env file exists
    if [[ ! -f "$DEPLOY_DIR/.env" ]]; then
        error "Environment file $DEPLOY_DIR/.env does not exist"
    fi
    
    log "Pre-deployment checks passed"
}

# Create backup
create_backup() {
    log "Creating backup..."
    
    BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_TIMESTAMP"
    
    mkdir -p "$BACKUP_PATH"
    
    # Backup current deployment
    if [[ -d "$DEPLOY_DIR" ]]; then
        cp -r "$DEPLOY_DIR" "$BACKUP_PATH/"
        log "Backup created at $BACKUP_PATH"
    fi
    
    # Keep only last 5 backups
    cd "$BACKUP_DIR"
    ls -t | tail -n +6 | xargs -r rm -rf
    log "Cleaned old backups, keeping latest 5"
}

# Health check function
health_check() {
    local max_attempts=30
    local attempt=1
    
    log "Performing health check..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s https://api.bugsnap.codemine.tech/health >/dev/null 2>&1; then
            log "Health check passed"
            return 0
        fi
        
        warn "Health check attempt $attempt failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    error "Health check failed after $max_attempts attempts"
}

# Rollback function
rollback() {
    log "Rolling back to previous version..."
    
    # Get latest backup
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR" | head -n 1)
    
    if [[ -z "$LATEST_BACKUP" ]]; then
        error "No backup found for rollback"
    fi
    
    # Stop current services
    cd "$DEPLOY_DIR"
    docker-compose down
    
    # Restore from backup
    rm -rf "$DEPLOY_DIR"
    cp -r "$BACKUP_DIR/$LATEST_BACKUP/bugsnap" "$DEPLOY_DIR"
    
    # Start services
    cd "$DEPLOY_DIR"
    docker-compose up -d
    
    log "Rollback completed"
}

# Main deployment function
deploy() {
    log "Starting deployment of $APP_NAME..."
    
    cd "$DEPLOY_DIR"
    
    # Pull latest images
    log "Pulling latest Docker images..."
    docker-compose pull
    
    # Stop services gracefully
    log "Stopping services..."
    docker-compose down --timeout 30
    
    # Start services
    log "Starting services..."
    docker-compose up -d --remove-orphans
    
    # Wait for services to start
    sleep 30
    
    # Perform health check
    if ! health_check; then
        warn "Health check failed, initiating rollback..."
        rollback
        health_check
    fi
    
    # Cleanup unused Docker resources
    log "Cleaning up Docker resources..."
    docker system prune -f
    
    log "Deployment completed successfully"
}

# Post-deployment tasks
post_deploy() {
    log "Running post-deployment tasks..."
    
    # Update monitoring dashboards
    if command -v curl >/dev/null 2>&1; then
        curl -s -X POST "https://monitoring.bugsnap.codemine.tech/api/deployment" \
            -H "Content-Type: application/json" \
            -d "{\"service\":\"$APP_NAME\",\"version\":\"$(date +'%Y%m%d_%H%M%S')\",\"status\":\"deployed\"}" || true
    fi
    
    # Send notification (if configured)
    if [[ -n "${SLACK_WEBHOOK:-}" ]]; then
        curl -s -X POST "$SLACK_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"✅ BugSnap API deployed successfully to production\"}" || true
    fi
    
    log "Post-deployment tasks completed"
}

# Main execution
main() {
    log "=== BugSnap API Deployment Started ==="
    
    pre_deploy_checks
    create_backup
    
    # Trap for rollback on failure
    trap 'error "Deployment failed, check logs for details"' ERR
    
    deploy
    post_deploy
    
    log "=== BugSnap API Deployment Completed ==="
}

# Run main function
main "$@"
```

---

## 📊 Monitoring & Observability

### Application Monitoring

#### Health Check Endpoint
```javascript
// health-check.js
const http = require('http');
const os = require('os');

const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
        used: process.memoryUsage(),
        system: {
            free: os.freemem(),
            total: os.totalmem()
        }
    },
    cpu: {
        usage: process.cpuUsage(),
        loadAverage: os.loadavg()
    },
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
};

// Check database connectivity
async function checkDatabase() {
    try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 1) {
            healthCheck.database = {
                status: 'connected',
                readyState: mongoose.connection.readyState
            };
        } else {
            throw new Error('Database not connected');
        }
    } catch (error) {
        healthCheck.status = 'unhealthy';
        healthCheck.database = {
            status: 'disconnected',
            error: error.message
        };
    }
}

// Check Redis connectivity
async function checkRedis() {
    try {
        const redis = require('redis');
        const client = redis.createClient({
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT
        });
        
        await client.ping();
        healthCheck.cache = {
            status: 'connected'
        };
        await client.quit();
    } catch (error) {
        healthCheck.status = 'unhealthy';
        healthCheck.cache = {
            status: 'disconnected',
            error: error.message
        };
    }
}

// Main health check
async function performHealthCheck() {
    await Promise.all([
        checkDatabase(),
        checkRedis()
    ]);
    
    return healthCheck;
}

// Export for use in main application
if (require.main === module) {
    // Standalone health check for Docker
    performHealthCheck()
        .then(result => {
            console.log(JSON.stringify(result, null, 2));
            process.exit(result.status === 'healthy' ? 0 : 1);
        })
        .catch(error => {
            console.error('Health check failed:', error);
            process.exit(1);
        });
} else {
    module.exports = performHealthCheck;
}
```

#### Metrics Collection
```javascript
// metrics.js
const promClient = require('prom-client');

// Create a Registry
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({
    register,
    timeout: 5000,
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new promClient.Gauge({
    name: 'active_connections',
    help: 'Number of active connections'
});

const databaseQueries = new promClient.Counter({
    name: 'database_queries_total',
    help: 'Total number of database queries',
    labelNames: ['operation', 'collection']
});

const cacheHits = new promClient.Counter({
    name: 'cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['cache_type']
});

const cacheMisses = new promClient.Counter({
    name: 'cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['cache_type']
});

// Register custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeConnections);
register.registerMetric(databaseQueries);
register.registerMetric(cacheHits);
register.registerMetric(cacheMisses);

// Middleware for request metrics
const metricsMiddleware = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route ? req.route.path : req.path;
        
        httpRequestDuration
            .labels(req.method, route, res.statusCode)
            .observe(duration);
        
        httpRequestTotal
            .labels(req.method, route, res.statusCode)
            .inc();
    });
    
    next();
};

module.exports = {
    register,
    metrics: {
        httpRequestDuration,
        httpRequestTotal,
        activeConnections,
        databaseQueries,
        cacheHits,
        cacheMisses
    },
    middleware: metricsMiddleware
};
```

### Logging Configuration

#### Winston Logger Setup
```javascript
// logger.js
const winston = require('winston');
const path = require('path');

// Custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
);

// Production format (JSON for log aggregation)
const productionFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'production' ? productionFormat : logFormat,
    defaultMeta: {
        service: 'bugsnap-api',
        version: process.env.npm_package_version || '1.0.0'
    },
    transports: [
        // Console transport
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        
        // File transports
        new winston.transports.File({
            filename: path.join(process.cwd(), 'logs', 'error.log'),
            level: 'error',
            maxsize: 50 * 1024 * 1024, // 50MB
            maxFiles: 5,
            tailable: true
        }),
        
        new winston.transports.File({
            filename: path.join(process.cwd(), 'logs', 'combined.log'),
            maxsize: 100 * 1024 * 1024, // 100MB
            maxFiles: 5,
            tailable: true
        })
    ],
    
    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(process.cwd(), 'logs', 'exceptions.log')
        })
    ],
    
    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(process.cwd(), 'logs', 'rejections.log')
        })
    ]
});

// Add request logging middleware
const requestLogger = winston.format((info, opts) => {
    if (info.req) {
        info.request = {
            method: info.req.method,
            url: info.req.url,
            headers: info.req.headers,
            ip: info.req.ip,
            userAgent: info.req.get('User-Agent')
        };
        delete info.req;
    }
    
    if (info.res) {
        info.response = {
            statusCode: info.res.statusCode,
            headers: info.res.getHeaders()
        };
        delete info.res;
    }
    
    return info;
});

// Export logger
module.exports = logger;
```

---

## 🔒 Security Hardening

### SSL/TLS Configuration

#### Generate SSL Certificates
```bash
# Using Let's Encrypt (Certbot)
sudo apt install certbot python3-certbot-nginx

# Generate certificates
sudo certbot --nginx -d api.bugsnap.codemine.tech

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### SSL Security Headers
```javascript
// security.js
const helmet = require('helmet');

const securityConfig = {
    // Content Security Policy
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    
    // HTTP Strict Transport Security
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    
    // Additional security headers
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: { policy: 'same-origin' }
};

module.exports = helmet(securityConfig);
```

### Environment Security

#### Secrets Management
```bash
# Using AWS Secrets Manager
aws secretsmanager create-secret \
    --name "bugsnap/production/database" \
    --description "BugSnap production database credentials" \
    --secret-string '{"username":"admin","password":"SecurePassword123!"}'

# Using Docker Secrets
echo "secure_password" | docker secret create db_password -

# Using Kubernetes Secrets
kubectl create secret generic bugsnap-secrets \
    --from-literal=mongodb-uri="mongodb+srv://..." \
    --from-literal=jwt-secret="your-jwt-secret"
```

#### Firewall Configuration
```bash
# UFW (Ubuntu Firewall)
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow application port (internal only)
sudo ufw allow from 10.0.0.0/8 to any port 8019

# Deny all other traffic
sudo ufw --force enable
```

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database connection tested
- [ ] Redis connection tested
- [ ] Load balancer configured
- [ ] Monitoring setup completed
- [ ] Backup strategy implemented
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Health checks implemented

### Deployment
- [ ] Docker images built and tested
- [ ] Database migrations run
- [ ] Services deployed
- [ ] Health checks passing
- [ ] Load balancer routing configured
- [ ] DNS records updated
- [ ] SSL certificates validated
- [ ] Performance tests run

### Post-Deployment
- [ ] Monitoring dashboards updated
- [ ] Alerts configured
- [ ] Team notified
- [ ] Documentation updated
- [ ] Rollback plan documented
- [ ] Performance metrics baseline established
- [ ] Security scan completed
- [ ] User acceptance testing completed

---

**Deployment Version**: 1.0.0  
**Last Updated**: October 2025  
**Review Schedule**: Monthly  
**Next Review**: November 2025