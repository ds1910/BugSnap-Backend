# BugSnap API Reference

## 📚 Complete API Documentation

This is the comprehensive API reference for BugSnap, a collaborative bug tracking and team management platform.

## 📖 Table of Contents

### [🔐 Authentication](./authentication.md)
Complete authentication guide including JWT, OAuth, and session management.

### [👥 User Management](#user-management)
User registration, profile management, and account operations.

### [🏢 Team Management](#team-management)
Team creation, member management, and collaboration features.

### [🐛 Bug Tracking](#bug-tracking)
Bug creation, assignment, tracking, and resolution workflows.

### [💬 Comments & Communication](#comments--communication)
Comment system, notifications, and team communication.

### [📁 File Management](#file-management)
File uploads, attachments, and media handling.

---

## 🌐 API Base URLs

### Development Environment
```
http://localhost:8019
```

### Production Environment
```
https://api.bugsnap.codemine.tech
```

## 📋 Common Response Format

All API responses follow a consistent format:

### Success Response
```javascript
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response payload
  },
  "meta": {
    "timestamp": "2025-01-14T10:30:45.123Z",
    "requestId": "req_abc123",
    "version": "1.0.0"
  }
}
```

### Error Response
```javascript
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": "Detailed error information",
    "field": "fieldName" // For validation errors
  },
  "meta": {
    "timestamp": "2025-01-14T10:30:45.123Z",
    "requestId": "req_abc123",
    "version": "1.0.0"
  }
}
```

## 🔐 Authentication Headers

Most endpoints require authentication. Include the JWT token in the Authorization header:

```javascript
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

# User Management

## 👤 User Registration

### POST `/user/signup`

Create a new user account.

#### Request Body
```javascript
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}
```

#### Response
```javascript
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "isVerified": false,
      "createdAt": "2025-01-14T10:30:45.123Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

#### Validation Rules
- **name**: 2-50 characters, letters and spaces only
- **email**: Valid email format, must be unique
- **password**: Minimum 8 characters, at least one uppercase, lowercase, number

---

## 🔑 User Login

### POST `/user/login`

Authenticate user and receive JWT tokens.

#### Request Body
```javascript
{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}
```

#### Response
```javascript
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "teams": [
        {
          "id": "507f1f77bcf86cd799439012",
          "name": "Development Team",
          "role": "member"
        }
      ]
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

---

## 👥 Get Current User

### GET `/user/me`
**🔐 Authentication Required**

Get current user profile and team memberships.

#### Response
```javascript
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "profilePicture": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/profiles/user_abc123.jpg",
    "isVerified": true,
    "teams": [
      {
        "id": "507f1f77bcf86cd799439012",
        "name": "Development Team",
        "role": "admin",
        "joinedAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "createdAt": "2025-01-01T00:00:00.000Z",
    "lastLogin": "2025-01-14T10:30:45.123Z"
  }
}
```

---

## ✏️ Update User Profile

### PUT `/user/me`
**🔐 Authentication Required**

Update current user profile information.

#### Request Body
```javascript
{
  "name": "John Smith",
  "profilePicture": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..." // Base64 or URL
}
```

#### Response
```javascript
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Smith",
    "email": "john.doe@example.com",
    "profilePicture": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/profiles/user_abc123_updated.jpg",
    "updatedAt": "2025-01-14T10:30:45.123Z"
  }
}
```

---

## 🔄 Change Password

### PUT `/user/change-password`
**🔐 Authentication Required**

Change user password.

#### Request Body
```javascript
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword456!"
}
```

#### Response
```javascript
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## 🚪 User Logout

### POST `/user/logout`
**🔐 Authentication Required**

Logout user and invalidate tokens.

