# BugSnap Backend - Production Deployment Guide

## 🚀 Overview

BugSnap Backend is a comprehensive Node.js/Express.js API server for bug tracking and team collaboration. It provides secure authentication, real-time collaboration, file management, and complete bug lifecycle management.

## 📋 Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Installation](#installation)
- [Production Deployment](#production-deployment)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Security Features](#security-features)
- [Monitoring & Logging](#monitoring--logging)
- [Troubleshooting](#troubleshooting)

## 🏗️ Architecture

### Core Technologies
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.21+
- **Database**: MongoDB (Atlas recommended for production)
- **Cache**: Redis (Upstash recommended for production)
- **File Storage**: Cloudinary
- **Authentication**: JWT + OAuth (Google, GitHub)
- **Documentation**: Swagger/OpenAPI 3.0
- **Process Manager**: PM2 (recommended for production)

### Project Structure
```
Backend/
├── index.js                 # Main application entry point
├── connection.js            # MongoDB connection configuration
├── package.json             # Dependencies and scripts
├── 
├── config/                  # Configuration files
│   └── redis.js            # Redis configuration
├── 
├── controller/              # Business logic controllers
│   ├── bug.js              # Bug management operations
│   ├── comment.js          # Comment CRUD operations
│   ├── file.js             # File upload/management
│   ├── oauth.js            # OAuth authentication (Google/GitHub)
│   ├── people.js           # Team member management
│   ├── team.js             # Team operations
│   └── user.js             # User authentication & management
├── 
├── middleware/              # Custom middleware
│   ├── index.js            # Authentication middleware
│   ├── error.js            # Global error handler
│   ├── multer.js           # File upload middleware
│   ├── redis.js            # Redis caching middleware
│   └── teamMiddleware.js   # Team authorization middleware
├── 
├── model/                   # MongoDB/Mongoose schemas
│   ├── activityLog.js      # Activity tracking schema
│   ├── bug.js              # Bug entity schema
│   ├── comment.js          # Comment schema
│   ├── file.js             # File metadata schema
│   ├── invite.js           # Team invitation schema
│   ├── resetToken.js       # Password reset token schema
│   ├── team.js             # Team schema
│   └── user.js             # User schema
├── 
├── routes/                  # API route definitions
│   ├── authRouter.js       # OAuth routes (/auth/*)
│   ├── bot.js              # AI integration routes
│   ├── bug.js              # Bug API routes (/bug/*)
│   ├── comment.js          # Comment API routes (/comment/*)
│   ├── media.js            # File/media routes (/media/*)
│   ├── people.js           # People management routes (/people/*)
│   ├── team.js             # Team API routes (/team/*)
│   └── user.js             # User API routes (/user/*)
├── 
├── service/                 # Business services
│   ├── auth.js             # JWT token management
│   ├── encrypt.js          # Data encryption/decryption
│   └── couldinary.js       # Cloudinary integration
├── 
├── utils/                   # Utility functions
│   ├── dateFilterUtils.js  # Date filtering utilities
│   ├── logActivity.js      # Activity logging
│   ├── queryUtils.js       # Database query utilities
│   ├── setTokenCookie.js   # Cookie management
│   └── teamUtils.js        # Team-related utilities
└── 
└── view/                    # EJS templates (optional)
    ├── home.ejs            # Home page template
    ├── login.ejs           # Login page template
    ├── resetpassword.ejs   # Password reset template
    └── signup.ejs          # Signup page template
```

## ✨ Features

### Core Features
- **User Management**: Registration, login, password reset, profile management
- **OAuth Integration**: Google and GitHub authentication
- **Team Collaboration**: Create teams, invite members, role-based access
- **Bug Tracking**: Complete bug lifecycle management
- **File Management**: Upload, store, and manage attachments via Cloudinary
- **Real-time Comments**: Comment system for bugs and collaboration
- **Activity Logging**: Track all user actions and system events
- **Search & Filtering**: Advanced search capabilities for bugs and teams

### Security Features
- **JWT Authentication**: Secure token-based authentication
- **Password Encryption**: Bcrypt hashing for password security
- **Data Encryption**: AES encryption for sensitive data
- **CORS Protection**: Configurable CORS policies
- **Rate Limiting**: Redis-based rate limiting
- **Input Validation**: Comprehensive input sanitization
- **Team Authorization**: Role-based access control

### API Features
- **RESTful Design**: Clean, predictable API endpoints
- **Swagger Documentation**: Complete API documentation at `/api-docs`
- **Pagination**: Efficient data pagination for large datasets
- **Error Handling**: Standardized error responses
- **Caching**: Redis-based response caching
- **File Upload**: Multipart file upload support

## 🔧 Prerequisites

### System Requirements
- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher
- **MongoDB**: 5.0+ (Atlas recommended)
- **Redis**: 6.0+ (Upstash recommended)

### External Services
- **MongoDB Atlas**: Database hosting
- **Upstash Redis**: Cache and session storage
- **Cloudinary**: File and image storage
- **Google OAuth**: Authentication provider
- **GitHub OAuth**: Authentication provider
- **Email Service**: SMTP for notifications (Gmail recommended)

## ⚙️ Environment Configuration

### Required Environment Variables

Create a `.env` file in the Backend directory:

```env
# Application Configuration
NODE_ENV=production
PORT=8019

# Security Keys
ACCESS_TOKEN_SECRET=your_access_token_secret_here
REFRESH_TOKEN_SECRET=your_refresh_token_secret_here
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_SECRET_KEY=your_32_character_encryption_key_here

# Database Configuration
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/BugSnap?retryWrites=true&w=majority

# Redis Configuration
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token_here

# OAuth Configuration - Google
Google_Client_Id_P=your_google_client_id.apps.googleusercontent.com
Google_Client_Secret_P=your_google_client_secret
GOOGLE_REDIRECT_URI_P=https://your-api-domain.com/auth/google/callback

# OAuth Configuration - GitHub
GITHUB_CLIENT_ID_P=your_github_client_id
GITHUB_CLIENT_SECRET_P=your_github_client_secret
GITHUB_REDIRECT_URI_P=https://your-api-domain.com/auth/github/callback

# Frontend Configuration
FRONTEND_URL_MAIN_P=https://your-frontend-domain.com
BACKEND_URL_MAIN_P=https://your-api-domain.com

# Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_specific_password

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Application Settings
BUGS_PER_PAGE=20
LOGO_URL=https://your-frontend-domain.com/logo.svg
```

### Environment-Specific Configuration

The application supports different configurations for development and production environments through environment variables suffixed with `_P` for production.

## 📦 Installation

### Local Development Setup

1. **Clone and Install Dependencies**
```bash
cd Backend
npm install
```

2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start Development Server**
```bash
npm start
# Server runs on http://localhost:8019
```

### Production Installation

1. **Server Setup**
```bash
# Install Node.js 18+ and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
npm install -g pm2
```

2. **Application Deployment**
```bash
# Clone repository
git clone <your-repo-url>
cd Backend

# Install production dependencies
npm install --production

# Configure environment
nano .env
# Add production environment variables
```

3. **Start with PM2**
```bash
# Start application with PM2
pm2 start index.js --name "bugsnap-backend"

# Save PM2 configuration
pm2 save
pm2 startup
```

## 🚀 Production Deployment

### Recommended Deployment Architecture

```
Internet
    ↓
Load Balancer (Nginx/Cloudflare)
    ↓
Reverse Proxy (Nginx)
    ↓
Node.js Application (PM2)
    ↓
Database (MongoDB Atlas)
    ↓
Cache (Upstash Redis)
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8019;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### PM2 Ecosystem Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'bugsnap-backend',
    script: 'index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8019
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
```

Start with: `pm2 start ecosystem.config.js`

### SSL Configuration

Use Certbot for free SSL certificates:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

## 📚 API Documentation

### Base URL
```
Production: https://api.yourdomain.com
Development: http://localhost:8019
```

### Interactive Documentation
Visit `/api-docs` for complete Swagger documentation:
- Production: `https://api.yourdomain.com/api-docs`
- Development: `http://localhost:8019/api-docs`

### API Endpoints Overview

#### Authentication Routes (`/auth/*`)
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/github` - Initiate GitHub OAuth
- `GET /auth/github/callback` - GitHub OAuth callback

#### User Routes (`/user/*`)
- `POST /user/signup` - User registration
- `POST /user/login` - User login
- `POST /user/logout` - User logout
- `GET /user/me` - Get current user
- `POST /user/forgot-password` - Request password reset
- `POST /user/reset-password` - Reset password

#### Team Routes (`/team/*`)
- `POST /team/create` - Create new team
- `GET /team/:id` - Get team details
- `POST /team/:id/invite` - Invite team member
- `DELETE /team/:id/remove/:userId` - Remove team member
- `PUT /team/:id/update` - Update team settings

#### Bug Routes (`/bug/*`)
- `POST /bug/create` - Create new bug
- `GET /bug/all` - List all bugs (paginated)
- `GET /bug/:id` - Get bug details
- `PUT /bug/:id/update` - Update bug
- `DELETE /bug/:id/delete` - Delete bug
- `POST /bug/:id/assign` - Assign bug to user

#### Comment Routes (`/comment/*`)
- `POST /comment/create` - Add comment to bug
- `GET /comment/:bugId` - Get comments for bug
- `PUT /comment/:id/update` - Update comment
- `DELETE /comment/:id/delete` - Delete comment

#### File Routes (`/media/*`)
- `POST /media/upload` - Upload file
- `GET /media/:id` - Get file details
- `DELETE /media/:id` - Delete file

#### People Routes (`/people/*`)
- `GET /people/search` - Search users
- `POST /people/invite` - Send invitation
- `GET /people/invitations` - Get pending invitations

### Authentication

Most endpoints require authentication via JWT token:

```javascript
// Include in request headers
Authorization: Bearer <your_jwt_token>
```

### Response Format

All API responses follow this standard format:

```javascript
// Success Response
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}

// Error Response
{
  "success": false,
  "error": "Error description",
  "statusCode": 400
}
```

## 🗄️ Database Schema

### User Model
```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  password: String (hashed),
  avatar: String,
  isVerified: Boolean,
  teams: [ObjectId],
  createdAt: Date,
  updatedAt: Date
}
```

### Team Model
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  owner: ObjectId,
  members: [ObjectId],
  admins: [ObjectId],
  createdAt: Date,
  updatedAt: Date
}
```

### Bug Model
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  status: String, // "open", "in-progress", "closed"
  priority: String, // "low", "medium", "high", "critical"
  assignee: ObjectId,
  reporter: ObjectId,
  team: ObjectId,
  tags: [String],
  attachments: [ObjectId],
  createdAt: Date,
  updatedAt: Date
}
```

### Comment Model
```javascript
{
  _id: ObjectId,
  content: String,
  author: ObjectId,
  bug: ObjectId,
  attachments: [ObjectId],
  createdAt: Date,
  updatedAt: Date
}
```

## 🔒 Security Features

### Authentication & Authorization
- **JWT Tokens**: Secure, stateless authentication
- **Refresh Tokens**: Long-term authentication with rotation
- **OAuth Integration**: Google and GitHub SSO
- **Role-Based Access**: Team-level permissions
- **Session Management**: Redis-based session storage

### Data Protection
- **Password Hashing**: Bcrypt with salt rounds
- **Data Encryption**: AES-256 for sensitive data
- **Input Validation**: Comprehensive sanitization
- **SQL Injection Prevention**: Mongoose ODM protection
- **XSS Protection**: Content sanitization

### Network Security
- **CORS Configuration**: Restricted origin policies
- **Rate Limiting**: Redis-based request limiting
- **HTTPS Enforcement**: SSL/TLS in production
- **Security Headers**: Helmet.js integration recommended

## 📊 Monitoring & Logging

### Application Logging
- **Winston Logger**: Structured logging (recommended to add)
- **Error Tracking**: Comprehensive error capture
- **Activity Logs**: User action tracking
- **Performance Monitoring**: Response time tracking

### Production Monitoring
- **PM2 Monitoring**: Built-in process monitoring
- **Health Checks**: `/health` endpoint (recommended to add)
- **Memory Usage**: Node.js memory monitoring
- **Database Monitoring**: MongoDB Atlas built-in monitoring

### Log Management
```bash
# PM2 Logs
pm2 logs bugsnap-backend
pm2 logs --lines 100

# Application Logs (if Winston is implemented)
tail -f logs/app.log
tail -f logs/error.log
```

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check MongoDB connection
node -e "require('./connection.js')"

# Verify environment variables
echo $MONGO_URL
```

#### Redis Connection Issues
```bash
# Test Redis connection
npm run test-redis

# Check Upstash Redis dashboard
```

#### OAuth Issues
```bash
# Verify OAuth credentials
echo $Google_Client_Id_P
echo $GITHUB_CLIENT_ID_P

# Check redirect URIs match exactly
```

#### Memory Issues
```bash
# Monitor memory usage
pm2 monit

# Restart if high memory usage
pm2 restart bugsnap-backend
```

### Performance Optimization

#### Database Optimization
- **Indexing**: Ensure proper MongoDB indexes
- **Connection Pooling**: Mongoose connection optimization
- **Query Optimization**: Use aggregation pipelines efficiently

#### Caching Strategy
- **Redis Caching**: Implement response caching
- **Database Caching**: MongoDB query result caching
- **CDN Integration**: Cloudinary CDN for static assets

#### Server Optimization
- **Clustering**: Use PM2 cluster mode
- **Load Balancing**: Nginx upstream configuration
- **Compression**: Gzip compression middleware

### Backup Strategy

#### Database Backup
```bash
# MongoDB Atlas automated backups (recommended)
# Manual backup command:
mongodump --uri="your_mongo_uri" --out=backup/$(date +%Y%m%d)
```

#### File Backup
- **Cloudinary**: Built-in redundancy and backup
- **Application Code**: Git repository backup
- **Environment Files**: Secure environment backup

## 📞 Support & Maintenance

### Regular Maintenance Tasks
- **Security Updates**: Keep dependencies updated
- **Database Maintenance**: Regular index optimization
- **Log Rotation**: Implement log rotation policies
- **Performance Review**: Monthly performance analysis

### Emergency Procedures
- **Rollback Plan**: Git-based deployment rollback
- **Database Recovery**: MongoDB Atlas point-in-time recovery
- **Service Recovery**: PM2 automatic restart policies

### Contact Information
- **Development Team**: [Your team contact]
- **DevOps Support**: [Your DevOps contact]
- **Emergency Hotline**: [Your emergency contact]

---

## 📝 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

**Last Updated**: October 2025
**Version**: 1.0.0
**Maintainer**: BugSnap Development Team