const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

const setupTestDB = async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
};

const clearTestDB = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) await collections[key].deleteMany({});
};

const teardownTestDB = async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
};

module.exports = { setupTestDB, clearTestDB, teardownTestDB };