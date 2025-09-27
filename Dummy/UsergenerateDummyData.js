// generateUsers.js
const fs = require("fs");

// ---------- Helpers ----------
const indianFirstNames = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Krishna", "Rohan",
  "Ananya", "Diya", "Ishita", "Kavya", "Saanvi", "Riya", "Aditi", "Meera",
  "Priya", "Neha", "Tanvi", "Pooja", "Kiran", "Manish", "Suresh", "Rajesh",
  "Rahul", "Deepak", "Sanjay", "Alok", "Anil", "Vikas"
];

const indianLastNames = [
  "Sharma", "Verma", "Gupta", "Agarwal", "Patel", "Reddy", "Iyer", "Nair",
  "Kumar", "Yadav", "Singh", "Chopra", "Deshmukh", "Chaudhary", "Mehta",
  "Joshi", "Jain", "Bhatia", "Das", "Ghosh", "Roy", "Mukherjee", "Banerjee",
  "Kulkarni", "Pandey", "Tripathi", "Mishra", "Rastogi", "Bhattacharya"
];

const emailDomains = ["gmail.com", "yahoo.com", "outlook.com", "rediffmail.com"];

// Helper: random element
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Helper: generate random phone number (Indian style)
const randomPhone = () => {
  const prefix = ["98", "99", "97", "96", "95", "94"];
  return prefix[Math.floor(Math.random() * prefix.length)] + Math.floor(10000000 + Math.random() * 90000000);
};

// ---------- Generate Users ----------
const generateUsers = (count = 300) => {
  return Array.from({ length: count }, (_, i) => {
    const firstName = rand(indianFirstNames);
    const lastName = rand(indianLastNames);
    const fullName = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(
      Math.random() * 1000
    )}@${rand(emailDomains)}`;

    return {
      id: `user${i + 1}`,
      name: fullName,
      email,
      phone: `+91${randomPhone()}`,
      image: `https://i.pravatar.cc/150?img=${(i % 70) + 1}`, // realistic avatars
      password: "password123", // DB should hash later
      friends: [],
    };
  });
};

// ---------- Main Execution ----------
const users = generateUsers(300);

fs.writeFileSync("users.json", JSON.stringify(users, null, 2));

console.log("✅ users.json generated with realistic Indian dummy users!");