#### Response
```javascript
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

# Team Management

## 🏢 Create Team

### POST `/team/create`
**🔐 Authentication Required**

Create a new team.

#### Request Body
```javascript
{
  "name": "Development Team",
  "description": "Main development team for BugSnap project",
  "isPrivate": false
}
```

#### Response
```javascript
{
  "success": true,
  "message": "Team created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "name": "Development Team",
    "description": "Main development team for BugSnap project",
    "isPrivate": false,
    "owner": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john.doe@example.com"
    },
    "members": [],
    "admins": [],
    "inviteCode": "DEV-TEAM-ABC123",
    "createdAt": "2025-01-14T10:30:45.123Z"
  }
}
```

---

## 📋 Get User Teams

### GET `/team/user-teams`
**🔐 Authentication Required**

Get all teams where the current user is a member.

#### Response
```javascript
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439012",
      "name": "Development Team",
      "description": "Main development team for BugSnap project",
      "role": "owner",
      "memberCount": 5,
      "bugCount": 12,
      "lastActivity": "2025-01-14T09:15:30.456Z",
      "createdAt": "2025-01-01T00:00:00.000Z"
    },
    {
      "id": "507f1f77bcf86cd799439013",
      "name": "QA Team",
      "description": "Quality assurance team",
      "role": "member",
      "memberCount": 3,
      "bugCount": 8,
      "lastActivity": "2025-01-13T15:20:10.789Z",
      "createdAt": "2025-01-05T00:00:00.000Z"
    }
  ]
}
```

---

## 🔍 Get Team Details

### GET `/team/:teamId`
**🔐 Authentication Required** | **Team Membership Required**

Get detailed information about a specific team.

#### Response
```javascript
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "name": "Development Team",
    "description": "Main development team for BugSnap project",
    "isPrivate": false,
    "owner": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "profilePicture": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/profiles/john.jpg"
    },
    "admins": [
      {
        "id": "507f1f77bcf86cd799439014",
        "name": "Jane Smith",
        "email": "jane.smith@example.com",
        "profilePicture": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/profiles/jane.jpg",
        "joinedAt": "2025-01-02T00:00:00.000Z"
      }
    ],
    "members": [
      {
        "id": "507f1f77bcf86cd799439015",
        "name": "Bob Johnson",
        "email": "bob.johnson@example.com",
        "profilePicture": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/profiles/bob.jpg",
        "joinedAt": "2025-01-03T00:00:00.000Z",
        "lastActive": "2025-01-14T08:45:22.123Z"
      }
    ],
    "statistics": {
      "totalMembers": 3,
      "totalBugs": 12,
      "openBugs": 8,
      "closedBugs": 4,
      "totalComments": 45
    },
    "inviteCode": "DEV-TEAM-ABC123",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-14T10:30:45.123Z"
  }
}
```

---

## ✉️ Invite Team Members

### POST `/team/:teamId/invite`
**🔐 Authentication Required** | **Team Admin Required**

Invite users to join the team.

#### Request Body
```javascript
{
  "emails": [
    "newuser@example.com",
    "another@example.com"
  ],
  "message": "Join our development team to collaborate on BugSnap!"
}
```

#### Response
```javascript
{
  "success": true,
  "message": "Invitations sent successfully",
  "data": {
    "sent": [
      {
        "email": "newuser@example.com",
        "inviteId": "invite_abc123",
        "expiresAt": "2025-01-21T10:30:45.123Z"
      },
      {
        "email": "another@example.com",
        "inviteId": "invite_def456",
        "expiresAt": "2025-01-21T10:30:45.123Z"
      }
    ],
    "failed": []
  }
}
```

---

## 🤝 Join Team by Invite Code

### POST `/team/join`
**🔐 Authentication Required**

Join a team using an invite code.

#### Request Body
```javascript
{
  "inviteCode": "DEV-TEAM-ABC123"
}
```

#### Response
```javascript
{
  "success": true,
  "message": "Successfully joined team",
  "data": {
    "team": {
      "id": "507f1f77bcf86cd799439012",
      "name": "Development Team",
      "description": "Main development team for BugSnap project",
      "role": "member"
    }
  }
}
```

---

# Bug Tracking

## 🐛 Create Bug

### POST `/bug/create`
**🔐 Authentication Required** | **Team Membership Required**

Create a new bug report.

#### Request Body
```javascript
{
  "title": "Login button not responding",
  "description": "When clicking the login button, nothing happens. No error message is shown.",
  "priority": "high",
  "severity": "major",
  "teamId": "507f1f77bcf86cd799439012",
  "assigneeId": "507f1f77bcf86cd799439015",
  "tags": ["frontend", "authentication", "ui"],
  "stepsToReproduce": [
    "Navigate to login page",
    "Enter valid credentials",
    "Click login button",
    "Observe no response"
  ],
  "expectedBehavior": "User should be logged in and redirected to dashboard",
  "actualBehavior": "Nothing happens when clicking login button",
  "environment": {
    "browser": "Chrome 120.0.0.0",
    "os": "Windows 11",
    "device": "Desktop"
  },
  "attachments": [
    {
      "type": "image",
      "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...",
      "filename": "login-screenshot.png"
    }
  ]
}
```

#### Response
```javascript
{
  "success": true,
  "message": "Bug created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439016",
    "title": "Login button not responding",
    "description": "When clicking the login button, nothing happens. No error message is shown.",
    "status": "open",
    "priority": "high",
    "severity": "major",
    "reporter": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john.doe@example.com"
    },
    "assignee": {
      "id": "507f1f77bcf86cd799439015",
      "name": "Bob Johnson",
      "email": "bob.johnson@example.com"
    },
    "team": {
      "id": "507f1f77bcf86cd799439012",
      "name": "Development Team"
    },
    "tags": ["frontend", "authentication", "ui"],
    "bugNumber": "BUG-001",
    "attachments": [
      {
        "id": "att_abc123",
        "filename": "login-screenshot.png",
        "url": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/attachments/login-screenshot.png",
        "type": "image/png",
        "size": 245760
      }
    ],
    "createdAt": "2025-01-14T10:30:45.123Z",
    "updatedAt": "2025-01-14T10:30:45.123Z"
  }
}
```

---

## 📋 Get Team Bugs

### GET `/bug/all?teamId=:teamId`
**🔐 Authentication Required** | **Team Membership Required**

Get all bugs for a specific team with filtering and pagination.

#### Query Parameters
```javascript
// Pagination
page=1              // Page number (default: 1)
limit=20            // Items per page (default: 20, max: 100)

