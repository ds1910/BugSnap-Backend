const express = require("express");
const {
  createTeam,
  getAllTeams,
  getTeamMembers,
  getTeamById,
  addMemberToTeam,
  removeMemberFromTeam,
  updateMemberRole,
  updateTeam,
  deleteTeam,
} = require("../controller/team");

const router = express.Router();

/**
 * @swagger
 * /team/create:
 *   post:
 *     summary: Create a new team
 *     tags: [Team]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Team created successfully
 *       400:
 *         description: Invalid input
 */
router.post("/create", createTeam);

/**
 * @swagger
 * /team/{teamId}:
 *   get:
 *     summary: Get team details by ID
 *     tags: [Team]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the team
 *     responses:
 *       200:
 *         description: Team details
 *       404:
 *         description: Team not found
 */
router.get("/allTeam", getAllTeams);

/**
 * @swagger
 * /team/{teamId}/members:
 *   patch:
 *     summary: Add a member to the team
 *     tags: [Team]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the team
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: Member added successfully
 *       404:
 *         description: Team not found
 */
router.patch("/addMembers", addMemberToTeam);

router.patch("/update", updateTeam);
router.delete("/delete",deleteTeam);

/**
 * @swagger
 * /team/{teamId}/members/{userId}:
 *   delete:
 *     summary: Remove a member from the team
 *     tags: [Team]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the team
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to be removed
 *     responses:
 *       200:
 *         description: Member removed successfully
 *       404:
 *         description: Team or user not found
 */
router.patch("/remove-member", removeMemberFromTeam);

/**
 * @swagger
 * /team/{teamId}/members:
 *   get:
 *     summary: Get all members of a team
 *     tags: [Team]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the team
 *     responses:
 *       200:
 *         description: List of team members
 *       404:
 *         description: Team not found
 */
router.get("/members", getTeamMembers);

/**
 * @swagger
 * /team/{teamId}/members/{userId}/role:
 *   patch:
 *     summary: Update role of a team member
 *     tags: [Team]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: Member role updated successfully
 *       404:
 *         description: Team or user not found
 */
router.patch("/change-role", updateMemberRole);

/* ====================== EXPORT ROUTER ====================== */
module.exports = router;
