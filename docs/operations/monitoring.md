# BugSnap Monitoring & Operations

## 📊 Comprehensive Monitoring Guide

This guide covers monitoring, alerting, troubleshooting, and maintenance procedures for BugSnap production environments.

## 🎯 Monitoring Strategy

### Key Performance Indicators (KPIs)

#### Application Metrics
```yaml
Response Time:
  - Target: < 200ms (95th percentile)
  - Warning: > 500ms
  - Critical: > 1000ms

Throughput:
  - Target: > 100 requests/second
  - Warning: < 50 requests/second
  - Critical: < 10 requests/second

Error Rate:
  - Target: < 1%
  - Warning: > 2%
  - Critical: > 5%

Availability:
  - Target: 99.9% uptime
  - Warning: < 99.5%
  - Critical: < 99%
```

#### Infrastructure Metrics
```yaml
CPU Usage:
  - Target: < 70%
  - Warning: > 80%
  - Critical: > 90%

Memory Usage:
  - Target: < 80%
  - Warning: > 85%
  - Critical: > 95%

Disk Usage:
  - Target: < 70%
  - Warning: > 80%
  - Critical: > 90%

Network I/O:
  - Target: < 80% bandwidth
  - Warning: > 90%
  - Critical: > 95%
```

#### Database Metrics
```yaml
Connection Pool:
  - Target: < 80% utilization
  - Warning: > 90%
  - Critical: > 95%

Query Performance:
  - Target: < 100ms average
  - Warning: > 500ms
  - Critical: > 1000ms

Replication Lag:
  - Target: < 1 second
  - Warning: > 5 seconds
  - Critical: > 10 seconds
```

---

## 🔧 Monitoring Stack Setup

### Prometheus Configuration

#### prometheus.yml
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  # BugSnap API metrics
  - job_name: 'bugsnap-api'
    static_configs:
      - targets: ['bugsnap-api:8019']
    metrics_path: '/metrics'
    scrape_interval: 30s
    scrape_timeout: 10s

  # Node Exporter (system metrics)
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  # MongoDB metrics
  - job_name: 'mongodb-exporter'
    static_configs:
      - targets: ['mongodb-exporter:9216']

  # Redis metrics
  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Nginx metrics
  - job_name: 'nginx-exporter'
    static_configs:
      - targets: ['nginx-exporter:9113']

  # Blackbox monitoring (external endpoints)
  - job_name: 'blackbox'
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
        - https://api.bugsnap.codemine.tech/health
        - https://bugsnap.codemine.tech
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter:9115
```

### Alert Rules

#### alert_rules.yml
```yaml
groups:
  - name: bugsnap_alerts
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
          service: bugsnap-api
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"

      # High response time
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
          service: bugsnap-api
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s"

      # Service down
      - alert: ServiceDown
        expr: up{job="bugsnap-api"} == 0
        for: 1m
        labels:
          severity: critical
          service: bugsnap-api
        annotations:
          summary: "BugSnap API is down"
          description: "BugSnap API has been down for more than 1 minute"

      # High CPU usage
      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
          service: infrastructure
        annotations:
          summary: "High CPU usage detected"
          description: "CPU usage is {{ $value }}% on {{ $labels.instance }}"

      # High memory usage
      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: warning
          service: infrastructure
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is {{ $value }}% on {{ $labels.instance }}"

      # Database connection issues
      - alert: DatabaseConnectionFailure
        expr: mongodb_up == 0
        for: 1m
        labels:
          severity: critical
          service: database
        annotations:
          summary: "Database connection failure"
          description: "Cannot connect to MongoDB database"

      # Redis connection issues
      - alert: RedisConnectionFailure
        expr: redis_up == 0
        for: 1m
        labels:
          severity: critical
          service: cache
        annotations:
          summary: "Redis connection failure"
          description: "Cannot connect to Redis cache"

      # Disk space warning
      - alert: DiskSpaceWarning
        expr: (1 - node_filesystem_avail_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes{fstype!="tmpfs"}) * 100 > 80
        for: 5m
        labels:
          severity: warning
          service: infrastructure
        annotations:
          summary: "Disk space warning"
          description: "Disk usage is {{ $value }}% on {{ $labels.instance }}"

      # SSL certificate expiration
      - alert: SSLCertificateExpiring
        expr: probe_ssl_earliest_cert_expiry - time() < 7 * 24 * 3600
        for: 1h
        labels:
          severity: warning
          service: security
        annotations:
          summary: "SSL certificate expiring soon"
          description: "SSL certificate expires in {{ $value | humanizeDuration }}"
