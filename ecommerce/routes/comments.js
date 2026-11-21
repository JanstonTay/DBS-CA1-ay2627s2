const express = require("express");
const router = express.Router();
const commentController = require("../controllers/commentController");
const { verifyToken } = require("../middleware/auth");

router.post("/create", verifyToken, commentController.createComment);
router.get("/retrieve/:reviewId", verifyToken, commentController.getComments);
router.delete("/delete", verifyToken, commentController.deleteComment);

module.exports = router;
