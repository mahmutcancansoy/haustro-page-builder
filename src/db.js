const MongoClient = require('mongodb').MongoClient;
const { loadEnv } = require('./config');

let client = null;
let connecting = null;
let shellMode = false;

function isConnected() {
  return !!client;
}

function setShellMode(value) {
  shellMode = !!value;
}

function isShellMode() {
  return shellMode;
}

function connect() {
  if (client) return Promise.resolve(client);
  if (connecting) return connecting;
  const { uri, dbUser, dbPass } = loadEnv();
  connecting = new Promise((resolve, reject) => {
    MongoClient.connect(
      uri,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        auth: { user: dbUser, password: dbPass },
        keepAlive: true,
        poolSize: 1,
      },
      (err, c) => {
        connecting = null;
        if (err) return reject(err);
        client = c;
        resolve(c);
      }
    );
  });
  return connecting;
}

function getDb() {
  if (!client) throw new Error('MongoDB bağlantısı yok. Önce connect() çağırın.');
  const { dbName } = loadEnv();
  return client.db(dbName);
}

function close() {
  return new Promise((resolve, reject) => {
    if (!client) return resolve();
    client.close((err) => {
      client = null;
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = {
  connect,
  getDb,
  close,
  isConnected,
  setShellMode,
  isShellMode,
};