```

### Grafana Dashboards

#### BugSnap API Dashboard
```json
{
  "dashboard": {
    "id": null,
    "title": "BugSnap API Monitoring",
    "description": "Comprehensive monitoring dashboard for BugSnap API",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{ method }} {{ route }}"
          }
        ],
        "yAxes": [
          {
            "label": "Requests per second",
            "min": 0
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          },
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "99th percentile"
          }
        ],
        "yAxes": [
          {
            "label": "Response time (seconds)",
            "min": 0
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"4..\"}[5m])",
            "legendFormat": "4xx errors"
          },
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ],
        "yAxes": [
          {
            "label": "Errors per second",
            "min": 0
          }
        ]
      },
      {
        "title": "Active Users",
        "type": "stat",
        "targets": [
          {
            "expr": "active_connections",
            "legendFormat": "Active connections"
          }
        ]
      },
      {
        "title": "Database Queries",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(database_queries_total[5m])",
            "legendFormat": "{{ operation }} {{ collection }}"
          }
        ],
        "yAxes": [
          {
            "label": "Queries per second",
            "min": 0
          }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m])) * 100",
            "legendFormat": "Cache hit rate"
          }
        ],
        "unit": "percent"
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
```

---

## 🚨 Alerting Configuration

### Alertmanager Setup

#### alertmanager.yml
```yaml
global:
  smtp_smarthost: 'smtp.sendgrid.net:587'
  smtp_from: 'alerts@bugsnap.codemine.tech'
  smtp_auth_username: 'apikey'
  smtp_auth_password: 'SG.your_sendgrid_api_key'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      group_wait: 0s
      repeat_interval: 5m
    - match:
        severity: warning
      receiver: 'warning-alerts'
      repeat_interval: 4h

receivers:
  - name: 'default'
    email_configs:
      - to: 'team@bugsnap.codemine.tech'
        subject: '[BugSnap] {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Labels: {{ range .Labels.SortedPairs }} {{ .Name }}={{ .Value }} {{ end }}
          {{ end }}

  - name: 'critical-alerts'
    email_configs:
      - to: 'oncall@bugsnap.codemine.tech'
        subject: '[CRITICAL] BugSnap Alert: {{ .GroupLabels.alertname }}'
        body: |
          🚨 CRITICAL ALERT 🚨
          
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Severity: {{ .Labels.severity }}
          Service: {{ .Labels.service }}
          Time: {{ .StartsAt.Format "2006-01-02 15:04:05 UTC" }}
          
          Labels: {{ range .Labels.SortedPairs }} {{ .Name }}={{ .Value }} {{ end }}
          {{ end }}
          
          Please investigate immediately.
    
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#alerts'
        title: '🚨 Critical Alert: {{ .GroupLabels.alertname }}'
        text: |
          {{ range .Alerts }}
          *{{ .Annotations.summary }}*
          {{ .Annotations.description }}
          
          Service: {{ .Labels.service }}
          Severity: {{ .Labels.severity }}
          {{ end }}
        actions:
          - type: button
            text: 'View Grafana'
            url: 'https://grafana.bugsnap.codemine.tech'
          - type: button
            text: 'View Logs'
            url: 'https://logs.bugsnap.codemine.tech'

  - name: 'warning-alerts'
    email_configs:
      - to: 'team@bugsnap.codemine.tech'
        subject: '[WARNING] BugSnap Alert: {{ .GroupLabels.alertname }}'
        body: |
          ⚠️ WARNING ALERT ⚠️
          
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Service: {{ .Labels.service }}
          Time: {{ .StartsAt.Format "2006-01-02 15:04:05 UTC" }}
          {{ end }}

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
```

---

## 🔍 Log Management

### Centralized Logging with ELK Stack

#### Filebeat Configuration
```yaml
# filebeat.yml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /opt/bugsnap/logs/*.log
    fields:
      service: bugsnap-api
      environment: production
    fields_under_root: true
    multiline.pattern: '^\d{4}-\d{2}-\d{2}'
    multiline.negate: true
    multiline.match: after

  - type: docker
    containers.ids:
      - "*"
    processors:
      - add_docker_metadata:
          host: "unix:///var/run/docker.sock"

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "bugsnap-logs-%{+yyyy.MM.dd}"

setup.template.name: "bugsnap"
setup.template.pattern: "bugsnap-*"

logging.level: info
logging.to_files: true
logging.files:
  path: /var/log/filebeat
  name: filebeat
  keepfiles: 7
  permissions: 0644
```

#### Logstash Pipeline
```ruby
# logstash.conf
input {
  beats {
    port => 5044
  }
}

