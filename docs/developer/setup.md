# Development Setup Guide

## 🚀 Quick Start

### Prerequisites Checklist
- [ ] **Node.js 18.0+** installed
- [ ] **npm 8.0+** or **yarn 1.22+**
- [ ] **Git** latest version
- [ ] **MongoDB** (local) or **MongoDB Atlas** account
- [ ] **Redis** (local) or **Upstash Redis** account
- [ ] **Code Editor** (VS Code recommended)

### Environment Setup

#### 1. Clone Repository
```bash
git clone <repository-url>
cd Backend
```

#### 2. Install Dependencies
```bash
# Using npm
npm install

# Or using yarn
yarn install
```

#### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
nano .env
```

#### 4. Database Setup
```bash
# Option A: Local MongoDB
brew install mongodb-community
brew services start mongodb-community

# Option B: MongoDB Atlas (recommended)
# Create account at https://cloud.mongodb.com
# Create cluster and get connection string
```

#### 5. Redis Setup
```bash
# Option A: Local Redis
brew install redis
brew services start redis

# Option B: Upstash Redis (recommended)
# Create account at https://upstash.com
# Create database and get connection details
```

#### 6. Start Development Server
```bash
npm start
# Server will start on http://localhost:8019
```

## ⚙️ Environment Configuration

### Required Environment Variables

Create `.env` file with the following configuration:

```env
# ========================================
# Application Configuration
# ========================================
NODE_ENV=development
PORT=8019

# ========================================
# Security Configuration
# ========================================
ACCESS_TOKEN_SECRET=your_super_secure_access_token_secret_min_32_chars
REFRESH_TOKEN_SECRET=your_super_secure_refresh_token_secret_min_32_chars
JWT_SECRET=your_jwt_secret_key_min_32_characters
ENCRYPTION_SECRET_KEY=your_32_character_encryption_key_here_exactly

# ========================================
# Database Configuration
# ========================================

# MongoDB (choose one)
# Local MongoDB
MONGO_URL=mongodb://localhost:27017/bugsnap-dev

# MongoDB Atlas (recommended)
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/bugsnap-dev?retryWrites=true&w=majority

# ========================================
# Redis Configuration
# ========================================

# Local Redis
REDIS_URL=redis://localhost:6379

# Upstash Redis (recommended)
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token_here

# ========================================
# OAuth Configuration - Development
# ========================================

# Google OAuth
Google_Client_Id=your_google_client_id.apps.googleusercontent.com
Google_Client_Secret=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8019/auth/google/callback

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:8019/auth/github/callback

# ========================================
# Email Configuration
# ========================================
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_specific_password

# ========================================
# File Storage Configuration
# ========================================
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# ========================================
# Frontend Configuration
# ========================================
FRONTEND_URL_MAIN=http://localhost:5173
BACKEND_URL_MAIN=http://localhost:8019

# ========================================
# Application Settings
# ========================================
BUGS_PER_PAGE=20
LOGO_URL=http://localhost:5173/favicon.svg
```

### Environment Variable Generation

#### Generate Secure Secrets
```bash
# Generate secure random strings
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or using OpenSSL
openssl rand -hex 32
```

#### Verify Environment Loading
```bash
# Test environment variables
node -e "require('dotenv').config(); console.log('MongoDB:', process.env.MONGO_URL); console.log('Redis:', process.env.UPSTASH_REDIS_REST_URL);"
```

## 🔧 Development Tools Setup

### VS Code Configuration

#### Recommended Extensions
```json
{
  "recommendations": [
    "ms-vscode.vscode-json",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "ms-vscode.thunderclient",
    "humao.rest-client",
    "mongodb.mongodb-vscode"
  ]
}
```

#### Workspace Settings (`.vscode/settings.json`)
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "emmet.includeLanguages": {
    "javascript": "javascriptreact"
  },
  "editor.tabSize": 2,
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.env": true
  }
}
```

#### Debug Configuration (`.vscode/launch.json`)
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch BugSnap Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/index.js",
      "env": {
        "NODE_ENV": "development"
      },
      "envFile": "${workspaceFolder}/.env",
      "console": "integratedTerminal",
      "restart": true,
      "runtimeExecutable": "nodemon",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Git Configuration

#### Git Hooks Setup
```bash
# Install husky for git hooks
npm install --save-dev husky

# Setup pre-commit hook
npx husky add .husky/pre-commit "npm run lint"
```

#### `.gitignore` Additions
```gitignore
# Environment files
.env
.env.local
.env.development
.env.production

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed

# Coverage directory used by tools like istanbul
coverage/

# IDE files
.vscode/settings.json
.idea/

# OS generated files
.DS_Store
Thumbs.db
```

## 🧪 Development Workflow

### Daily Development Process

