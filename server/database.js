const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Create users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);

    // Create devices table
    db.run(`CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT,
        ip TEXT,
        mac TEXT,
        type TEXT DEFAULT 'desktop',
        win_user TEXT,
        win_pass TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Ensure columns exist if table was already created
    db.run("ALTER TABLE devices ADD COLUMN win_user TEXT", (err) => { });
    db.run("ALTER TABLE devices ADD COLUMN win_pass TEXT", (err) => { });

    // Add default admin user if it doesn't exist
    const defaultUser = 'admin';
    const defaultPass = 'admin123';

    db.get("SELECT * FROM users WHERE username = ?", [defaultUser], (err, row) => {
        if (err) {
            console.error(err.message);
        } else if (!row) {
            const hash = bcrypt.hashSync(defaultPass, 10);
            db.run("INSERT INTO users (username, password) VALUES (?, ?)", [defaultUser, hash]);
            console.log("Default admin user created.");
        }
    });
});

module.exports = {
    getUserByUsername: (username) => {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    addUser: (username, password) => {
        return new Promise((resolve, reject) => {
            const hash = bcrypt.hashSync(password, 10);
            db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hash], function (err) {
                if (err) reject(err);
                else resolve({ id: this.lastID });
            });
        });
    },
    getDevices: (userId) => {
        return new Promise((resolve, reject) => {
            db.all("SELECT * FROM devices WHERE user_id = ?", [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    addDevice: (userId, name, ip, mac, type, win_user, win_pass) => {
        return new Promise((resolve, reject) => {
            db.run("INSERT INTO devices (user_id, name, ip, mac, type, win_user, win_pass) VALUES (?, ?, ?, ?, ?, ?, ?)", [userId, name, ip, mac, type, win_user, win_pass], function (err) {
                if (err) reject(err);
                else resolve({ id: this.lastID });
            });
        });
    },
    deleteDevice: (deviceId, userId) => {
        return new Promise((resolve, reject) => {
            db.run("DELETE FROM devices WHERE id = ? AND user_id = ?", [deviceId, userId], function (err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    }
};
