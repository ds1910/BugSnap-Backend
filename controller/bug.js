const mongoose = require("mongoose");
const Bug = require("../model/bug");
const Team = require("../model/team");
const logActivity = require("../utils/logActivity");
const applyQueryFeatures = require("../utils/queryUtils");
const User = require("../model/user");

/**
 * Utility: Validate team existence and check if a user is part of that team
 * - Throws error if team does not exist or user is not a member
 */
const getTeamAndCheckMembership = async (teamId, userId) => {
  if (!teamId || !mongoose.Types.ObjectId.isValid(teamId)) {
    throw new Error("Invalid or missing teamId");
  }

  const team = await Team.findById(teamId);
  if (!team) throw new Error("Team not found");

  const member = team.members.find(
    (m) => m.user.toString() === userId.toString()
  );
  if (!member) throw new Error("You are not a member of this team");

  return { team, member };
};

/**
 * Utility: Ensure that the user is an admin in the team
 */
const checkIfAdminInTeam = (member) => {
  if (member.role !== "admin") {
    throw new Error("Only team admins can perform this action.");
  }
};

/**
 * Create a new bug
 * - Ensures unique bug title per team
 * - Allows optional assignment to a team user
 * - Logs activity on success
 */
const handleCreateBug = async (req, res) => {
  const {
    title,
    tags = [],
    status = "open",
    teamId,
    priority = "medium",
    startDate,
    dueDate,
    assignee, // legacy single assignee support
    assignedName, // new multiple assignees support
    description,
  } = req.body;

  const createdBy = req.user?.id || req.body?.createdBy;

  if (!title || !teamId) {
    return res.status(400).json({ error: "Title and teamId are required." });
  }

  try {
    // Validate membership & admin rights
    const { team, member } = await getTeamAndCheckMembership(teamId, createdBy);
    // checkIfAdminInTeam(member);

    // Prevent duplicate bug titles inside the same team
    const existingBug = await Bug.findOne({ title, teamId });
    if (existingBug) {
      return res
        .status(400)
        .json({ error: "Bug with this title already exists in the team." });
    }

    // Handle multiple assignees (new format)
    let assignedTo = [];
    if (assignedName && Array.isArray(assignedName)) {
      for (const assigneeData of assignedName) {
        if (assigneeData && (assigneeData.name || assigneeData.email)) {
          const userDoc = await User.findOne({
            $or: [
              { name: assigneeData.name || assigneeData },
              { email: assigneeData.email || assigneeData }
            ]
          }).lean();

          if (userDoc) {
            assignedTo.push(userDoc._id);
          }
        }
      }
    }
    // Legacy single assignee support
    else if (assignee && assignee.name) {
      const userDoc = await User.findOne({
        $or: [{ name: assignee.name }, { email: assignee.email }],
      }).lean();

      if (!userDoc) {
        return res
          .status(404)
          .json({ error: `Assignee '${assignee.name}' not found.` });
      }
      assignedTo = [userDoc._id];
    }

    const user = await User.findById(createdBy, "name").lean();
    const username = user?.name;

    // Create the bug record
    const bug = await Bug.create({
      title,
      description,
      tags,
      status,
      teamId,
      priority,
      createdBy,
      startDate,
      dueDate,
      assignedTo,
    });

    // Populate assigned users for response
    const users = await User.find({ _id: { $in: assignedTo } })
      .select("name displayName fullName username email")
      .lean();

    const assigned = users.map((u) => ({
      id: String(u._id),
      name: u.name || u.displayName || u.fullName || u.username || u.email || null,
      email: u.email || '', // Include email for unique identification
    }));

    const bugWithAssignee = {
      ...bug.toObject(),
      assigned,
      assignedName: assigned,
    };

    // Log activity for auditing
    await logActivity({
      userId: createdBy,
      bugId: bug._id,
      action: "Bug Created",
      details: `New bug created by ${username}`,
    });

    return res.status(201).json({ message: "Bug created", bug: bugWithAssignee });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

/**
 * Get all bugs for a team (Any member can view)
 * - Validates membership
 * - Fetches bugs for the team
 * - Attaches assignee name for readability
 */
const handleGetAllBugsForTeam = async (req, res) => {
  const teamId = req.query.teamId;
  const userId = req.user.id;

  try {
    const { team } = await getTeamAndCheckMembership(teamId, userId);
    const bugs = await Bug.find({ teamId: team._id }).lean();

    // Resolve assigned user names
    const bugsWithAssignee = await Promise.all(
      bugs.map(async (bug) => {
        if (bug.assignedTo && bug.assignedTo.length > 0) {
          // Handle array of assignedTo IDs
          const assignedIds = Array.isArray(bug.assignedTo) 
            ? bug.assignedTo 
            : [bug.assignedTo];
          
          const assignedUsers = await User.find({ _id: { $in: assignedIds } })
            .select("name displayName fullName username email")
            .lean();
          
          const assignedName = assignedUsers.map(user => ({
            id: String(user._id),
            name: user.name || user.displayName || user.fullName || user.username || user.email || null,
            email: user.email || '', // Include email for unique identification
          }));
          
          return {
            ...bug,
            assignedName: assignedName,
            assigned: assignedName, // Also include 'assigned' for compatibility
          };
        }
        return { 
          ...bug, 
          assignedName: [],
          assigned: []
        };
      })
    );

    return res.status(200).json(bugsWithAssignee);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

/**
 *   Get a specific bug by ID
 * - Only creator or assigned users can view
 */
const handleGetBugById = async (req, res) => {
  const bugId = req.query.bugId || req.params.bugId;
  const userId = req.user.id;
  
  try {
    if (!bugId || !mongoose.Types.ObjectId.isValid(bugId)) {
      return res.status(400).json({ error: "Invalid or missing bugId." });
    }

    const bug = await Bug.findById(bugId)
      .populate('assignedTo', 'name email username')
      .populate('createdBy', 'name email username')
      .populate('files', 'fileId originalName mimetype size createdAt ownerId');
      
    if (!bug) return res.status(404).json({ error: "Bug not found." });

    const isCreator = bug.createdBy._id.toString() === userId;
    const isAssigned = bug.assignedTo.some((user) => user._id.toString() === userId);

    if (!isCreator && !isAssigned) {
      return res
        .status(403)
        .json({ error: "You are not authorized to view this bug." });
    }

    return res.status(200).json({ bug });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};


/**
 * Update a bug by ID, return enriched bug info, and log activity.
 */
const handleUpdateBugById = async (req, res) => {
  const teamId = req.query.teamId;
  const userId = req.user.id;
  
  // Handle both URL parameter and request body bugId
  const bugId = req.params.id || req.body.bugId;
  const updates = { ...req.body }; // clone to avoid mutating original
  
  // Remove bugId from updates if it exists
  if (updates.bugId) {
    delete updates.bugId;
  }
  
  // Extract updates object if nested
  if (updates.updates && typeof updates.updates === 'object') {
    Object.assign(updates, updates.updates);
    delete updates.updates;
  }

  try {
    // console.log("🔍 Received update request - BugId:", bugId);
    // console.log("🔍 TeamId:", teamId);
    // console.log("🔍 Updates:", updates);
    
    if (!bugId || !mongoose.Types.ObjectId.isValid(bugId)) {
      return res.status(400).json({ error: "Invalid or missing bugId" });
    }

    // 1. Validate team membership
    const { team } = await getTeamAndCheckMembership(teamId, userId);

    // 2. Ensure bug belongs to this team
    const bug = await Bug.findOne({ _id: bugId, teamId: team._id });
    if (!bug) {
      return res.status(404).json({ error: "Bug not found in this team" });
    }

    // console.log("Before update - Bug:", {
    //   id: bug._id,
    //   title: bug.title,
    //   description: bug.description,
    //   status: bug.status,
    //   priority: bug.priority,
    //   assignedTo: bug.assignedTo
    // });
    // console.log("Updates to apply:", updates);

    // 3. Handle assignedName conversion to assignedTo ObjectIds
    if (updates.assignedName && Array.isArray(updates.assignedName)) {
      console.log("🔍 Processing assignedName:", JSON.stringify(updates.assignedName, null, 2));
      const assignedUsers = [];
      
      for (const assignee of updates.assignedName) {
        console.log("🔍 Processing assignee:", JSON.stringify(assignee, null, 2));
        
        // Handle different formats: string, object with name, object with email
        let searchName = null;
        let searchEmail = null;
        
        if (typeof assignee === 'string') {
          // Direct string assignment
          searchName = assignee;
        } else if (assignee && typeof assignee === 'object') {
          // Object with name/email properties
          searchName = assignee.name;
          searchEmail = assignee.email;
        }
        
        console.log(`🔍 Search criteria - Name: "${searchName}", Email: "${searchEmail}"`);
        
        if (searchName || searchEmail) {
          // Build query conditions dynamically
          const queryConditions = [];
          if (searchName) {
            queryConditions.push({ name: searchName });
            queryConditions.push({ displayName: searchName });
            queryConditions.push({ fullName: searchName });
            queryConditions.push({ username: searchName });
          }
          if (searchEmail) {
            queryConditions.push({ email: searchEmail });
          }
          
          console.log("🔍 Query conditions:", JSON.stringify(queryConditions, null, 2));
          
          if (queryConditions.length > 0) {
            const userDoc = await User.findOne({
              $or: queryConditions
            }).lean();
            
            console.log(`🔍 Query result for ${searchName || searchEmail}:`, userDoc ? {
              id: userDoc._id,
              name: userDoc.name,
              email: userDoc.email
            } : "NOT FOUND");
            
            if (userDoc) {
              assignedUsers.push(userDoc._id);
              console.log(`✅ Added user ${userDoc._id} to assignment list`);
            } else {
              console.log(`❌ No user found for: ${searchName || searchEmail}`);
            }
          }
        }
      }
      
      console.log("🔍 Final assignedUsers array (ObjectIds):", assignedUsers);
      
      // 🔧 DEDUPLICATION: Remove duplicate ObjectIds to prevent duplicate assignments
      const uniqueAssignedUsers = [...new Set(assignedUsers.map(id => id.toString()))].map(id => new mongoose.Types.ObjectId(id));
      console.log("🔍 After deduplication - Unique assignedUsers:", uniqueAssignedUsers);
      console.log("🔍 Removed duplicates count:", assignedUsers.length - uniqueAssignedUsers.length);
      
      console.log("🔍 Setting updates.assignedTo to:", uniqueAssignedUsers);
      updates.assignedTo = uniqueAssignedUsers;
      delete updates.assignedName; // Remove this from updates as it's not a database field
    }

    // 3.1. Handle date fields conversion and validation
    if (updates.startDate !== undefined) {
      if (updates.startDate === "" || updates.startDate === null) {
        updates.startDate = null; // Allow clearing the date
      } else {
        // Convert date string to Date object for MongoDB
        const startDateObj = new Date(updates.startDate);
        if (isNaN(startDateObj.getTime())) {
          // console.log("⚠️ Invalid startDate format:", updates.startDate);
          updates.startDate = null;
        } else {
          updates.startDate = startDateObj;
          // console.log("✅ Converted startDate:", updates.startDate);
        }
      }
    }

    if (updates.dueDate !== undefined) {
      if (updates.dueDate === "" || updates.dueDate === null) {
        updates.dueDate = null; // Allow clearing the date
      } else {
        // Convert date string to Date object for MongoDB
        const dueDateObj = new Date(updates.dueDate);
        if (isNaN(dueDateObj.getTime())) {
          // console.log("⚠️ Invalid dueDate format:", updates.dueDate);
          updates.dueDate = null;
        } else {
          updates.dueDate = dueDateObj;
          // console.log("✅ Converted dueDate:", updates.dueDate);
        }
      }
    }
    
    console.log("🔍 Final updates object before apply:", JSON.stringify(updates, null, 2));

    // 4. Apply updates
    console.log("🔍 Before Object.assign - Bug assignedTo:", bug.assignedTo);
    Object.assign(bug, updates);
    console.log("🔍 After Object.assign - Bug assignedTo:", bug.assignedTo);
    console.log("After Object.assign - Bug:", {
      id: bug._id,
      title: bug.title,
      description: bug.description,
      status: bug.status,
      priority: bug.priority,
      assignedTo: bug.assignedTo
    });
    
    console.log("🔍 About to save bug with assignedTo:", bug.assignedTo);
    const savedBug = await bug.save();
    console.log("🔍 After save - DB assignedTo:", savedBug.assignedTo);
    console.log("After save - Saved Bug:", {
      id: savedBug._id,
      title: savedBug.title,
      description: savedBug.description,
      status: savedBug.status,
      priority: savedBug.priority,
      assignedTo: savedBug.assignedTo
    });

    // 5. Populate assigned users (optional enrichment)
    const assignedIds = Array.isArray(savedBug.assignedTo)
      ? savedBug.assignedTo
      : savedBug.assignedTo
      ? [savedBug.assignedTo]
      : [];

    const users = await User.find({ _id: { $in: assignedIds } })
      .select("name displayName fullName username email")
      .lean();

    const assigned = users.map((u) => ({
      id: String(u._id),
      name:
        u.name || u.displayName || u.fullName || u.username || u.email || null,
      email: u.email || '', // Include email for unique identification
    }));

    const assignedName = assigned; // Return as array of user objects for frontend

    const bugWithAssignee = {
      ...savedBug.toObject(),
      assigned,
      assignedName,
    };

    // 6. Log activity
    const user = await User.findById(userId).select("name email username").lean();
    const username = user?.name || user?.username || user?.email || "Unknown";

    await logActivity({
      userId,
      bugId: savedBug._id,
      action: "Bug Updated",
      details: `${savedBug.title} was updated by ${username}`,
    });

    // 7. Return response
    return res.status(200).json({ 
      success: true,
      message: "Bug updated successfully",
      bug: bugWithAssignee 
    });
  } catch (err) {
    console.error("Error in updateBugById:", err);
    return res.status(400).json({ 
      success: false,
      error: err.message || "Failed to update bug" 
    });
  }
};


/**
 * Delete a bug by ID (Admin only)
 * - Only admins of the bug’s team can delete
 * - Logs deletion activity
 */
const handleDeleteBugById = async (req, res) => {
  const bugId = req.query.bugId || req.params.bugId;
  const userId = req.user.id;

  try {
    if (!bugId || !mongoose.Types.ObjectId.isValid(bugId)) {
      return res.status(400).json({ error: "Invalid or missing bugId." });
    }

    const bug = await Bug.findById(bugId);
    if (!bug) return res.status(404).json({ error: "Bug not found." });

    const { team, member } = await getTeamAndCheckMembership(
      bug.teamId,
      userId
    );
    checkIfAdminInTeam(member);

    // Log activity
    const user = await User.findById(userId).select("name email username").lean();
    const username = user?.name || user?.username || user?.email || "Unknown";

    await logActivity({
      userId,
      bugId: bug._id,
      action: "Bug Deleted",
      details: `${bug.title} was deleted by ${username}`,
    });

    await Bug.findByIdAndDelete(bugId);
    return res.status(200).json({ message: "Bug deleted successfully." });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

/**
 * Assign a team user to a bug (Admin only)
 * - Validates target user is in team
 * - Prevents duplicate assignments
 * - Logs activity
 */
const handleAssignUserToBug = async (req, res) => {
  const { bugId } = req.params;
  const { userId: userToAssign } = req.body;
  const currentUserId = req.user.id;

  try {
    const bug = await Bug.findById(bugId);
    if (!bug) return res.status(404).json({ error: "Bug not found." });

    const { team, member } = await getTeamAndCheckMembership(
      bug.teamId,
      currentUserId
    );
    checkIfAdminInTeam(member);

    const targetMember = team.members.find(
      (m) => m.user.toString() === userToAssign
    );
    if (!targetMember) {
      return res
        .status(400)
        .json({ error: "User to assign is not in the team." });
    }

    if (bug.assignedTo.includes(userToAssign)) {
      return res
        .status(400)
        .json({ error: "User already assigned to this bug." });
    }

    bug.assignedTo.push(userToAssign);
    await bug.save();

    await logActivity({
      userId: currentUserId,
      bugId: bug._id,
      action: "Bug Assigned",
      details: `Bug assigned to ${targetMember.name} by ${req.user.name}`,
    });

    return res
      .status(200)
      .json({ message: "User assigned successfully.", bug });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

/**
 * Fetch all bugs assigned to the logged-in user
 * - Uses query utils to allow pagination/sorting/filtering
 */
const getAllAssignedBugs = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await applyQueryFeatures(Bug, req.query, {
      assignedTo: userId,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

/**
 * Upload file attachment to a bug
 * - Uploads file to Cloudinary
 * - Associates file with the bug
 * - Logs activity
 */
const handleBugFileUpload = async (req, res) => {
  const { uploadWithRetry } = require("../service/couldinary");
  const File = require("../model/file");
  
  const teamId = req.query.teamId;
  const userId = req.user.id;
  const bugId = req.params.id;

  try {
    // 1. Validate team membership and bug existence
    const { team } = await getTeamAndCheckMembership(teamId, userId);
    const bug = await Bug.findOne({ _id: bugId, teamId: team._id });
    if (!bug) {
      return res.status(404).json({ error: "Bug not found in this team" });
    }

    // 2. Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const localFilePath = req.file.path;

    // 3. Upload file to Cloudinary
    const result = await uploadWithRetry(localFilePath, req.file.mimetype);
    if (!result) {
      return res.status(500).json({ error: "Failed to upload file to cloud" });
    }

    // 4. Store file metadata in database
    const fileRecord = await File.create({
      fileId: result.public_id,
      ownerId: userId,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    // 5. Associate file with bug
    bug.files.push(fileRecord._id);
    await bug.save();

    // 6. Log activity
    const user = await User.findById(userId).select("name email username").lean();
    const username = user?.name || user?.username || user?.email || "Unknown";

    await logActivity({
      userId,
      bugId: bug._id,
      action: "File Uploaded",
      details: `${req.file.originalname} was uploaded to ${bug.title} by ${username}`,
    });

    // 7. Return response
    res.status(200).json({
      message: "File uploaded successfully",
      file: {
        id: fileRecord._id,
        originalName: req.file.originalname,
        public_id: result.public_id,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (err) {
    console.error("Error in handleBugFileUpload:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  handleCreateBug,
  handleGetAllBugsForTeam,
  handleGetBugById,
  handleUpdateBugById,
  handleDeleteBugById,
  handleAssignUserToBug,
  getAllAssignedBugs,
  handleBugFileUpload,
};
