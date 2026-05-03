const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const User = require("../models/User");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1h" });

const signup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { first_name, last_name, username, email, password, bio } = req.body;
  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      const field = existingUser.email === email ? "Email" : "Username";
      return res.status(409).json({ success: false, message: `${field} is already in use.` });
    }
    const user = await User.create({ first_name, last_name, username, email, password, bio });
    const token = generateToken(user._id);
    res.status(201).json({
      success: true, message: "Account created successfully.", token,
      user: { id: user._id, first_name: user.first_name, last_name: user.last_name,
              username: user.username, email: user.email, bio: user.bio },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }
    const token = generateToken(user._id);
    res.status(200).json({
      success: true, message: "Logged in successfully.", token,
      user: { id: user._id, first_name: user.first_name, last_name: user.last_name,
              username: user.username, email: user.email, bio: user.bio },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMe = async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
};

module.exports = { signup, login, getMe };