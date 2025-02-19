const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, 'events.db');
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Error connecting to database:', err);
            } else {
                console.log('Connected to SQLite database');
                this.initializeDatabase();
            }
        });
    }

    initializeDatabase() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                channelID TEXT NOT NULL,
                dateTime TEXT NOT NULL,
                eventType TEXT NOT NULL,
                country TEXT,
                licensePlate TEXT NOT NULL,
                lane TEXT,
                direction TEXT,
                confidenceLevel TEXT,
                macAddress TEXT,
                licensePlateImage TEXT,
                vehicleImage TEXT,
                detectionImage TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        this.db.run(createTableSQL, (err) => {
            if (err) {
                console.error('Error creating events table:', err);
            } else {
                console.log('Events table initialized');
            }
        });
    }

    insertEvent(event) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO events (
                    channelID, dateTime, eventType, country, licensePlate,
                    lane, direction, confidenceLevel, macAddress,
                    licensePlateImage, vehicleImage, detectionImage
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                event.channelID,
                event.dateTime,
                event.eventType,
                event.country,
                event.licensePlate,
                event.lane,
                event.direction,
                event.confidenceLevel,
                event.macAddress,
                event.images?.licensePlate,
                event.images?.vehicle,
                event.images?.detection
            ];

            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    getAllEvents(options = {}) {
        return new Promise((resolve, reject) => {
            let sql = 'SELECT * FROM events';
            const params = [];
            const conditions = [];

            if (options.licensePlate) {
                conditions.push('licensePlate LIKE ?');
                params.push(`%${options.licensePlate}%`);
            }

            if (options.dateFrom) {
                conditions.push('dateTime >= ?');
                params.push(options.dateFrom);
            }

            if (options.dateTo) {
                conditions.push('dateTime <= ?');
                params.push(options.dateTo);
            }

            if (conditions.length > 0) {
                sql += ' WHERE ' + conditions.join(' AND ');
            }

            sql += ' ORDER BY dateTime DESC';

            if (options.limit) {
                sql += ' LIMIT ?';
                params.push(options.limit);
            }

            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    getEventStats() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as totalEvents,
                    COUNT(DISTINCT licensePlate) as uniqueVehicles,
                    COUNT(DISTINCT channelID) as activeChannels,
                    MAX(dateTime) as lastDetection
                FROM events
            `;

            this.db.get(sql, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

module.exports = new Database();