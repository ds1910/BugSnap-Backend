# API Authentication Guide

## 🔐 Authentication Overview

BugSnap uses a multi-layered authentication system combining JWT tokens, OAuth providers, and session management to ensure secure access to all API endpoints.

## 🎯 Authentication Methods

### 1. JWT Token Authentication (Primary)

#### Token Structure
```javascript
// Access Token (Short-lived: 15 minutes)
{
  "iss": "bugsnap-api",
  "sub": "user_id",
  "iat": 1234567890,
  "exp": 1234568790,
  "type": "access",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "teams": ["team_id_1", "team_id_2"]
  }
}

// Refresh Token (Long-lived: 7 days)
{
  "iss": "bugsnap-api",
  "sub": "user_id",
  "iat": 1234567890,
  "exp": 1235172690,
  "type": "refresh"
}
```

#### Using JWT Tokens
```javascript
// Include in request headers
Authorization: Bearer <access_token>

// Example request
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  https://api.bugsnap.codemine.tech/user/me
```

### 2. OAuth 2.0 Integration

#### Google OAuth Flow
```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Google
    
    User->>Frontend: Click "Login with Google"
    Frontend->>API: GET /auth/google
    API->>Google: Redirect to Google OAuth
    Google->>User: Google Login Page
    User->>Google: Enter Credentials
    Google->>API: Authorization Code
    API->>Google: Exchange Code for Profile
    Google->>API: User Profile Data
    API->>API: Create/Update User
    API->>Frontend: JWT Tokens + User Data
    Frontend->>User: Logged In Dashboard
```

#### GitHub OAuth Flow
```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant GitHub
    
    User->>Frontend: Click "Login with GitHub"
    Frontend->>API: GET /auth/github
    API->>GitHub: Redirect to GitHub OAuth
    GitHub->>User: GitHub Login Page
    User->>GitHub: Authorize Application
    GitHub->>API: Authorization Code
    API->>GitHub: Exchange Code for Profile
    GitHub->>API: User Profile Data
    API->>API: Create/Update User
    API->>Frontend: JWT Tokens + User Data
    Frontend->>User: Logged In Dashboard
```

### 3. Email/Password Authentication

#### Registration Flow
```javascript
// POST /user/signup
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}

// Response
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "isVerified": false
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

#### Login Flow
```javascript
// POST /user/login
{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}

// Response
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "teams": ["team_id_1"]
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

## 🔄 Token Management

### Token Refresh Flow
```mermaid
sequenceDiagram
    participant Client
    participant API
    participant JWT
    participant Redis
    
    Client->>API: Request with Expired Token
    API->>Client: 401 Unauthorized
    Client->>API: POST /auth/refresh (with refresh token)
    API->>JWT: Validate Refresh Token
    JWT->>API: Token Valid
    API->>Redis: Check Blacklist
    Redis->>API: Token Not Blacklisted
    API->>JWT: Generate New Access Token
    JWT->>API: New Access Token
    API->>Client: New Tokens
    Client->>API: Retry Original Request
    API->>Client: Success Response
```

### Automatic Token Refresh
```javascript
// Frontend implementation example
class AuthService {
  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    
    try {
      const response = await axios.post('/auth/refresh', {
        refreshToken: refreshToken
      });
      
      const { accessToken, refreshToken: newRefreshToken } = response.data.tokens;
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', newRefreshToken);
      
      return accessToken;
    } catch (error) {
      // Refresh failed, redirect to login
      this.logout();
      window.location.href = '/login';
    }
  }
  
  // Axios interceptor for automatic refresh
  setupInterceptors() {
    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          const newToken = await this.refreshToken();
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return axios(originalRequest);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }
}
```

### Token Storage Best Practices

#### Secure Storage Options
```javascript
// Option 1: HttpOnly Cookies (Most Secure)
// Backend sets secure cookies
res.cookie('accessToken', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000 // 15 minutes
});

// Option 2: Local Storage (Frontend Convenience)
// Store in localStorage for SPA applications
localStorage.setItem('accessToken', token);

// Option 3: Memory Storage (Most Secure for SPA)
// Store in JavaScript variables (lost on refresh)
class TokenManager {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
  }
}
```

## 🛡️ Authorization Levels

### Public Endpoints (No Authentication)
```javascript
// No authentication required
GET  /health              // Health check
GET  /api-docs           // API documentation
POST /user/signup        // User registration
POST /user/login         // User login
POST /user/forgot-password // Password reset request
```

