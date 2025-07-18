const mqtt = require('mqtt');
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://192.168.0.126:1885';
const MQTT_TOPIC = 'test';
const PORT = process.env.PORT || 3001;

// MySQL connection config
const dbConfig = {
  host: process.env.DB_HOST || 'mysql-sh',
  user: process.env.DB_USER || 'webapp',
  password: process.env.DB_PASSWORD || 'yourpassword',
  database: process.env.DB_NAME || 'webapp',
};

const app = express();
app.use(cors());
let db;

// Connect to MySQL
async function initDB() {
  db = await mysql.createPool(dbConfig);
}

// Subscribe to MQTT and handle messages
function initMQTT() {
  const client = mqtt.connect(MQTT_BROKER);
  client.on('connect', () => {
    console.log('Connected to MQTT broker');
    client.subscribe(MQTT_TOPIC, (err) => {
      if (err) console.error('MQTT subscribe error:', err);
      else console.log(`Subscribed to topic: ${MQTT_TOPIC}`);
    });
  });

  client.on('message', async (topic, message) => {
    // Parse message: YYYY-MM-DD HH:MM:SS,IP,TEMP,HUM
    const payload = message.toString();
    const [timestamp, sensor_ip, temperature, humidity] = payload.split(',');
    if (!timestamp || !sensor_ip || !temperature || !humidity) {
      console.error('Malformed message:', payload);
      return;
    }
    try {
      // Check if sensor exists
      let [rows] = await db.query('SELECT id FROM sensors WHERE ip_addr = ?', [sensor_ip]);
      let sensor_id;
      if (rows.length === 0) {
        // Insert new sensor
        const [result] = await db.query('INSERT INTO sensors (location, ip_addr) VALUES (?, ?)', ["Unknown", sensor_ip]);
        sensor_id = result.insertId;
        console.log('New sensor added:', sensor_ip);
      } else {
        sensor_id = rows[0].id;
      }
      // Insert reading
      await db.query(
        'INSERT INTO readings (sensor_id, temperature, humidity, recorded_at) VALUES (?, ?, ?, ?)',
        [sensor_id, parseFloat(temperature), parseFloat(humidity), timestamp]
      );
      // Also insert into sensor_readings for legacy support
      await db.query(
        'INSERT INTO sensor_readings (timestamp, sensor_ip, temperature, humidity) VALUES (?, ?, ?, ?)',
        [timestamp, sensor_ip, parseFloat(temperature), parseFloat(humidity)]
      );
      console.log('Inserted:', payload);
    } catch (err) {
      console.error('DB insert error:', err);
    }
  });
}

// API endpoint: GET /api/data?date=YYYY-MM-DD
app.get('/api/data', async (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: 'Missing date parameter' });
  try {
    const [rows] = await db.query(
      'SELECT * FROM sensor_readings WHERE DATE(timestamp) = ?',
      [date]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'DB error', details: err.message });
  }
});

// Start server
initDB().then(() => {
  initMQTT();
  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
});
