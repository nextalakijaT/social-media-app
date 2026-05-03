const { validationResult } = require("express-validator");
const Post = require("../models/Post");
const Like = require("../models/Like");
const User = require("../models/User");

const getAllPublishedPosts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, author, tags, sort_by = "createdAt", order = "desc" } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    const filter = { state: "published" };

    if (search) filter.$text = { $search: search };
    if (author) {
      const authorUser = await User.findOne({ username: author.toLowerCase() });
      if (!authorUser) return res.status(200).json({ success: true, data: [], pagination: { total: 0, page: pageNum, limit: limitNum, pages: 0 } });
      filter.author = authorUser._id;
    }
    if (tags) {
      const tagList = tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (tagList.length) filter.tags = { $in: tagList };
    }

    const allowedSortFields = ["like_count", "comment_count", "createdAt"];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : "createdAt";
    const sortOrder = order === "asc" ? 1 : -1;

    const [posts, total] = await Promise.all([
      Post.find(filter).populate("author", "first_name last_name username profile_picture")
        .sort({ [sortField]: sortOrder }).skip(skip).limit(limitNum),
      Post.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, data: posts, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getSinglePost = async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, state: "published" })
      .populate("author", "first_name last_name username email bio profile_picture createdAt");
    if (!post) return res.status(404).json({ success: false, message: "Post not found or not published." });
    res.status(200).json({ success: true, data: post });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid post ID." });
    res.status(500).json({ success: false, message: error.message });
  }
};

const createPost = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const { title, content, tags } = req.body;
    const post = await Post.create({ title, content, tags: tags || [], author: req.user._id, state: "draft" });
    res.status(201).json({ success: true, message: "Post created as draft.", data: post });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: "Post not found." });
    if (post.author.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "You are not authorised to edit this post." });
    if (req.body.state && !["draft", "published"].includes(req.body.state))
      return res.status(400).json({ success: false, message: "State must be either draft or published." });
    ["title", "content", "tags", "state"].forEach((field) => {
      if (req.body[field] !== undefined) post[field] = req.body[field];
    });
    await post.save();
    res.status(200).json({ success: true, message: "Post updated successfully.", data: post });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid post ID." });
    res.status(500).json({ success: false, message: error.message });
  }
};

const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: "Post not found." });
    if (post.author.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "You are not authorised to delete this post." });
    await Like.deleteMany({ post: post._id });
    await post.deleteOne();
    res.status(200).json({ success: true, message: "Post deleted successfully." });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid post ID." });
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMyPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10, state } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    const filter = { author: req.user._id };
    if (state) {
      if (!["draft", "published"].includes(state))
        return res.status(400).json({ success: false, message: "State filter must be draft or published." });
      filter.state = state;
    }
    const [posts, total] = await Promise.all([
      Post.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Post.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, data: posts, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.state !== "published") return res.status(404).json({ success: false, message: "Post not found or not published." });
    try {
      await Like.create({ user: req.user._id, post: post._id });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: "You have already liked this post." });
      throw err;
    }
    post.like_count += 1;
    await post.save();
    res.status(200).json({ success: true, message: "Post liked.", like_count: post.like_count });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid post ID." });
    res.status(500).json({ success: false, message: error.message });
  }
};

const unlikePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.state !== "published") return res.status(404).json({ success: false, message: "Post not found or not published." });
    const like = await Like.findOneAndDelete({ user: req.user._id, post: post._id });
    if (!like) return res.status(404).json({ success: false, message: "You have not liked this post." });
    post.like_count = Math.max(0, post.like_count - 1);
    await post.save();
    res.status(200).json({ success: true, message: "Post unliked.", like_count: post.like_count });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid post ID." });
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAllPublishedPosts, getSinglePost, createPost, updatePost, deletePost, getMyPosts, likePost, unlikePost };