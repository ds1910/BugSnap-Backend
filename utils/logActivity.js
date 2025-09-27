const ActivityLog = require("../model/activityLog");

/**
 * Logs an activity performed by a user on a bug.
 * 
 * @param {Object} params - Activity details.
 * @param {String} params.userId - ID of the user performing the action.
 * @param {String} params.bugId - ID of the bug related to the action.
 * @param {String} params.action - Action performed (e.g., 'created', 'updated', 'assigned').
 * @param {String} params.details - Additional details or description of the action.
 * 
 * @throws Will throw an error if any required field is missing or database operation fails.
 */
const logActivity = async ({ userId, bugId, action, details }) => {
  if (!userId || !bugId || !action || !details) {
    throw new Error("All fields (userId, bugId, action, details) are required to log activity.");
  }

  try {
    await ActivityLog.create({
      user: userId,
      bug: bugId,
      action,
      details
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
    throw new Error("Internal server error while logging activity.");
  }
};

module.exports = logActivity;