filter {
  if [service] == "bugsnap-api" {
    json {
      source => "message"
    }
    
    date {
      match => [ "timestamp", "ISO8601" ]
    }
    
    if [level] == "error" {
      mutate {
        add_tag => ["error"]
      }
    }
    
    if [level] in ["warn", "warning"] {
      mutate {
        add_tag => ["warning"]
      }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "bugsnap-logs-%{+YYYY.MM.dd}"
  }
  
  if "error" in [tags] {
    email {
      to => "team@bugsnap.codemine.tech"
      subject => "BugSnap Error Alert"
      body => "Error occurred: %{message}"
    }
  }
}
```

### Log Analysis Queries

#### Elasticsearch Queries
```json
// Find all errors in the last hour
{
  "query": {
    "bool": {
      "must": [
        {
          "term": {
            "level": "error"
          }
        },
        {
          "range": {
            "@timestamp": {
              "gte": "now-1h"
            }
          }
        }
      ]
    }
  },
  "sort": [
    {
      "@timestamp": {
        "order": "desc"
      }
    }
  ]
}

// Top error messages
{
  "aggs": {
    "error_messages": {
      "terms": {
        "field": "message.keyword",
        "size": 10
      }
    }
  },
  "query": {
    "bool": {
      "must": [
        {
          "term": {
            "level": "error"
          }
        },
        {
          "range": {
            "@timestamp": {
              "gte": "now-24h"
            }
          }
        }
      ]
    }
  }
}

// Request rate over time
{
  "aggs": {
    "requests_over_time": {
      "date_histogram": {
        "field": "@timestamp",
        "interval": "1m"
      }
    }
  },
  "query": {
    "bool": {
      "must": [
        {
          "exists": {
            "field": "request.method"
          }
        },
        {
          "range": {
            "@timestamp": {
              "gte": "now-1h"
            }
          }
        }
      ]
    }
  }
}
```

---

## 🛠️ Troubleshooting Runbook

### Common Issues and Solutions

#### High Response Time

**Symptoms:**
- API response times > 1 second
- User complaints about slow loading
- Timeout errors

**Investigation Steps:**
```bash
# 1. Check current response times
curl -w "@curl-format.txt" -o /dev/null -s https://api.bugsnap.codemine.tech/health

# 2. Check database performance
db.runCommand({currentOp: true})

# 3. Check slow queries
db.setProfilingLevel(2, {slowms: 100})
db.system.profile.find().sort({ts: -1}).limit(10)

# 4. Check Redis performance
redis-cli --latency -h redis-host

# 5. Check server resources
top -p $(pgrep node)
```

**Common Causes and Solutions:**
```yaml
Database Issues:
  - Missing indexes: Add proper indexes
  - Slow queries: Optimize query patterns
  - Connection pool exhaustion: Increase pool size

Memory Issues:
  - Memory leaks: Restart application, investigate code
  - Insufficient memory: Scale up server resources
  - Garbage collection issues: Tune Node.js GC settings

Network Issues:
  - High latency: Check network connectivity
  - Bandwidth saturation: Monitor network usage
  - DNS resolution: Check DNS performance
```

#### High Error Rate

**Symptoms:**
- 5xx error rate > 5%
- User reports of application failures
- Failed health checks

**Investigation Steps:**
```bash
# 1. Check error logs
tail -f /opt/bugsnap/logs/error.log

# 2. Check application logs
docker logs bugsnap-api --tail=100

# 3. Check database connectivity
mongo --eval "db.runCommand('ping')"

# 4. Check Redis connectivity
redis-cli ping

# 5. Check external dependencies
curl -f https://api.external-service.com/health
```

**Common Solutions:**
```yaml
Database Connection Issues:
  - Check MongoDB Atlas status
  - Verify connection string
  - Check firewall rules
  - Restart database connection pool

Authentication Issues:
  - Verify OAuth provider status
  - Check JWT token expiration
  - Validate environment variables

External Service Issues:
  - Check Cloudinary status
  - Verify API credentials
  - Implement circuit breaker pattern
```

#### Memory Leaks

**Symptoms:**
- Gradually increasing memory usage
- Application becomes unresponsive
- Out of memory errors

**Investigation Steps:**
```bash
# 1. Monitor memory usage
ps aux | grep node
free -h

# 2. Generate heap dump
kill -USR2 $(pgrep node)

# 3. Analyze heap dump
node --inspect index.js
# Use Chrome DevTools Memory tab

# 4. Check for memory leaks
node --trace-gc index.js
```

**Prevention and Solutions:**
```javascript
// Memory leak prevention patterns

// 1. Proper event listener cleanup
const emitter = new EventEmitter();
const handler = () => { /* handler code */ };
emitter.on('event', handler);

// Clean up when done
emitter.removeListener('event', handler);

// 2. Clear timers and intervals
const timer = setInterval(() => {
  // timer code
}, 1000);

// Clear when done
clearInterval(timer);

// 3. Proper stream handling
const stream = fs.createReadStream('file.txt');
stream.on('data', (chunk) => {
  // process chunk
});
stream.on('end', () => {
  stream.destroy(); // Ensure cleanup
});

// 4. Database connection cleanup
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});
```

---

## 🔄 Maintenance Procedures

### Regular Maintenance Tasks

#### Daily Tasks
```bash
#!/bin/bash
# daily-maintenance.sh

