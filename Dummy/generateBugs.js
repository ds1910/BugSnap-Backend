const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { faker } = require("@faker-js/faker");

// Load JSON
const teams = JSON.parse(fs.readFileSync("teams.json", "utf-8"));
const users = JSON.parse(fs.readFileSync("users.json", "utf-8"));

const BUG_COUNT = 250; // ~200–300 bugs

// Bug pool (grouped by category with descriptions, priority, status)
const bugPool = {
  UI: [
    {
      title: "UI button not clickable",
      description: "Primary action button is unresponsive, preventing user flow.",
      priority: "high",
      status: "open",
    },
    {
      title: "Dark mode not applying correctly",
      description: "Some components still show light theme in dark mode.",
      priority: "low",
      status: "open",
    },
    {
      title: "Form validation issue",
      description: "Invalid email inputs are being accepted in the signup form.",
      priority: "medium",
      status: "in-progress",
    },
  ],
  API: [
    {
      title: "API response delay",
      description: "Profile API takes >5 seconds under load.",
      priority: "high",
      status: "in-progress",
    },
    {
      title: "Authentication token expired early",
      description: "JWT tokens expire before TTL, forcing logouts.",
      priority: "critical",
      status: "open",
    },
    {
      title: "GraphQL query error",
      description: "Nested queries return incomplete fields.",
      priority: "medium",
      status: "open",
    },
  ],
  Database: [
    {
      title: "Database query timeout",
      description: "Reports query exceeds 30s due to missing indexes.",
      priority: "critical",
      status: "open",
    },
    {
      title: "Deadlock in transaction",
      description: "Concurrent updates cause deadlocks in orders table.",
      priority: "high",
      status: "in-progress",
    },
    {
      title: "Replication lag in DB",
      description: "Read replicas lag behind primary by minutes.",
      priority: "medium",
      status: "open",
    },
  ],
  Security: [
    {
      title: "XSS vulnerability in input field",
      description: "Unsanitized comments allow script injection.",
      priority: "critical",
      status: "open",
    },
    {
      title: "CSRF token missing",
      description: "Forms do not validate CSRF tokens properly.",
      priority: "critical",
      status: "open",
    },
    {
      title: "Password change not working",
      description: "Password update silently fails, leaving accounts vulnerable.",
      priority: "high",
      status: "in-progress",
    },
  ],
  Mobile: [
    {
      title: "Crash on login",
      description: "iOS app crashes after login on iOS 16.",
      priority: "critical",
      status: "open",
    },
    {
      title: "Push notification not working",
      description: "Android devices not receiving push notifications.",
      priority: "high",
      status: "open",
    },
    {
      title: "Offline mode not working",
      description: "Cached data not loading in airplane mode.",
      priority: "medium",
      status: "in-progress",
    },
  ],
  DevOps: [
    {
      title: "Docker container crash loop",
      description: "Service restarts due to env variable misconfig.",
      priority: "high",
      status: "open",
    },
    {
      title: "CI/CD pipeline broken",
      description: "Build fails due to outdated dependencies.",
      priority: "medium",
      status: "open",
    },
    {
      title: "Monitoring alert not triggered",
      description: "CPU spike alert didn’t fire during load test.",
      priority: "critical",
      status: "resolved",
    },
  ],
};

// All categories
const sections = Object.keys(bugPool);

// Random helper
function pickRandom(arr, n = 1) {
  return arr.sort(() => 0.5 - Math.random()).slice(0, n);
}

const bugs = [];

for (let i = 0; i < BUG_COUNT; i++) {
  // Pick section + bug template
  const section = sections[Math.floor(Math.random() * sections.length)];
  const bugTemplate = bugPool[section][Math.floor(Math.random() * bugPool[section].length)];

  // Pick random team
  const team = teams[Math.floor(Math.random() * teams.length)];
  const teamMemberIds = team.members.map((m) => m.user);

  // Assigned users (2–3)
  const assignedTo = pickRandom(teamMemberIds, Math.floor(Math.random() * 2) + 2);

  // Creator must be a team member
  const createdBy = teamMemberIds[Math.floor(Math.random() * teamMemberIds.length)];

  // Build bug
  const bug = {
    _id: uuidv4(),
    title: bugTemplate.title,
    description: bugTemplate.description + " (" + faker.lorem.sentence() + ")", // add variation
    teamId: team._id,
    tags: [section.toLowerCase(), faker.hacker.noun()],
    status: bugTemplate.status,
    priority: bugTemplate.priority,
    startDate: faker.date.past(1),
    dueDate: faker.date.soon(30),
    createdBy,
    assignedTo,
    history: [
      {
        action: "created",
        detail: "Bug created",
        performedBy: createdBy,
        performedAt: faker.date.recent(30),
      },
      {
        action: "assigned",
        detail: `Assigned to ${assignedTo.length} users`,
        performedBy: createdBy,
        performedAt: faker.date.recent(20),
      },
    ],
    createdAt: faker.date.past(1),
    updatedAt: new Date(),
  };

  bugs.push(bug);
}

// Save
fs.writeFileSync("bugs.json", JSON.stringify(bugs, null, 2));
console.log(`✅ Generated ${bugs.length} dummy bugs into bugs.json`);
