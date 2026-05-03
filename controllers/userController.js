const Follow = require("../models/Follow");
const User = require("../models/User");

const followUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    const currentUserId = req.user._id.toString();
    if (targetId === currentUserId)
      return res.status(400).json({ success: false, message: "You cannot follow yourself." });
    const targetUser = await User.findById(targetId);
    if (!targetUser) return res.status(404).json({ success: false, message: "User not found." });
    try {
      await Follow.create({ follower: currentUserId, following: targetId });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: "You are already following this user." });
      throw err;
    }
    res.status(200).json({ success: true, message: `You are now following ${targetUser.username}.` });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid user ID." });
    res.status(500).json({ success: false, message: error.message });
  }
};

const unfollowUser = async (req, res) => {
  try {
    const result = await Follow.findOneAndDelete({ follower: req.user._id.toString(), following: req.params.id });
    if (!result) return res.status(404).json({ success: false, message: "You are not following this user." });
    res.status(200).json({ success: true, message: "Unfollowed successfully." });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid user ID." });
    res.status(500).json({ success: false, message: error.message });
  }
};

const getFollowing = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    const [follows, total] = await Promise.all([
      Follow.find({ follower: req.user._id }).populate("following", "first_name last_name username bio profile_picture")
        .sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Follow.countDocuments({ follower: req.user._id }),
    ]);
    res.status(200).json({ success: true, data: follows.map((f) => f.following), pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getFollowers = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    const [follows, total] = await Promise.all([
      Follow.find({ following: req.user._id }).populate("follower", "first_name last_name username bio profile_picture")
        .sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Follow.countDocuments({ following: req.user._id }),
    ]);
    res.status(200).json({ success: true, data: follows.map((f) => f.follower), pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("first_name last_name username bio profile_picture createdAt");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid user ID." });
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { followUser, unfollowUser, getFollowing, getFollowers, getUserProfile };