# Check disk space
df -h

# Check log file sizes
du -sh /opt/bugsnap/logs/*

# Rotate logs if necessary
if [[ $(du -m /opt/bugsnap/logs/combined.log | cut -f1) -gt 100 ]]; then
    logrotate /etc/logrotate.d/bugsnap
fi

# Check database performance
mongo --eval "
  db.runCommand({serverStatus: 1}).metrics
"

# Check Redis memory usage
redis-cli info memory

# Health check
curl -f https://api.bugsnap.codemine.tech/health || echo "Health check failed"

# Check SSL certificate expiration
openssl s_client -connect api.bugsnap.codemine.tech:443 -servername api.bugsnap.codemine.tech 2>/dev/null | openssl x509 -noout -dates
```

#### Weekly Tasks
```bash
#!/bin/bash
# weekly-maintenance.sh

# Database optimization
mongo --eval "
  db.adminCommand({planCacheClear: 1});
  db.runCommand({reIndex: 'bugs'});
  db.runCommand({reIndex: 'users'});
  db.runCommand({reIndex: 'teams'});
"

# Clean up old logs
find /opt/bugsnap/logs -name "*.log" -mtime +30 -delete

# Update dependencies (non-breaking)
cd /opt/bugsnap
npm audit fix --only=prod

# Backup verification
if [[ -f "/opt/backups/bugsnap/latest.tar.gz" ]]; then
    echo "Latest backup exists"
else
    echo "WARNING: No recent backup found"
fi

# Performance report
echo "Weekly Performance Report" > /tmp/weekly-report.txt
echo "=========================" >> /tmp/weekly-report.txt
echo "Average response time: $(awk '{sum+=$1} END {print sum/NR}' /tmp/response-times.log)" >> /tmp/weekly-report.txt
echo "Total requests: $(wc -l /tmp/requests.log)" >> /tmp/weekly-report.txt
echo "Error rate: $(grep -c 'ERROR' /opt/bugsnap/logs/combined.log)" >> /tmp/weekly-report.txt

# Send report
mail -s "BugSnap Weekly Report" team@bugsnap.codemine.tech < /tmp/weekly-report.txt
```

#### Monthly Tasks
```bash
#!/bin/bash
# monthly-maintenance.sh

# Full system update
sudo apt update && sudo apt upgrade -y

# Docker image cleanup
docker system prune -af --volumes

# Database maintenance
mongo --eval "
  db.runCommand({compact: 'bugs'});
  db.runCommand({compact: 'users'});
  db.runCommand({compact: 'teams'});
  db.runCommand({compact: 'comments'});
"

# SSL certificate renewal check
certbot renew --dry-run

# Security audit
npm audit --audit-level high

# Capacity planning review
echo "Monthly Capacity Review" > /tmp/capacity-report.txt
echo "======================" >> /tmp/capacity-report.txt
echo "Disk usage: $(df -h /)" >> /tmp/capacity-report.txt
echo "Memory usage: $(free -h)" >> /tmp/capacity-report.txt
echo "Database size: $(du -sh /var/lib/mongodb)" >> /tmp/capacity-report.txt
echo "User growth: $(mongo --quiet --eval "db.users.count()")" >> /tmp/capacity-report.txt
echo "Team growth: $(mongo --quiet --eval "db.teams.count()")" >> /tmp/capacity-report.txt
echo "Bug reports: $(mongo --quiet --eval "db.bugs.count()")" >> /tmp/capacity-report.txt
```

### Backup and Recovery

#### Automated Backup Script
```bash
#!/bin/bash
# backup.sh - Automated backup script

set -e

BACKUP_DIR="/opt/backups/bugsnap"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"

# Create backup directory
mkdir -p "$BACKUP_PATH"

# Database backup
echo "Backing up MongoDB..."
mongodump --uri="$MONGODB_URI" --out="$BACKUP_PATH/mongodb"

# Redis backup
echo "Backing up Redis..."
redis-cli --rdb "$BACKUP_PATH/redis.rdb"

# Application files backup
echo "Backing up application files..."
tar -czf "$BACKUP_PATH/application.tar.gz" \
    /opt/bugsnap \
    --exclude=/opt/bugsnap/node_modules \
    --exclude=/opt/bugsnap/logs

# Upload to S3 (if configured)
if [[ -n "${AWS_S3_BUCKET:-}" ]]; then
    echo "Uploading to S3..."
    aws s3 sync "$BACKUP_PATH" "s3://$AWS_S3_BUCKET/backups/$TIMESTAMP/"
fi

# Create symlink to latest backup
ln -sfn "$BACKUP_PATH" "$BACKUP_DIR/latest"

# Clean up old backups (keep last 7 days)
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;

echo "Backup completed: $BACKUP_PATH"
```

#### Recovery Procedures
```bash
#!/bin/bash
# recovery.sh - Database recovery script

BACKUP_PATH="${1:-/opt/backups/bugsnap/latest}"

if [[ ! -d "$BACKUP_PATH" ]]; then
    echo "Error: Backup path not found: $BACKUP_PATH"
    exit 1
fi

echo "Starting recovery from: $BACKUP_PATH"

# Stop application
docker-compose down

# Restore MongoDB
echo "Restoring MongoDB..."
mongorestore --uri="$MONGODB_URI" --drop "$BACKUP_PATH/mongodb"

# Restore Redis
echo "Restoring Redis..."
cp "$BACKUP_PATH/redis.rdb" /var/lib/redis/dump.rdb
chown redis:redis /var/lib/redis/dump.rdb

# Start services
docker-compose up -d

# Verify recovery
sleep 30
curl -f https://api.bugsnap.codemine.tech/health

echo "Recovery completed successfully"
```

---

## 📊 Performance Optimization

### Database Optimization

#### Index Management
```javascript
// Critical indexes for performance
db.bugs.createIndex({"team": 1, "status": 1, "createdAt": -1});
db.bugs.createIndex({"assignee": 1, "status": 1});
db.bugs.createIndex({"reporter": 1, "createdAt": -1});
db.bugs.createIndex({"tags": 1, "team": 1});
db.bugs.createIndex({"$text": {"title": "text", "description": "text"}});

db.users.createIndex({"email": 1}, {"unique": true});
db.users.createIndex({"teams": 1});

db.teams.createIndex({"members": 1});
db.teams.createIndex({"admins": 1});
db.teams.createIndex({"owner": 1});

db.comments.createIndex({"bug": 1, "createdAt": -1});
db.comments.createIndex({"author": 1, "createdAt": -1});

// Check index usage
db.bugs.explain("executionStats").find({"team": ObjectId("..."), "status": "open"});
```

#### Query Optimization
```javascript
// Optimized aggregation for bug statistics
db.bugs.aggregate([
    {
        $match: {
            team: ObjectId("team_id"),
            createdAt: {
                $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
        }
    },
    {
        $group: {
            _id: "$status",
            count: { $sum: 1 },
            avgResponseTime: { $avg: "$responseTime" }
        }
    }
]);

// Pagination optimization
db.bugs.find({"team": ObjectId("team_id")})
    .sort({"createdAt": -1})
    .skip(page * limit)
    .limit(limit);
```

### Application Optimization

#### Caching Strategy
```javascript
// Redis caching implementation
const redis = require('redis');
const client = redis.createClient();

// Cache frequently accessed data
const getUserTeams = async (userId) => {
    const cacheKey = `user:${userId}:teams`;
    
    // Try cache first
    const cached = await client.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }
    
    // Fetch from database
    const teams = await Team.find({
        $or: [
            { members: userId },
            { admins: userId },
            { owner: userId }
        ]
    });
    
    // Cache for 1 hour
    await client.setex(cacheKey, 3600, JSON.stringify(teams));
    
    return teams;
};

// Cache invalidation
const invalidateUserCache = async (userId) => {
    const pattern = `user:${userId}:*`;
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
        await client.del(keys);
    }
};
```

#### Connection Pooling
```javascript
// MongoDB connection optimization
const mongoose = require('mongoose');

const mongooseOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    bufferMaxEntries: 0, // Disable mongoose buffering
    bufferCommands: false, // Disable mongoose buffering
};

mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
```

---

**Operations Version**: 1.0.0  
**Last Updated**: October 2025  
**Review Schedule**: Monthly  
**Emergency Contact**: oncall@bugsnap.codemine.tech