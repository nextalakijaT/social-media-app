const Comment = require("../models/Comment");
const Post = require("../models/Post");

// ─── GET /api/posts/:id/comments ──────────────────────────────────────────────
/**
 * getComments
 * Public. Returns all comments for a published post.
 */
const getComments = async (req, res) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      state: "published",
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found or not published.",
      });
    }

    const { page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const [comments, total] = await Promise.all([
      Comment.find({ post: post._id })
        .populate("author", "first_name last_name username")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Comment.countDocuments({ post: post._id }),
    ]);

    res.status(200).json({
      success: true,
      data: comments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid post ID." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/posts/:id/comments ─────────────────────────────────────────────
/**
 * addComment
 * Protected. Adds a comment to a published post.
 */
const addComment = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required.",
      });
    }

    const post = await Post.findOne({
      _id: req.params.id,
      state: "published",
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found or not published.",
      });
    }

    const comment = await Comment.create({
      content: content.trim(),
      author: req.user._id,
      post: post._id,
    });

    // Increment the comment_count on the post
    post.comment_count += 1;
    await post.save();

    // Populate author info before returning
    await comment.populate("author", "first_name last_name username");

    res.status(201).json({
      success: true,
      message: "Comment added.",
      data: comment,
      comment_count: post.comment_count,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid post ID." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELETE /api/posts/:id/comments/:commentId ────────────────────────────────
/**
 * deleteComment
 * Protected. Only the comment author can delete their comment.
 */
const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found.",
      });
    }

    // Only the comment author can delete it
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorised to delete this comment.",
      });
    }

    await comment.deleteOne();

    // Decrement the comment_count on the post
    await Post.findByIdAndUpdate(req.params.id, {
      $inc: { comment_count: -1 },
    });

    res.status(200).json({
      success: true,
      message: "Comment deleted.",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid ID." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getComments, addComment, deleteComment };