// Filtering
status=open         // Bug status: open, in-progress, resolved, closed
priority=high       // Priority: low, medium, high, critical
severity=major      // Severity: minor, major, critical, blocker
assigneeId=507f...  // Filter by assignee ID
reporterId=507f...  // Filter by reporter ID
tags=frontend,ui    // Filter by tags (comma-separated)

// Sorting
sortBy=createdAt    // Sort field: createdAt, updatedAt, priority, severity, title
sortOrder=desc      // Sort order: asc, desc

// Search
search=login        // Search in title and description
```

#### Response
```javascript
{
  "success": true,
  "data": {
    "bugs": [
      {
        "id": "507f1f77bcf86cd799439016",
        "title": "Login button not responding",
        "description": "When clicking the login button...",
        "status": "open",
        "priority": "high",
        "severity": "major",
        "bugNumber": "BUG-001",
        "reporter": {
          "id": "507f1f77bcf86cd799439011",
          "name": "John Doe",
          "profilePicture": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/profiles/john.jpg"
        },
        "assignee": {
          "id": "507f1f77bcf86cd799439015",
          "name": "Bob Johnson",
          "profilePicture": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/profiles/bob.jpg"
        },
        "tags": ["frontend", "authentication", "ui"],
        "commentCount": 3,
        "attachmentCount": 1,
        "createdAt": "2025-01-14T10:30:45.123Z",
        "updatedAt": "2025-01-14T11:15:22.456Z"
      }
    ],
    "pagination": {
      "current": 1,
      "total": 5,
      "limit": 20,
      "totalBugs": 87,
      "hasNext": true,
      "hasPrev": false
    },
    "filters": {
      "status": ["open", "in-progress", "resolved", "closed"],
      "priority": ["low", "medium", "high", "critical"],
      "severity": ["minor", "major", "critical", "blocker"],
      "assignees": [
        {
          "id": "507f1f77bcf86cd799439015",
          "name": "Bob Johnson",
          "bugCount": 12
        }
      ],
      "tags": [
        {
          "name": "frontend",
          "count": 25
        },
        {
          "name": "backend",
          "count": 18
        }
      ]
    }
  }
}
```

---

## 🔍 Get Bug Details

### GET `/bug/:bugId`
**🔐 Authentication Required** | **Team Membership Required**

Get detailed information about a specific bug.

#### Response
```javascript
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439016",
    "title": "Login button not responding",
    "description": "When clicking the login button, nothing happens. No error message is shown.",
    "status": "in-progress",
    "priority": "high",
    "severity": "major",
    "bugNumber": "BUG-001",
    "reporter": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "profilePicture": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/profiles/john.jpg"
    },
    "assignee": {
      "id": "507f1f77bcf86cd799439015",
      "name": "Bob Johnson",
      "email": "bob.johnson@example.com",
      "profilePicture": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/profiles/bob.jpg"
    },
    "team": {
      "id": "507f1f77bcf86cd799439012",
      "name": "Development Team"
    },
    "tags": ["frontend", "authentication", "ui"],
    "stepsToReproduce": [
      "Navigate to login page",
      "Enter valid credentials",
      "Click login button",
      "Observe no response"
    ],
    "expectedBehavior": "User should be logged in and redirected to dashboard",
    "actualBehavior": "Nothing happens when clicking login button",
    "environment": {
      "browser": "Chrome 120.0.0.0",
      "os": "Windows 11",
      "device": "Desktop"
    },
    "attachments": [
      {
        "id": "att_abc123",
        "filename": "login-screenshot.png",
        "url": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/attachments/login-screenshot.png",
        "type": "image/png",
        "size": 245760,
        "uploadedAt": "2025-01-14T10:30:45.123Z"
      }
    ],
    "comments": [
      {
        "id": "comment_xyz789",
        "content": "I can reproduce this issue. Looking into the JavaScript console errors.",
        "author": {
          "id": "507f1f77bcf86cd799439015",
          "name": "Bob Johnson",
          "profilePicture": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/profiles/bob.jpg"
        },
        "createdAt": "2025-01-14T11:15:22.456Z"
      }
    ],
    "activity": [
      {
        "type": "status_change",
        "from": "open",
        "to": "in-progress",
        "user": {
          "id": "507f1f77bcf86cd799439015",
          "name": "Bob Johnson"
        },
        "timestamp": "2025-01-14T11:00:00.000Z"
      },
      {
        "type": "assignment",
        "assignee": {
          "id": "507f1f77bcf86cd799439015",
          "name": "Bob Johnson"
        },
        "user": {
          "id": "507f1f77bcf86cd799439011",
          "name": "John Doe"
        },
        "timestamp": "2025-01-14T10:35:00.000Z"
      }
    ],
    "createdAt": "2025-01-14T10:30:45.123Z",
    "updatedAt": "2025-01-14T11:15:22.456Z"
  }
}
```

---

## ✏️ Update Bug

### PUT `/bug/:bugId`
**🔐 Authentication Required** | **Team Membership Required** | **Reporter/Assignee/Admin Required**

Update bug information.

#### Request Body
```javascript
{
  "title": "Login button not responding - Updated",
  "description": "Updated description with more details...",
  "status": "resolved",
  "priority": "medium",
  "severity": "major",
  "assigneeId": "507f1f77bcf86cd799439015",
  "tags": ["frontend", "authentication", "ui", "fixed"],
  "resolution": "Fixed event listener issue in login component"
}
```

#### Response
```javascript
{
  "success": true,
  "message": "Bug updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439016",
    "title": "Login button not responding - Updated",
    "status": "resolved",
    "priority": "medium",
    "resolution": "Fixed event listener issue in login component",
    "updatedAt": "2025-01-14T12:30:45.123Z"
  }
}
```

---

# Comments & Communication

## 💬 Add Comment

### POST `/comment/add`
**🔐 Authentication Required** | **Team Membership Required**

Add a comment to a bug.

#### Request Body
```javascript
{
  "bugId": "507f1f77bcf86cd799439016",
  "content": "I found the issue! The event listener was not properly attached to the login button.",
  "attachments": [
    {
      "type": "image",
      "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...",
      "filename": "fix-screenshot.png"
    }
  ]
}
```

#### Response
```javascript
{
  "success": true,
  "message": "Comment added successfully",
  "data": {
    "id": "comment_abc123",
    "content": "I found the issue! The event listener was not properly attached to the login button.",
    "author": {
      "id": "507f1f77bcf86cd799439015",
      "name": "Bob Johnson",
      "email": "bob.johnson@example.com",
      "profilePicture": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/profiles/bob.jpg"
    },
    "bug": {
      "id": "507f1f77bcf86cd799439016",
      "title": "Login button not responding",
      "bugNumber": "BUG-001"
    },
    "attachments": [
      {
        "id": "att_def456",
        "filename": "fix-screenshot.png",
        "url": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/attachments/fix-screenshot.png",
        "type": "image/png",
        "size": 189432
      }
    ],
    "createdAt": "2025-01-14T12:45:30.789Z",
    "updatedAt": "2025-01-14T12:45:30.789Z"
  }
}
```

---

## 📝 Get Bug Comments

### GET `/comment/bug/:bugId`
**🔐 Authentication Required** | **Team Membership Required**

Get all comments for a specific bug.

#### Query Parameters
```javascript
page=1       // Page number (default: 1)
limit=20     // Items per page (default: 20)
sortOrder=asc // Sort order: asc (oldest first), desc (newest first)
```

#### Response
```javascript
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": "comment_abc123",
        "content": "I can reproduce this issue. Looking into the JavaScript console errors.",
        "author": {
          "id": "507f1f77bcf86cd799439015",
          "name": "Bob Johnson",
          "profilePicture": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/profiles/bob.jpg"
        },
        "attachments": [],
        "createdAt": "2025-01-14T11:15:22.456Z",
        "updatedAt": "2025-01-14T11:15:22.456Z"
      },
      {
        "id": "comment_def456",
        "content": "I found the issue! The event listener was not properly attached to the login button.",
        "author": {
          "id": "507f1f77bcf86cd799439015",
          "name": "Bob Johnson",
          "profilePicture": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/profiles/bob.jpg"
        },
        "attachments": [
          {
            "id": "att_ghi789",
            "filename": "fix-screenshot.png",
            "url": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/attachments/fix-screenshot.png",
            "type": "image/png",
            "size": 189432
          }
        ],
        "createdAt": "2025-01-14T12:45:30.789Z",
        "updatedAt": "2025-01-14T12:45:30.789Z"
      }
    ],
    "pagination": {
      "current": 1,
      "total": 1,
      "limit": 20,
      "totalComments": 2,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

---

# File Management

## 📁 Upload File

### POST `/media/upload`
**🔐 Authentication Required**

Upload files/images to Cloudinary.

#### Request Body (Form Data)
```javascript
// FormData with file upload
const formData = new FormData();
formData.append('file', fileBlob, 'screenshot.png');
formData.append('type', 'image'); // 'image', 'document', 'video'
```

#### Response
```javascript
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "id": "file_abc123",
    "filename": "screenshot.png",
    "originalName": "screenshot.png",
    "url": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/uploads/screenshot.png",
    "secureUrl": "https://res.cloudinary.com/bugsnap/image/upload/v1234567890/uploads/screenshot.png",
    "type": "image/png",
    "size": 245760,
    "dimensions": {
      "width": 1920,
      "height": 1080
    },
    "uploadedBy": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe"
    },
    "uploadedAt": "2025-01-14T13:00:00.000Z"
  }
}
```

---

## 🗑️ Delete File

### DELETE `/media/:fileId`
**🔐 Authentication Required** | **File Owner Required**

Delete an uploaded file.

#### Response
```javascript
{
  "success": true,
  "message": "File deleted successfully"
}
```

---

## 📊 Error Codes Reference

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `TOKEN_EXPIRED` | 401 | Access token expired |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

---

## 📈 Rate Limiting

Rate limits are applied per IP address and user:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| General API | 1000 requests | 1 hour |
| File Upload | 50 uploads | 1 hour |
| Team Creation | 5 teams | 1 day |

When rate limited, the response includes headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1705234845
```

---

## 🔧 Development Tools

### API Testing with cURL

```bash
# Login and get tokens
curl -X POST https://api.bugsnap.codemine.tech/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Use token for authenticated requests
curl -X GET https://api.bugsnap.codemine.tech/user/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Create a bug
curl -X POST https://api.bugsnap.codemine.tech/bug/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Bug","description":"Testing API","teamId":"<team_id>"}'
```

### Postman Collection

Download the complete Postman collection: [BugSnap API Collection](../testing/BugSnap-API.postman_collection.json)

### SDK Examples

#### JavaScript/Node.js
```javascript
const BugSnapAPI = require('@bugsnap/api-client');

const client = new BugSnapAPI({
  baseURL: 'https://api.bugsnap.codemine.tech',
  accessToken: 'your_access_token'
});

// Create a bug
const bug = await client.bugs.create({
  title: 'Login button not working',
  description: 'Button doesn\'t respond to clicks',
  teamId: 'team_123'
});

console.log('Bug created:', bug.id);
```

---

**API Version**: 1.0.0  
**Last Updated**: October 2025  
**Documentation**: [Full Documentation](../README.md)  
**Support**: [GitHub Issues](https://github.com/bugsnap/api/issues)