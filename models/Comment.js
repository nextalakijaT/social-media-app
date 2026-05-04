const express = require("express");
const {
  getComments,
  addComment,
  deleteComment,
} = require("../controllers/commentController");
const { protect, optionalAuth } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });
// mergeParams: true lets us access :id from the parent route (postRoutes)

/**
 * GET    /api/posts/:id/comments             – Get all comments (public)
 * POST   /api/posts/:id/comments             – Add a comment (protected)
 * DELETE /api/posts/:id/comments/:commentId  – Delete a comment (protected)
 */
router.get("/",                  optionalAuth, getComments);
router.post("/",                 protect,      addComment);
router.delete("/:commentId",     protect,      deleteComment);

module.exports = router;