### Authenticated Endpoints (Valid JWT Required)
```javascript
// Requires valid access token
GET  /user/me            // Current user profile
POST /user/logout        // User logout
PUT  /user/profile       // Update profile
GET  /teams              // User's teams
```

### Team Member Endpoints (Team Membership Required)
```javascript
// Requires team membership
GET  /team/:id           // Team details
GET  /team/:id/members   // Team members
GET  /bug/all            // Bugs in team context
POST /bug/create         // Create bug in team
```

### Team Admin Endpoints (Admin Privileges Required)
```javascript
// Requires team admin role
POST /team/:id/invite    // Invite team members
PUT  /team/:id/settings  // Update team settings
DELETE /team/:id/member/:userId // Remove team member
```

### Resource Owner Endpoints (Resource Ownership Required)
```javascript
// Requires ownership or admin privileges
PUT  /bug/:id            // Update bug (reporter or assignee)
DELETE /bug/:id          // Delete bug (reporter or admin)
PUT  /comment/:id        // Update comment (author only)
DELETE /comment/:id      // Delete comment (author or admin)
```

## 🔧 Implementation Examples

### Frontend Authentication Setup

#### React Authentication Hook
```javascript
// useAuth.js
import { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem('accessToken')
  );

  // Setup axios interceptors
  useEffect(() => {
    if (accessToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [accessToken]);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      if (accessToken) {
        try {
          const response = await axios.get('/user/me');
          setUser(response.data.data);
        } catch (error) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setAccessToken(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [accessToken]);

  const login = async (email, password) => {
    try {
      const response = await axios.post('/user/login', { email, password });
      const { user, tokens } = response.data.data;
      
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      setAccessToken(tokens.accessToken);
      setUser(user);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message };
    }
  };

  const logout = async () => {
    try {
      await axios.post('/user/logout');
    } catch (error) {
      // Continue with logout even if API call fails
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setAccessToken(null);
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
```

#### Protected Route Component
```javascript
// ProtectedRoute.js
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
```

### Backend Middleware Implementation

#### Authentication Middleware
```javascript
// middleware/index.js
const jwt = require('jsonwebtoken');
const User = require('../model/user');

const checkAuthentication = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    // Get user from database
    const user = await User.findById(decoded.sub).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add user to request object
    req.user = user;
    req.token = decoded;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

module.exports = { checkAuthentication };
```

#### Team Authorization Middleware
```javascript
// middleware/teamMiddleware.js
const Team = require('../model/team');

const checkTeamMembership = async (req, res, next) => {
  try {
    const teamId = req.params.teamId || req.body.teamId || req.query.teamId;
    
    if (!teamId) {
      return res.status(400).json({
        success: false,
        message: 'Team ID is required'
      });
    }

    const team = await Team.findById(teamId);
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is a member
    const isMember = team.members.includes(req.user._id) || 
                    team.admins.includes(req.user._id) ||
                    team.owner.equals(req.user._id);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Not a team member'
      });
    }

    req.team = team;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Team authorization error'
    });
  }
};

const checkTeamAdmin = async (req, res, next) => {
  try {
    // First check team membership
    await checkTeamMembership(req, res, () => {
      // Check if user is admin or owner
      const isAdmin = req.team.admins.includes(req.user._id) ||
                     req.team.owner.equals(req.user._id);

      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Admin privileges required'
        });
      }

      next();
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Admin authorization error'
    });
  }
};

module.exports = {
  checkTeamMembership,
  checkTeamAdmin
};
```

## 🚨 Security Considerations

### Token Security
- **Short Expiration**: Access tokens expire in 15 minutes
- **Refresh Rotation**: Refresh tokens are rotated on each use
- **Secure Storage**: Use HttpOnly cookies in production
- **Token Blacklisting**: Invalidated tokens are blacklisted in Redis

### Password Security
- **Bcrypt Hashing**: Passwords hashed with bcrypt (12 rounds)
- **Password Requirements**: Minimum 8 characters, complexity requirements
- **Rate Limiting**: Login attempts rate limited per IP
- **Account Lockout**: Temporary account lockout after failed attempts

### OAuth Security
- **State Parameter**: CSRF protection for OAuth flows
- **Secure Redirects**: Validated redirect URIs only
- **Token Validation**: OAuth tokens verified with providers
- **Scope Limitation**: Minimal required scopes requested

---

**Authentication Version**: 1.0.0  
**Last Updated**: October 2025  
**Security Review**: Monthly  
**Next Review**: November 2025