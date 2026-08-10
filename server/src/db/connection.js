'use strict';

const sqlite3 = require('sqlite3');

/** Open a sqlite3 database and resolve with the handle. */
function openDatabase(dbUrl) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbUrl, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

/** Promise-wrapped db.run. Resolves with { lastID, changes }. */
function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/** Promise-wrapped db.get. Resolves with one row or undefined. */
function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

/** Promise-wrapped db.all. Resolves with an array of rows. */
function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/** Promise-wrapped db.exec for multi-statement SQL. */
function exec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/** Close the connection. */
function closeDatabase(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = { openDatabase, run, get, all, exec, closeDatabase };