#### 1. Start Development Environment
```bash
# Terminal 1: Start Backend
cd Backend
npm start

# Terminal 2: Start Frontend (if working full-stack)
cd Frontend
npm run dev

# Terminal 3: Monitor logs
tail -f logs/app.log
```

#### 2. Code Quality Checks
```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Run tests
npm test

# Check test coverage
npm run test:coverage
```

#### 3. Database Operations
```bash
# Check database connection
npm run db:check

# Reset development database
npm run db:reset

# Seed development data
npm run db:seed
```

### API Testing Setup

#### Postman Collection Import
1. Open Postman
2. Import collection from `/testing/BugSnap-API.postman_collection.json`
3. Set environment variables:
   - `baseUrl`: `http://localhost:8019`
   - `authToken`: Your JWT token

#### Thunder Client (VS Code)
```json
// thunder-tests/environments/development.json
{
  "name": "Development",
  "variables": [
    {
      "name": "baseUrl",
      "value": "http://localhost:8019"
    },
    {
      "name": "authToken",
      "value": "your_jwt_token_here"
    }
  ]
}
```

#### Manual API Testing
```bash
# Health check
curl http://localhost:8019/health

# Test authentication
curl -X POST http://localhost:8019/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## 🚨 Common Development Issues

### Issue 1: MongoDB Connection Errors
```bash
# Problem: MongoNetworkError or connection timeout
# Solution 1: Check MongoDB service
brew services list | grep mongodb

# Solution 2: Verify connection string
node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGO_URL); mongoose.connection.on('connected', () => console.log('Connected!')); mongoose.connection.on('error', (err) => console.log('Error:', err));"

# Solution 3: Check network/firewall (for Atlas)
# Ensure your IP is whitelisted in MongoDB Atlas
```

### Issue 2: Redis Connection Issues
```bash
# Problem: Redis connection refused
# Solution 1: Check Redis service
brew services list | grep redis

# Solution 2: Test Redis connection
redis-cli ping

# Solution 3: Verify Redis URL
node -e "const redis = require('redis'); const client = redis.createClient(process.env.REDIS_URL); client.on('connect', () => console.log('Redis connected!')); client.connect();"
```

### Issue 3: Environment Variables Not Loading
```bash
# Problem: undefined environment variables
# Solution 1: Check .env file exists and is in correct location
ls -la .env

# Solution 2: Verify dotenv is loaded
node -e "require('dotenv').config(); console.log('Loaded vars:', Object.keys(process.env).filter(key => !key.startsWith('npm_')).length);"

# Solution 3: Check for syntax errors in .env
cat .env | grep -n "="
```

### Issue 4: Port Already in Use
```bash
# Problem: EADDRINUSE error on port 8019
# Solution 1: Find process using port
lsof -ti:8019

# Solution 2: Kill process
kill -9 $(lsof -ti:8019)

# Solution 3: Use different port
PORT=8020 npm start
```

### Issue 5: OAuth Configuration Issues
```bash
# Problem: OAuth redirects failing
# Check Google OAuth configuration:
# 1. Authorized redirect URIs include: http://localhost:8019/auth/google/callback
# 2. Client ID and secret are correct

# Check GitHub OAuth configuration:
# 1. Authorization callback URL: http://localhost:8019/auth/github/callback
# 2. Application is set for development use
```

## 📁 Project Structure for Development

### Key Development Files
```
Backend/
├── .env                    # Environment variables (DO NOT COMMIT)
├── .env.example           # Environment template
├── .gitignore             # Git ignore rules
├── .nodemonrc.json        # Nodemon configuration
├── package.json           # Dependencies and scripts
├── index.js               # Application entry point
├── 
├── docs/                  # Documentation
├── logs/                  # Application logs (created automatically)
├── uploads/               # Temporary file uploads
├── 
├── controller/            # Business logic
├── routes/                # API endpoints
├── model/                 # Database schemas
├── middleware/            # Request processing
├── service/               # Business services
├── utils/                 # Utility functions
├── config/                # Configuration files
└── testing/               # Test files and collections
```

### Development Scripts
```json
{
  "scripts": {
    "start": "nodemon index.js",
    "dev": "NODE_ENV=development nodemon index.js",
    "debug": "NODE_ENV=development node --inspect index.js",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## 🔍 Debugging Tips

### Logging Setup
```javascript
// Add to any file for debugging
console.log('🔍 Debug:', variableName);
console.error('❌ Error:', error);
console.info('ℹ️ Info:', information);
```

### Database Debugging
```javascript
// Enable Mongoose debugging
mongoose.set('debug', true);

// Log all MongoDB queries
mongoose.connection.on('query', (query) => {
  console.log('📝 Query:', query);
});
```

### Request Debugging
```javascript
// Add to any route for request debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});
```

---

**Setup Version**: 1.0.0  
**Last Updated**: October 2025  
**Next Review**: January 2026  
**Support**: dev-team@bugsnap.codemine.tech