const express = require("express");
const { body } = require("express-validator");
const { getAllPublishedPosts, getSinglePost, createPost, updatePost, deletePost, getMyPosts, likePost, unlikePost } = require("../controllers/postController");
const { protect, optionalAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/me/posts", protect, getMyPosts);
router.get("/", optionalAuth, getAllPublishedPosts);
router.get("/:id", optionalAuth, getSinglePost);

router.post("/", protect, [
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("content").trim().notEmpty().withMessage("Content is required"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
], createPost);

router.patch("/:id", protect, updatePost);
router.delete("/:id", protect, deletePost);
router.post("/:id/like", protect, likePost);
router.delete("/:id/like", protect, unlikePost);

module.exports = router;