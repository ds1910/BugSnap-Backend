// const jwt=require("jsonwebtoken");
// const { Socket } = require("socket.io");

// const intiSocket = (io) => {
  
//     io.use((socket, next) => {
//         const token=socket.handshake.auth?. token;

//         try{
         
//             const user = jwt.verify(token,JWT_SECRET);

//         }catch(err){

//         }

//     });

//   // Main Connection Handler

//   socket.on("connection", (socket) => {
    
//     socket.on("join_project", (projectId) => {
//       socket.join(projectId);
//        console.log(`👥 ${socket.user.email} joined project room: ${projectId}`);
//     });
    

//     // Handle disconnect
//        socket.on("disconnect", () => {
//       console.log(`Socket wiht socketId: ${socket.id} is Disconnected:`);
//     });
    

//   });
// }

// module.exports = intiSocketl;