const express = require("express");
const { body } = require("express-validator");
const { signup, login, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/signup", [
  body("first_name").trim().notEmpty().withMessage("First name is required"),
  body("last_name").trim().notEmpty().withMessage("Last name is required"),
  body("username").trim().notEmpty().isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/).withMessage("Invalid username"),
  body("email").trim().isEmail().withMessage("Valid email required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
], signup);

router.post("/login", [
  body("email").trim().isEmail().withMessage("Valid email required"),
  body("password").notEmpty().withMessage("Password is required"),
], login);

router.get("/me", protect, getMe);

module.exports = router;