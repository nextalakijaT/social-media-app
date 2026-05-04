const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes    = require("./routes/authRoutes");
const postRoutes    = require("./routes/postRoutes");
const userRoutes    = require("./routes/userRoutes");
const commentRoutes = require("./routes/commentRoutes");

const app = express();
app.use(express.static('public'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.use("/api/auth",                    authRoutes);
app.use("/api/posts",                   postRoutes);
app.use("/api/users",                   userRoutes);
app.use("/api/posts/:id/comments",      commentRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Social Media API is running 🚀",
    version: "1.0.0",
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;
