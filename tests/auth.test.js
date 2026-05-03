process.env.JWT_SECRET = "test_secret_key_for_jest";
process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../app");
const { setupTestDB, clearTestDB, teardownTestDB } = require("./setup");

beforeAll(setupTestDB);
afterEach(clearTestDB);
afterAll(teardownTestDB);

const validUser = {
  first_name: "Alice",
  last_name: "Smith",
  username: "alice_smith",
  email: "alice@example.com",
  password: "password123",
};

const registerUser = (data = validUser) =>
  request(app).post("/api/auth/signup").send(data);

describe("POST /api/auth/signup", () => {
  it("should register a new user and return a token", async () => {
    const res = await registerUser();
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe("alice_smith");
    expect(res.body.user.password).toBeUndefined();
  });

  it("should return 400 if required fields are missing", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "no@name.com", password: "abc123" });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it("should return 400 if email is invalid", async () => {
    const res = await registerUser({ ...validUser, email: "not-an-email" });
    expect(res.statusCode).toBe(400);
  });

  it("should return 400 if password is less than 6 characters", async () => {
    const res = await registerUser({ ...validUser, password: "abc" });
    expect(res.statusCode).toBe(400);
  });

  it("should return 409 if email is already taken", async () => {
    await registerUser();
    const res = await registerUser({ ...validUser, username: "alice2" });
    expect(res.statusCode).toBe(409);
    expect(res.body.message).toMatch(/email/i);
  });

  it("should return 409 if username is already taken", async () => {
    await registerUser();
    const res = await registerUser({ ...validUser, email: "other@example.com" });
    expect(res.statusCode).toBe(409);
    expect(res.body.message).toMatch(/username/i);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await registerUser();
  });

  it("should login with correct credentials and return a token", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: validUser.password });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it("should return 401 for wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: "wrongpassword" });
    expect(res.statusCode).toBe(401);
  });

  it("should return 401 for non-existent email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@example.com", password: "password123" });
    expect(res.statusCode).toBe(401);
  });

  it("should return 400 if email or password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/auth/me", () => {
  let token;

  beforeEach(async () => {
    const res = await registerUser();
    token = res.body.token;
  });

  it("should return the current user when authenticated", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.username).toBe(validUser.username);
  });

  it("should return 401 when no token is provided", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.statusCode).toBe(401);
  });

  it("should return 401 for an invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid.token.here");
    expect(res.statusCode).toBe(401);
  });
});