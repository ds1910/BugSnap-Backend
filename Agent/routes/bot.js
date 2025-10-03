const express = require("express");
const BotController = require("../controllers/bot");
const cache = require("../../middleware/redis");

const router = express.Router();

// Chat endpoint
router.post("/chat", BotController.chat);

// Natural language query endpoint
router.post("/query", BotController.processNaturalQuery);

// Get query suggestions
router.get("/suggestions", BotController.getQuerySuggestions);

// Note: Health check endpoint is now handled at /bot/health in main index.js (public access)

module.exports = router;
