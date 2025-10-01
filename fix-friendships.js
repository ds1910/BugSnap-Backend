const mongoose = require('mongoose');
require('dotenv').config();

// Use the same connection setup as the main app
const connectDB = require('./connection');

const User = require('./model/user');

async function fixBidirectionalFriendships() {
  try {
    // Connect to database
    await connectDB("mongodb://127.0.0.1:27017/BugSnap");
    console.log('🔧 Starting friendship repair...');
    
    // Get all users
    const allUsers = await User.find({});
    console.log(`Found ${allUsers.length} users`);
    
    let fixed = 0;
    
    for (const user of allUsers) {
      console.log(`\n👤 Checking user: ${user.name} (${user.email})`);
      console.log(`Current friends: ${user.friends.length}`);
      
      // Check each friend relationship
      for (const friendId of user.friends) {
        const friend = await User.findById(friendId);
        if (!friend) {
          console.log(`❌ Friend ${friendId} not found, removing from ${user.name}'s friends`);
          user.friends = user.friends.filter(id => !id.equals(friendId));
          continue;
        }
        
        // Check if friendship is bidirectional
        const hasFriendBack = friend.friends.some(id => id.equals(user._id));
        if (!hasFriendBack) {
          console.log(`🔄 Adding ${user.name} to ${friend.name}'s friends list`);
          friend.friends.push(user._id);
          await friend.save();
          fixed++;
        } else {
          console.log(`✅ ${user.name} ↔ ${friend.name} already bidirectional`);
        }
      }
      
      await user.save();
    }
    
    console.log(`\n🎉 Fixed ${fixed} one-way friendships!`);
    
    // Show final state
    console.log('\n📊 Final friendship state:');
    const updatedUsers = await User.find({}).populate('friends', 'name email');
    for (const user of updatedUsers) {
      console.log(`${user.name}: ${user.friends.length} friends`);
      user.friends.forEach(friend => {
        console.log(`  - ${friend.name} (${friend.email})`);
      });
    }
    
  } catch (error) {
    console.error('Error fixing friendships:', error);
  } finally {
    mongoose.disconnect();
  }
}

fixBidirectionalFriendships();