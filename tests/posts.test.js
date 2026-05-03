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

const makePost = async (token, overrides = {}) => {
  const defaults = { title: "My First Post", content: "Hello world", tags: ["news"] };
  const res = await request(app).post("/api/posts")
    .set("Authorization", `Bearer ${token}`).send({ ...defaults, ...overrides });
  return res.body.data;
};

const publishPost = async (token, postId) =>
  request(app).patch(`/api/posts/${postId}`)
    .set("Authorization", `Bearer ${token}`).send({ state: "published" });

describe("GET /api/posts", () => {
  it("should return an empty list when no posts exist", async () => {
    const res = await request(app).get("/api/posts");
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it("should return only published posts", async () => {
    const { token } = await makeUser();
    await makePost(token, { title: "Draft Post" });
    const pub = await makePost(token, { title: "Published Post" });
    await publishPost(token, pub._id);
    const res = await request(app).get("/api/posts");
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe("Published Post");
  });

  it("should paginate results", async () => {
    const { token } = await makeUser();
    for (let i = 1; i <= 3; i++) {
      const p = await makePost(token, { title: `Post ${i}` });
      await publishPost(token, p._id);
    }
    const res = await request(app).get("/api/posts?page=1&limit=2");
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(3);
  });

  it("should filter by author username", async () => {
    const alice = await makeUser({ username: "alice_t", email: "alice_t@example.com" });
    const bob = await makeUser({ username: "bob_t", email: "bob_t@example.com" });
    const ap = await makePost(alice.token, { title: "Alice post" });
    const bp = await makePost(bob.token, { title: "Bob post" });
    await publishPost(alice.token, ap._id);
    await publishPost(bob.token, bp._id);
    const res = await request(app).get("/api/posts?author=alice_t");
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe("Alice post");
  });

  it("should filter by tags", async () => {
    const { token } = await makeUser();
    const p1 = await makePost(token, { title: "Tech post", tags: ["tech"] });
    const p2 = await makePost(token, { title: "Sports post", tags: ["sports"] });
    await publishPost(token, p1._id);
    await publishPost(token, p2._id);
    const res = await request(app).get("/api/posts?tags=tech");
    expect(res.body.data.map((p) => p.title)).toContain("Tech post");
    expect(res.body.data.map((p) => p.title)).not.toContain("Sports post");
  });
});

describe("GET /api/posts/:id", () => {
  it("should return a published post with author info", async () => {
    const { token } = await makeUser();
    const post = await makePost(token);
    await publishPost(token, post._id);
    const res = await request(app).get(`/api/posts/${post._id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.author).toHaveProperty("username");
  });

  it("should return 404 for a draft post", async () => {
    const { token } = await makeUser();
    const post = await makePost(token);
    const res = await request(app).get(`/api/posts/${post._id}`);
    expect(res.statusCode).toBe(404);
  });

  it("should return 400 for an invalid post ID", async () => {
    const res = await request(app).get("/api/posts/not-a-valid-id");
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/posts", () => {
  it("should create a draft post when authenticated", async () => {
    const { token } = await makeUser();
    const res = await request(app).post("/api/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "New Post", content: "Some content", tags: ["tech"] });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.state).toBe("draft");
  });

  it("should return 401 when not authenticated", async () => {
    const res = await request(app).post("/api/posts").send({ title: "Nope", content: "Nope" });
    expect(res.statusCode).toBe(401);
  });

  it("should return 400 if title is missing", async () => {
    const { token } = await makeUser();
    const res = await request(app).post("/api/posts")
      .set("Authorization", `Bearer ${token}`).send({ content: "No title" });
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /api/posts/:id", () => {
  it("should update the title of a post", async () => {
    const { token } = await makeUser();
    const post = await makePost(token);
    const res = await request(app).patch(`/api/posts/${post._id}`)
      .set("Authorization", `Bearer ${token}`).send({ title: "Updated Title" });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.title).toBe("Updated Title");
  });

  it("should allow publishing a draft post", async () => {
    const { token } = await makeUser();
    const post = await makePost(token);
    const res = await publishPost(token, post._id);
    expect(res.body.data.state).toBe("published");
  });

  it("should return 403 if a non-owner tries to edit", async () => {
    const alice = await makeUser({ username: "alice_p", email: "alice_p@example.com" });
    const bob = await makeUser({ username: "bob_p", email: "bob_p@example.com" });
    const post = await makePost(alice.token);
    const res = await request(app).patch(`/api/posts/${post._id}`)
      .set("Authorization", `Bearer ${bob.token}`).send({ title: "Hacked" });
    expect(res.statusCode).toBe(403);
  });
});

describe("DELETE /api/posts/:id", () => {
  it("should delete a post owned by the user", async () => {
    const { token } = await makeUser();
    const post = await makePost(token);
    const res = await request(app).delete(`/api/posts/${post._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });

  it("should return 403 if a non-owner tries to delete", async () => {
    const alice = await makeUser({ username: "alice_d", email: "alice_d@example.com" });
    const bob = await makeUser({ username: "bob_d", email: "bob_d@example.com" });
    const post = await makePost(alice.token);
    const res = await request(app).delete(`/api/posts/${post._id}`)
      .set("Authorization", `Bearer ${bob.token}`);
    expect(res.statusCode).toBe(403);
  });
});

describe("GET /api/posts/me/posts", () => {
  it("should return all posts for the authenticated user", async () => {
    const { token } = await makeUser();
    await makePost(token, { title: "Draft 1" });
    const p2 = await makePost(token, { title: "Published 1" });
    await publishPost(token, p2._id);
    const res = await request(app).get("/api/posts/me/posts")
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it("should filter by state=draft", async () => {
    const { token } = await makeUser();
    await makePost(token, { title: "Draft Post" });
    const pub = await makePost(token, { title: "Published Post" });
    await publishPost(token, pub._id);
    const res = await request(app).get("/api/posts/me/posts?state=draft")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].state).toBe("draft");
  });

  it("should return 401 when not authenticated", async () => {
    const res = await request(app).get("/api/posts/me/posts");
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/posts/:id/like", () => {
  it("should like a post and increment like_count", async () => {
    const { token } = await makeUser();
    const post = await makePost(token);
    await publishPost(token, post._id);
    const res = await request(app).post(`/api/posts/${post._id}/like`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.like_count).toBe(1);
  });

  it("should return 409 if the user likes the same post twice", async () => {
    const { token } = await makeUser();
    const post = await makePost(token);
    await publishPost(token, post._id);
    await request(app).post(`/api/posts/${post._id}/like`).set("Authorization", `Bearer ${token}`);
    const res = await request(app).post(`/api/posts/${post._id}/like`).set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(409);
  });

  it("should return 404 when trying to like a draft post", async () => {
    const { token } = await makeUser();
    const post = await makePost(token);
    const res = await request(app).post(`/api/posts/${post._id}/like`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/posts/:id/like", () => {
  it("should unlike a post and decrement like_count", async () => {
    const { token } = await makeUser();
    const post = await makePost(token);
    await publishPost(token, post._id);
    await request(app).post(`/api/posts/${post._id}/like`).set("Authorization", `Bearer ${token}`);
    const res = await request(app).delete(`/api/posts/${post._id}/like`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.like_count).toBe(0);
  });

  it("should return 404 if the user has not liked the post", async () => {
    const { token } = await makeUser();
    const post = await makePost(token);
    await publishPost(token, post._id);
    const res = await request(app).delete(`/api/posts/${post._id}/like`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(404);
  });
});