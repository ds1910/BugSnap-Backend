  // ==============================
  // invites.controller.js
  // ==============================
  const nodemailer = require("nodemailer");
  const jwt = require("jsonwebtoken");
  const mongoose = require("mongoose");
  const User = require("../model/user");
  const Invite = require("../model/invite");

  const path = require("path");
  const fs = require("fs");

  // ==============================
  // Configure transporter (reused)
  // ==============================
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // ==============================
  // Helpers
  // ==============================

  // Flatten nested arrays
  const flattenEmails = (arr) => {
    const out = [];
    const recurse = (v) => {
      if (v === null || v === undefined) return;
      if (Array.isArray(v)) return v.forEach(recurse);
      out.push(v);
    };
    recurse(arr);
    return out;
  };

  // Very basic email validation
  const isProbablyEmail = (s) =>
    typeof s === "string" && /\S+@\S+\.\S+/.test(s.trim());

  // Get base frontend URL
  const getFrontendBase = (req) => {
    if (process.env.FRONTEND_URL_MAIN) {
      return String(process.env.FRONTEND_URL_MAIN).replace(/\/+$/, "");
    }
    const forwardedProto = req.headers["x-forwarded-proto"];
    const proto = forwardedProto
      ? forwardedProto.split(",")[0].trim()
      : req.protocol || "http";
    const host = req.get("host") || "localhost";
    return `${proto}://${host}`.replace(/\/+$/, "");
  };

  // ==============================
  // Invite People
  // ==============================
  const handleInvitePeople = async (req, res) => {
    try {
      if (!process.env.JWT_SECRET) {
        console.warn(
          "Warning: JWT_SECRET not set — falling back to insecure dev-secret."
        );
      }

      const frontendBase = getFrontendBase(req);
      const { emails: rawEmails, preprocessed } = req.body ?? {};

      if (!rawEmails) {
        return res
          .status(400)
          .json({ error: "Please provide `emails` in request body." });
      }

      // Get authenticated user info
      const requesterId = req.user?.id ?? req.user?._id;
      let requestUserDoc = null;
      if (requesterId) {
        try {
          requestUserDoc = await User.findById(requesterId).lean().exec();
        } catch (err) {
          console.warn("DB fetch user error:", err?.message ?? err);
        }
      }

      const userEmail = (requestUserDoc?.email || req.user?.email) ?? null;
      const senderName =
        requestUserDoc?.username ||
        requestUserDoc?.name ||
        req.user?.name ||
        "Someone";

      if (!userEmail) {
        return res
          .status(401)
          .json({ error: "Authenticated user email missing." });
      }

      // Normalize recipients
      let uniqueRecipients = [];
      if (preprocessed === true) {
        if (!Array.isArray(rawEmails)) {
          return res.status(400).json({ error: "preprocessed expects array." });
        }
        uniqueRecipients = rawEmails.filter(
          (e) => typeof e === "string" && e.length > 0
        );
      } else if (typeof rawEmails === "string") {
        const parsed = rawEmails
          .split(/[,;\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        uniqueRecipients = Array.from(new Set(parsed));
      } else if (Array.isArray(rawEmails)) {
        const flattened = flattenEmails(rawEmails)
          .map((e) => (typeof e === "string" ? e.trim() : e))
          .filter(Boolean);
        uniqueRecipients = Array.from(new Set(flattened));
      } else {
        return res
          .status(400)
          .json({ error: "`emails` must be array or string." });
      }

      if (uniqueRecipients.length === 0) {
        return res.status(400).json({ error: "No valid recipients." });
      }

      const MAX_RECIPIENTS = Number(process.env.MAX_RECIPIENTS || 100);
      if (uniqueRecipients.length > MAX_RECIPIENTS) {
        return res.status(400).json({
          error: `Too many recipients. Max ${MAX_RECIPIENTS} allowed.`,
        });
      }

      // company/static values
      const companyName = "BugSnap";

      // ==============================
      // Send invites
      // ==============================
      const sendPromises = uniqueRecipients.map(async (recipient) => {
        if (!isProbablyEmail(recipient)) {
          return {
            to: recipient,
            status: "invalid",
            error: "Invalid email format",
          };
        }

        // Generate invite token
        const token = jwt.sign(
          { invitedEmail: recipient, invitedBy: userEmail },
          process.env.JWT_SECRET || "dev-secret",
          { expiresIn: "7d" }
        );

        // Save in DB
        await Invite.create({ token });

        const inviteUrl = `${frontendBase}/accept-invite?token=${token}&inviter=${encodeURIComponent(
          senderName
        )}`;

        // Plain fallback
        const plainText = `
  ${senderName} (${userEmail}) has invited you to join BugSnap.

  Accept the invitation here:
  ${inviteUrl}

  This invitation will expire in 7 days.
  If you don’t want to join, simply ignore this email.
        `.trim();

        // HTML template (no logo)
        const html = `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${companyName} Invitation</title>
    <style>
      body { margin:0; padding:0; background-color:#f3f4f6; font-family: 'Inter','Helvetica Neue',Arial,sans-serif; color:#0f172a; }
      a { color:#2563eb; text-decoration:none; }
      .btn { display:inline-block; padding:14px 26px; border-radius:10px; font-weight:700;
            background:linear-gradient(90deg,#4f46e5,#06b6d4); color:#ffffff !important; font-size:15px; }
    </style>
  </head>
  <body>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:28px 16px;">
      <tr>
        <td align="center">
          <table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(2,6,23,0.08);">

            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(90deg,#0f172a 0%, #0ea5a2 100%); padding:20px 28px; color:#fff; font-size:16px; font-weight:700;">
                🐞 ${companyName}
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px 40px 24px 40px;">
                <h1 style="margin:0;font-size:26px;font-weight:800;text-align:center;">
                  🎉 You're invited to join ${companyName}!
                </h1>
                <p style="margin:12px 0;text-align:center;font-size:15px;color:#475569;">
                  ${senderName} (<a href="mailto:${userEmail}">${userEmail}</a>) has invited you to their ${companyName} workspace.
                </p>
                <div style="text-align:center;margin:24px 0;">
                  <a class="btn" href="${inviteUrl}" target="_blank">🔗 Accept Invitation</a>
                </div>
                <p style="font-size:13px;color:#6b7280;text-align:center;">
                  If the button doesn’t work, copy & paste this link:<br/>
                  <a href="${inviteUrl}">${inviteUrl}</a>
                </p>
                <p style="margin-top:18px;font-size:13px;color:#6b7280;text-align:center;">
                  ⏳ This invite link will expire in 7 days.
                </p>
              </td>
            </tr>
          </table>

          <div style="max-width:680px;margin:16px auto 0 auto;font-size:12px;color:#9aa4b2;text-align:center;">
            © ${new Date().getFullYear()} ${companyName}. All rights reserved.
          </div>
        </td>
      </tr>
    </table>
  </body>
  </html>`;

        const mailOptions = {
          from: `${companyName} <${process.env.EMAIL_USER}>`,
          to: recipient,
          subject: `🚀 ${senderName} invited you to join ${companyName}`,
          text: plainText,
          html,
        };
    
      // console.log(mailOptions);
        try {
          const info = await transporter.sendMail(mailOptions);
          return {
            to: recipient,
            status: "sent",
            info: { messageId: info.messageId },
          };
        } catch (err) {
          return {
            to: recipient,
            status: "failed",
            error: err?.message ?? String(err),
          };
        }
      });
      // console.log("result ke phle");
      const results = await Promise.all(sendPromises);
      console.log(results);
      return res.status(200).json({
        message: "Invitations processed",
        results,
      });
    } catch (err) {
      console.error("Invite error:", err);
      return res.status(500).json({ error: "Failed to send invitations" });
    }
  };

  // ==============================
  // Accept Invite / Add People
  // ==============================
  const handleAddPeople = async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: "Invite token is required." });
      }

      const inviteDoc = await Invite.findOne({ token });
      if (!inviteDoc) {
        return res.status(400).json({ error: "Invite token not recognized." });
      }
      if (inviteDoc.used) {
        return res.status(400).json({ error: "Invite token already used." });
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
      } catch (err) {
        return res
          .status(400)
          .json({ error: "Invalid or expired invite token." });
      }

      const { invitedEmail, invitedBy } = decoded;
      if (!invitedEmail || !invitedBy) {
        return res.status(400).json({ error: "Malformed invite token." });
      }

      const currentUserId = req.user?.id ?? req.user?._id;
      if (!currentUserId) {
        return res.status(401).json({ error: "Authentication required." });
      }

      const currentUser = await User.findById(currentUserId);
      if (!currentUser) {
        return res.status(404).json({ error: "Current user not found." });
      }

      const inviter = await User.findOne({ email: invitedBy });
      if (!inviter) {
        return res.status(404).json({ error: "Inviter not found." });
      }

      if (currentUser.email !== invitedEmail) {
        return res.status(403).json({
          error: "This invitation was not issued for your account.",
        });
      }

      const inviterId = inviter._id.toString();
      const currId = currentUser._id.toString();

      if (!currentUser.friends.includes(inviterId)) {
        currentUser.friends.push(inviterId);
        console.log("Added inviter to current user's friends. Current user friends:", currentUser.friends);
      }
      if (!inviter.friends.includes(currId)) {
        inviter.friends.push(currId);
        console.log("Added current user to inviter's friends. Inviter friends:", inviter.friends);
      }
      await currentUser.save();
      await inviter.save();
      
      console.log("Both users saved successfully");

      inviteDoc.used = true;
      inviteDoc.usedAt = new Date();
      await inviteDoc.save();

      return res.status(200).json({
        message: "Friend added successfully.",
        refreshPeople: true, // Signal frontend to refresh people list
        friend: {
          id: inviter._id,
          name: inviter.name,
          email: inviter.email,
        },
      });
    } catch (err) {
      console.error("Add people error:", err);
      return res.status(500).json({ error: "Failed to add friend." });
    }
  };

  // ==============================
  // AUTO ACCEPT INVITATIONS (helper function)
  // ==============================
  const autoAcceptInvitations = async (userEmail, userId) => {
    try {
      console.log(`\n=== Auto Accept Invitations for ${userEmail} ===`);
      
      // Find all unused invitation tokens for this email
      const pendingInvites = await Invite.find({ 
        used: false 
      });
      
      console.log(`Found ${pendingInvites.length} total unused invites`);
      
      let acceptedCount = 0;
      
      for (const inviteDoc of pendingInvites) {
        try {
          // Decode the JWT token to check if it's for this user
          const decoded = jwt.verify(inviteDoc.token, process.env.JWT_SECRET || "dev-secret");
          const { invitedEmail, invitedBy } = decoded;
          
          if (invitedEmail === userEmail) {
            console.log(`Processing invitation from ${invitedBy} to ${invitedEmail}`);
            
            // Find the inviter
            const inviter = await User.findOne({ email: invitedBy });
            if (!inviter) {
              console.log(`Inviter ${invitedBy} not found, skipping`);
              continue;
            }
            
            // Find the current user
            const currentUser = await User.findById(userId);
            if (!currentUser) {
              console.log(`Current user ${userId} not found, skipping`);
              continue;
            }
            
            const inviterId = inviter._id.toString();
            const currId = currentUser._id.toString();
            
            // Add friends bidirectionally if not already friends
            let updated = false;
            if (!currentUser.friends.includes(inviterId)) {
              currentUser.friends.push(inviterId);
              console.log(`Added inviter ${inviter.name} to current user's friends`);
              updated = true;
            }
            if (!inviter.friends.includes(currId)) {
              inviter.friends.push(currId);
              console.log(`Added current user ${currentUser.name} to inviter's friends`);
              updated = true;
            }
            
            if (updated) {
              await currentUser.save();
              await inviter.save();
              
              // Mark invitation as used
              inviteDoc.used = true;
              inviteDoc.usedAt = new Date();
              await inviteDoc.save();
              
              acceptedCount++;
              console.log(`Successfully auto-accepted invitation from ${inviter.name}`);
            } else {
              console.log(`Users ${currentUser.name} and ${inviter.name} are already friends`);
            }
          }
        } catch (tokenError) {
          // Skip invalid or expired tokens
          console.log(`Skipping invalid token: ${tokenError.message}`);
          continue;
        }
      }
      
      console.log(`Auto-accepted ${acceptedCount} invitations for ${userEmail}`);
      return acceptedCount;
    } catch (error) {
      console.error("Error in autoAcceptInvitations:", error);
      return 0;
    }
  };

  // ==============================
  // Get All People
  // ==============================
  const handelGetAllPeople = async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId)
        return res.status(401).json({ success: false, message: "Unauthorized" });

      console.log("\n=== Get All People Debug ===");
      console.log("User ID:", userId);

      const user = await User.findById(userId).populate({
        path: "friends",
        select: "name email teams bugs bio country city joinDate profilePic location",
        populate: [
          { path: "teams", select: "name" },
          { path: "bugs", select: "title status" },
        ],
      });

      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      console.log("User found:", { 
        id: user._id,
        email: user.email, 
        name: user.name,
        friendsCount: user.friends ? user.friends.length : 0
      });
      console.log("User friends (raw):", user.friends.map(f => ({
        id: f._id,
        name: f.name,
        email: f.email
      })));

      const people = (user.friends || []).map((f) => ({
        _id: f._id,
        id: f._id,
        name: f.name,
        username: f.name, // For frontend compatibility
        email: f.email,
        bio: f.bio,
        country: f.country,
        city: f.city,
        joinDate: f.joinDate,
        profilePic: f.profilePic,
        location: f.location,
        teams: (f.teams || []).map((t) =>
          typeof t === "object" ? t.name : t
        ),
        bugs: f.bugs || [],
      }));

      console.log("Formatted people to return:", people);
      console.log("Response payload:", {
        success: true,
        count: people.length,
        people
      });

      return res.status(200).json({
        success: true,
        count: people.length,
        people,
      });
    } catch (error) {
      console.error("Error fetching people details:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  };

  // ==============================
  // Delete Person
  // ==============================
  const handelDeletePerson = async (req, res) => {
    try {
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const rawTargetEmail = req.body?.email;
      if (!rawTargetEmail || typeof rawTargetEmail !== "string") {
        return res
          .status(400)
          .json({ success: false, message: "Target email is required" });
      }
      const targetEmail = rawTargetEmail.trim().toLowerCase();

      const currentUser = await User.findById(currentUserId).select(
        "_id name email"
      );
      if (!currentUser) {
        return res
          .status(401)
          .json({ success: false, message: "Authenticated user not found" });
      }

      let targetUser = await User.findOne({
        email: targetEmail,
      }).select("_id name email");
      if (!targetUser) {
        targetUser = await User.findOne({
          email: { $regex: `^${escapeRegExp(targetEmail)}$`, $options: "i" },
        }).select("_id name email");
      }
      if (!targetUser) {
        return res
          .status(404)
          .json({ success: false, message: "Target user not found" });
      }

      const targetId = String(targetUser._id);
      if (targetId === String(currentUserId)) {
        return res
          .status(400)
          .json({ success: false, message: "Cannot remove yourself" });
      }

      const [updatedMe, updatedTarget] = await Promise.all([
        User.findByIdAndUpdate(
          currentUserId,
          { $pull: { friends: targetId } },
          { new: true }
        ).select("friends"),
        User.findByIdAndUpdate(
          targetId,
          { $pull: { friends: currentUserId } },
          { new: true }
        ).select("friends"),
      ]);

      return res.status(200).json({
        success: true,
        message: "Friend removed successfully.",
      });
    } catch (err) {
      console.error("Error in handelDeletePerson:", err);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  };

  // Escape regex
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }


  const cleanupFiles = (files = []) => {
    files.forEach((f) => {
      try {
        if (f && f.path && fs.existsSync(f.path)) {
          fs.unlinkSync(f.path);
        }
      } catch (err) {
        console.warn("Failed to delete file:", f?.path, err?.message || err);
      }
    });
  };


  const escapeHtml = (unsafe) => {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};


  /**
   * Send email (premium HTML) with attachments.
   * - 'attachments' is an array of multer file objects (originalname, path, mimetype, etc.)
   * - 'sender' and 'receiver' names/emails are used inside the email body
   */
const sendEmailWithAttachments = async ({
  toEmail,
  toName,
  subject,
  htmlBody,
  attachments = [],
  senderName,
  senderEmail,
}) => {
  // create transporter (you may hoist this to module scope to reuse connections)
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // TLS via STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Map/massage attachments for nodemailer
  const mappedAttachments = (attachments || []).map((file) => {
    return {
      filename: file.originalname || file.filename || path.basename(file.path || ""),
      path: file.path, // multer usually provides this
      contentType: file.mimetype || undefined,
    };
  });

  // Build attachments HTML list (safe-escaped)
  const attachmentsListHtml = (mappedAttachments.length
    ? mappedAttachments
        .map((a) => `<li style="margin-bottom:6px;">${escapeHtml(a.filename)}</li>`)
        .join("")
    : `<li>No attachments</li>`);

  // HTML email template (login/open link removed)
  const html = `
    <html>
      <body style="margin:0; padding:0; background:#f6fbff; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">
        <div style="max-width:720px; margin:36px auto; padding:32px; background:linear-gradient(180deg,#ffffff,#f6fbff); border-radius:14px; box-shadow:0 18px 50px rgba(6,28,60,0.06); color:#0f1724; line-height:1.6; border:1px solid #eef8ff;">
          
          <!-- Meta -->
          <div style="font-size:13px; color:#6b7280; text-align:center; margin-bottom:14px;">
            🔒 Secure message from <strong style="color:#0b1220;">${escapeHtml(senderName)}</strong> to <strong style="color:#0b1220;">${escapeHtml(toName)}</strong>
          </div>

          <!-- Greeting -->
          <h2 style="margin:0 0 12px; font-size:20px; color:#05203b; font-weight:700;">Hello ${escapeHtml(toName)},</h2>

          <!-- Lead -->
          <p style="margin:0 0 14px; font-size:15px; color:#253044;">
            ${escapeHtml(senderName)} has shared files with you via <strong>BugSnap</strong> 📩. Please find the details and attachments below.
          </p>

          <!-- About BugSnap -->
          <p style="margin:0 0 18px; font-size:14px; color:#374151;">
            <strong>About BugSnap:</strong> A lightweight, collaborative bug-tracking platform that helps teams capture context, prioritize effectively, and resolve issues faster.
          </p>

          <!-- Why you received this -->
          <div style="background:#fbfeff; border:1px solid #e6f8ff; border-radius:10px; padding:14px; margin-bottom:18px; color:#2b3747; font-size:14px;">
            <strong>Why you received this</strong>
            <div style="margin-top:8px;">
              This system-generated message was sent on behalf of <strong>${escapeHtml(senderName)}</strong> &lt;${escapeHtml(senderEmail)}&gt; to <strong>${escapeHtml(toName)}</strong> &lt;${escapeHtml(toEmail)}&gt; to share files and context related to BugSnap. If you believe you received this in error, please notify the sender within the BugSnap app.
            </div>
          </div>

          <!-- Dynamic Message Body -->
          <div style="font-size:15px; color:#26303b; margin-bottom:18px;">
            ${htmlBody ? htmlBody : `<p>Please review the attached files and respond within BugSnap if you have questions.</p>`}
          </div>

          <!-- Attachments summary -->
          <div style="border-radius:10px; padding:14px; background:linear-gradient(180deg,#ffffff,#f7fdff); border:1px solid #e9f7ff; margin-bottom:20px;">
            <strong style="display:block; margin-bottom:8px; color:#05203b;">Attachments included</strong>
            <ul style="margin:0; padding-left:18px; color:#324049; font-size:14px; list-style:none;">
              ${attachmentsListHtml}
            </ul>
          </div>

          <!-- Professional note about replies -->
          <p style="font-size:13px; color:#6b7280; margin-bottom:12px;">
            <strong>Please do not reply to this email.</strong> This inbox is <strong>not monitored</strong>. To respond, ask a question or add comments directly in the <strong>BugSnap</strong> app or on the related report so the sender and your team receive your message promptly.
          </p>

          <!-- Signature -->
          <p style="color:#374151; font-size:14px; margin-top:6px;">
            — Warm regards,<br><strong>The BugSnap Team 💙</strong>
          </p>

          <!-- Footer -->
          <hr style="border:none; border-top:1px solid #eef8ff; margin:20px 0;">
          <p style="font-size:12px; color:#9aa6b3; text-align:center;">
            You received this message because a BugSnap user shared files with you.<br>
            © ${new Date().getFullYear()} BugSnap — All rights reserved.
          </p>
        </div>
      </body>
    </html>
  `;

  const mailOptions = {
    from: `BugSnap <${process.env.NO_REPLY_EMAIL || process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: subject || `Files shared with you by ${senderName} — BugSnap`,
    html,
    // Do not route replies to the sender; this is a system email
    replyTo: process.env.NO_REPLY_EMAIL || undefined,
    attachments: mappedAttachments,
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
};

/**
 * Express handler to accept POST with:
 * - email (receiver email)
 * - subject
 * - messageHtml (body HTML)
 * - files in req.files (multer)
 *
 * Expects req.user.id to exist (authenticated user) to fetch sender info.
 */
const handelSendMessage = async (req, res) => {
  const { email: receiverEmail, subject, messageHtml } = req.body;
  const files = req.files || [];

  if (!receiverEmail || !subject || !messageHtml) {
    cleanupFiles(files);
    return res.status(400).json({ message: "Email, subject, and messageHtml are required." });
  }

  try {
    if (!req.user || !req.user.id) {
      cleanupFiles(files);
      return res.status(401).json({ message: "Unauthorized: sender info missing." });
    }

    const sender = await User.findById(req.user.id).select("name email");
    if (!sender) {
      cleanupFiles(files);
      return res.status(404).json({ message: "Sender not found." });
    }

    // Best-effort: fetch receiver name from DB
    const receiverUser = await User.findOne({ email: receiverEmail }).select("name email");
    const receiverName = receiverUser?.name || receiverEmail.split("@")[0];

    const info = await sendEmailWithAttachments({
      toEmail: receiverEmail,
      toName: receiverName,
      subject,
      htmlBody: messageHtml,
      attachments: files,
      senderName: sender.name || "A BugSnap user",
      senderEmail: sender.email || process.env.EMAIL_USER,
    });

    cleanupFiles(files);

    return res.status(200).json({
      message: `Message successfully sent to ${receiverEmail}`,
      messageId: info.messageId,
    });
  } catch (err) {
    console.error("Error in handleSendMessage:", err);
    cleanupFiles(files);
    return res.status(500).json({ message: err.message || "Failed to send message" });
  }
};



  // Test endpoint to debug friendships
  const testFriendships = async (req, res) => {
    try {
      const { email } = req.query;
      
      if (!email) {
        return res.status(400).json({ error: "Email parameter required" });
      }
      
      const user = await User.findOne({ email }).populate('friends', 'name email');
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      return res.status(200).json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          friendsCount: user.friends.length,
          friends: user.friends.map(f => ({
            id: f._id,
            name: f.name,
            email: f.email
          }))
        }
      });
    } catch (error) {
      console.error("Test friendships error:", error);
      return res.status(500).json({ error: "Server error" });
    }
  };

  // ==============================
  module.exports = {
    handleInvitePeople,
    handleAddPeople,
    handelGetAllPeople,
    handelDeletePerson,
    handelSendMessage,
    testFriendships,
    autoAcceptInvitations,
  };
