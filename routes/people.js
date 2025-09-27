const express = require("express");
const USER = require("../model/user"); // Optional if not used here
const multer = require("../middleware/multer")

const { handleAddPeople,handleInvitePeople ,handelGetAllPeople,handelDeletePerson,handelSendMessage } = require("../controller/people");

const router = express.Router();

//router.route("/add",handelAddPeople);
router.route("/invite").post(handleInvitePeople);
router.route("/add").patch(handleAddPeople);
router.route("/getAllPeople").get(handelGetAllPeople);
router.route("/delete").delete(handelDeletePerson);
router.route("/sendmessage").post( multer.array("attachments"),handelSendMessage);
//router.route("/allPeople").get(handelGetAllPeople);

module.exports = router;
