process.env.JWT_SECRET = "test_secret_key_for_jest";
process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../app");
const { setupTestDB, clearTestDB, teardownTestDB } = require("./setup");

beforeAll(setupTestDB);
afterEach(clearTestDB);
afterAll(teardownTestDB);

const makeUser = async (overrides = {}) => {
  const defaults = {
    first_name: "Test", last_name: "User",
    username: "testuser", email: "test@example.com", password: "password123",
  };
  const res = await request(app).post("/api/auth/signup").send({ ...defaults, ...overrides });
  return { token: res.body.token, user: res.body.user };
};

describe("GET /api/users/:id", () => {
  it("should return a public user profile", async () => {
    const { user } = await makeUser();
    const res = await request(app).get(`/api/users/${user.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.username).toBe("testuser");
    expect(res.body.data.password).toBeUndefined();
  });

  it("should return 404 for a non-existent user", async () => {
    const res = await request(app).get("/api/users/64f1a2b3c4d5e6f7a8b9c000");
    expect(res.statusCode).toBe(404);
  });

  it("should return 400 for an invalid user ID", async () => {
    const res = await request(app).get("/api/users/invalid-id");
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/users/:id/follow", () => {
  it("should follow another user", async () => {
    const alice = await makeUser({ username: "alice_f", email: "alice_f@test.com" });
    const bob = await makeUser({ username: "bob_f", email: "bob_f@test.com" });
    const res = await request(app).post(`/api/users/${bob.user.id}/follow`)
      .set("Authorization", `Bearer ${alice.token}`);
    expect(res.statusCode).toBe(200);
  });

  it("should return 400 when trying to follow yourself", async () => {
    const alice = await makeUser({ username: "alice_self", email: "alice_self@test.com" });
    const res = await request(app).post(`/api/users/${alice.user.id}/follow`)
      .set("Authorization", `Bearer ${alice.token}`);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/yourself/i);
  });

  it("should return 409 when following the same user twice", async () => {
    const alice = await makeUser({ username: "alice_dup", email: "alice_dup@test.com" });
    const bob = await makeUser({ username: "bob_dup", email: "bob_dup@test.com" });
    await request(app).post(`/api/users/${bob.user.id}/follow`).set("Authorization", `Bearer ${alice.token}`);
    const res = await request(app).post(`/api/users/${bob.user.id}/follow`).set("Authorization", `Bearer ${alice.token}`);
    expect(res.statusCode).toBe(409);
  });

  it("should return 401 when not authenticated", async () => {
    const bob = await makeUser({ username: "bob_unauth", email: "bob_unauth@test.com" });
    const res = await request(app).post(`/api/users/${bob.user.id}/follow`);
    expect(res.statusCode).toBe(401);
  });
});

describe("DELETE /api/users/:id/follow", () => {
  it("should unfollow a user", async () => {
    const alice = await makeUser({ username: "alice_uf", email: "alice_uf@test.com" });
    const bob = await makeUser({ username: "bob_uf", email: "bob_uf@test.com" });
    await request(app).post(`/api/users/${bob.user.id}/follow`).set("Authorization", `Bearer ${alice.token}`);
    const res = await request(app).delete(`/api/users/${bob.user.id}/follow`)
      .set("Authorization", `Bearer ${alice.token}`);
    expect(res.statusCode).toBe(200);
  });

  it("should return 404 if the user was never followed", async () => {
    const alice = await makeUser({ username: "alice_unf", email: "alice_unf@test.com" });
    const bob = await makeUser({ username: "bob_unf2", email: "bob_unf2@test.com" });
    const res = await request(app).delete(`/api/users/${bob.user.id}/follow`)
      .set("Authorization", `Bearer ${alice.token}`);
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/users/me/following", () => {
  it("should return users the current user follows", async () => {
    const alice = await makeUser({ username: "alice_fl", email: "alice_fl@test.com" });
    const bob = await makeUser({ username: "bob_fl", email: "bob_fl@test.com" });
    const carol = await makeUser({ username: "carol_fl", email: "carol_fl@test.com" });
    await request(app).post(`/api/users/${bob.user.id}/follow`).set("Authorization", `Bearer ${alice.token}`);
    await request(app).post(`/api/users/${carol.user.id}/follow`).set("Authorization", `Bearer ${alice.token}`);
    const res = await request(app).get("/api/users/me/following")
      .set("Authorization", `Bearer ${alice.token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it("should return empty list if following nobody", async () => {
    const alice = await makeUser({ username: "alice_empty", email: "alice_empty@test.com" });
    const res = await request(app).get("/api/users/me/following")
      .set("Authorization", `Bearer ${alice.token}`);
    expect(res.body.data).toHaveLength(0);
  });

  it("should return 401 when not authenticated", async () => {
    const res = await request(app).get("/api/users/me/following");
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/users/me/followers", () => {
  it("should return users who follow the current user", async () => {
    const alice = await makeUser({ username: "alice_followers", email: "alice_followers@test.com" });
    const bob = await makeUser({ username: "bob_followers", email: "bob_followers@test.com" });
    const carol = await makeUser({ username: "carol_followers", email: "carol_followers@test.com" });
    await request(app).post(`/api/users/${alice.user.id}/follow`).set("Authorization", `Bearer ${bob.token}`);
    await request(app).post(`/api/users/${alice.user.id}/follow`).set("Authorization", `Bearer ${carol.token}`);
    const res = await request(app).get("/api/users/me/followers")
      .set("Authorization", `Bearer ${alice.token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it("should return 401 when not authenticated", async () => {
    const res = await request(app).get("/api/users/me/followers");
    expect(res.statusCode).toBe(401);
  });
});