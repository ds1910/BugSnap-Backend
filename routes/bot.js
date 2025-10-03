const express = require("express");
const BotController = require("../Agent/controllers/bot");

const router = express.Router();

/**
 * @swagger
 * /bot/chat:
 *   post:
 *     summary: Chat with AI assistant
 *     tags: [Bot]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: User's message to the bot
 *               context:
 *                 type: object
 *                 description: Optional conversation context
 *           example:
 *             message: "Show me all high priority bugs"
 *             context: {}
 *     responses:
 *       200:
 *         description: Bot response with intent analysis and actions
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.post("/chat", BotController.chat);

/**
 * @swagger
 * /bot/query:
 *   post:
 *     summary: Process natural language database query
 *     tags: [Bot]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: Natural language query to process
 *               queryType:
 *                 type: string
 *                 enum: [general, analytics, search]
 *                 description: Type of query being performed
 *           example:
 *             query: "Show me all high priority bugs created this week"
 *             queryType: "search"
 *     responses:
 *       200:
 *         description: Query results with parsed intent and data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     query:
 *                       type: string
 *                     intent:
 *                       type: string
 *                     confidence:
 *                       type: number
 *                     entities:
 *                       type: object
 *                     results:
 *                       type: array
 *                     queryType:
 *                       type: string
 *                     executionTime:
 *                       type: number
 *                     suggestions:
 *                       type: array
 *       400:
 *         description: Invalid query format
 *       500:
 *         description: Query processing failed
 */
router.post("/query", BotController.processNaturalQuery);

/**
 * @swagger
 * /bot/suggestions:
 *   get:
 *     summary: Get query suggestions based on context
 *     tags: [Bot]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: context
 *         schema:
 *           type: string
 *           enum: [general, bugs, users, teams, analytics]
 *         description: Context for generating relevant suggestions
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *           enum: [all, bugs, users, teams, comments, files]
 *         description: Specific entity type for suggestions
 *     responses:
 *       200:
 *         description: List of query suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     context:
 *                       type: string
 *                     entityType:
 *                       type: string
 */
router.get("/suggestions", BotController.getQuerySuggestions);

/**
 * @swagger
 * /bot/context:
 *   get:
 *     summary: Get user context and initial suggestions
 *     tags: [Bot]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User context and suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     context:
 *                       type: object
 *                       description: User's current context
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Contextual suggestions
 */
router.get("/context", BotController.getUserContext);

module.exports = router;