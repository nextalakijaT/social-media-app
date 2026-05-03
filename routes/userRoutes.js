const express = require("express");
const { followUser, unfollowUser, getFollowing, getFollowers, getUserProfile } = require("../controllers/userController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.get("/me/following", protect, getFollowing);
router.get("/me/followers", protect, getFollowers);
router.get("/:id", getUserProfile);
router.post("/:id/follow", protect, followUser);
router.delete("/:id/follow", protect, unfollowUser);

module.exports = router;