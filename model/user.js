const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// =====================================================
// =================== User Schema =====================
// =====================================================

/**
 * Defines the structure of a user document in MongoDB
 * - Includes basic user info and authentication fields
 * - Supports role-based access ("admin", "normal")
 * - Automatically tracks creation and update timestamps
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true, // Ensures no two users can register with the same email
    },

    // role: {
    //   type: String,
    //   enum: ["admin", "normal"],
    //   default: "normal",
    // },

    image: {
      type: String,
    },
    friends: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },

      teams: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Team" }],
         default: [],
        },

        bugs: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bug" }],
         default: [],
        },
 

    password: {
      type: String,
    },
  },
  { timestamps: true }
);

// =====================================================
// ====== Middleware: Hash password before saving ======
// =====================================================

/**
 * Pre-save hook that hashes the user's password before saving to DB
 * - Only hashes if the password is modified (e.g., during creation or update)
 * - Uses bcrypt with 11 salt rounds
 */
userSchema.pre("save", async function (next) {
  const user = this;

  if (!user.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(11);
    user.password = await bcrypt.hash(user.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// =====================================================
// === Instance Method: Compare entered password =======
// =====================================================

/**
 * Compares a plain-text password with the hashed password stored in the database
 * - Returns true if they match, false otherwise
 */
userSchema.methods.comparePassword = async function (plainPassword) {
  return await bcrypt.compare(plainPassword, this.password);
};

// =====================================================
// ================== Model Export =====================
// =====================================================

const User = mongoose.model("User", userSchema);
module.exports = User;
