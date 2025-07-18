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

const sensorBuffers = {};
const BUFFER_INTERVAL = 30000; // 30 seconds

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
    // Buffer readings per sensor
    if (!sensorBuffers[sensor_ip]) sensorBuffers[sensor_ip] = [];
    sensorBuffers[sensor_ip].push({
      timestamp,
      temperature: parseFloat(temperature),
      humidity: parseFloat(humidity)
    });
  });

  // Periodically flush buffers
  setInterval(() => {
    Object.keys(sensorBuffers).forEach(flushSensorBuffer);
  }, BUFFER_INTERVAL);
}

function flushSensorBuffer(sensor_ip) {
  const buffer = sensorBuffers[sensor_ip];
  if (!buffer || buffer.length === 0) return;
  // Average temperature and humidity
  const avgTemp = buffer.reduce((sum, r) => sum + r.temperature, 0) / buffer.length;
  const avgHum = buffer.reduce((sum, r) => sum + r.humidity, 0) / buffer.length;
  // Use timestamp of last reading in buffer
  const timestamp = buffer[buffer.length - 1].timestamp;
  // ...DB logic...
  db.query('SELECT id FROM sensors WHERE ip_addr = ?', [sensor_ip]).then(([rows]) => {
    let sensor_id;
    if (rows.length === 0) {
      db.query('INSERT INTO sensors (location, ip_addr) VALUES (?, ?)', ["Unknown", sensor_ip]).then(([result]) => {
        sensor_id = result.insertId;
        insertAveragedReading(sensor_id, sensor_ip, avgTemp, avgHum, timestamp);
      });
    } else {
      sensor_id = rows[0].id;
      insertAveragedReading(sensor_id, sensor_ip, avgTemp, avgHum, timestamp);
    }
  });
  sensorBuffers[sensor_ip] = [];
}

function insertAveragedReading(sensor_id, sensor_ip, avgTemp, avgHum, timestamp) {
  db.query(
    'INSERT INTO readings (sensor_id, temperature, humidity, recorded_at) VALUES (?, ?, ?, ?)',
    [sensor_id, avgTemp, avgHum, timestamp]
  );
  db.query(
    'INSERT INTO sensor_readings (timestamp, sensor_ip, temperature, humidity) VALUES (?, ?, ?, ?)',
    [timestamp, sensor_ip, avgTemp, avgHum]
  );
  console.log(`Averaged reading stored for ${sensor_ip}: Temp=${avgTemp}, Hum=${avgHum}`);
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
