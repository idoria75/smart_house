# smart_house

ESP32 and Raspberry Pi wireless sensor network to monitor different conditions of a house

## Setup

- Create secrets file:

```cpp
#ifndef SECRETS_H
#define SECRETS_H

const char *WIFI_SSID = "";
const char *WIFI_PASSWORD = "";

const char *MQTT_BROKER = ""; // Public broker for testing
const int MQTT_PORT = 0000;               // Default MQTT port
const char *MQTT_TOPIC = "";    // Topic to publish to

#endif // SECRETS_H
```

## Environment Variables

Create a `.env` file in the project root with the following content:

```
DB_PASSWORD=yourpassword
DB_USER=webapp
DB_NAME=webapp
DB_HOST=mysql-sh
```

This file is ignored by git and used for Docker Compose and backend configuration.

## Database Initialization

The MySQL database is initialized using the script in `mysql/init-scripts/init.sql` when you run `docker compose up`.

# Smart House Project

## Architecture Overview

- **MQTT Broker**: Runs on Raspberry Pi (e.g., eclipse-mosquitto)
- **Backend**: Node.js/Express service (can run on Pi or another device)
- **Frontend**: React + Tailwind dashboard (can run on Pi or another device)
- **Database**: MySQL (can run on Pi or another device)
- **Adminer**: Web-based MySQL admin tool

## Deployment Steps

### 1. MQTT Broker (Raspberry Pi)
- Install Docker and Docker Compose on your Pi.
- Use the following service in your `docker-compose.yaml`:
  ```yaml
  mosquitto:
    container_name: mosquitto-sh
    image: eclipse-mosquitto:2.0.22
    ports:
      - "1885:1883"
      - "9002:9001"
    volumes:
      - ./mosquitto/config:/mosquitto/config
    networks:
      - server-network
  ```
- Ensure your config file is at `mosquitto/config/mosquitto.conf`.

### 2. Database Setup
- Create a `.env` file in your project root:
  ```env
  DB_PASSWORD=yourpassword
  DB_USER=webapp
  DB_NAME=webapp
  DB_HOST=mysql-sh
  ```
- This is used by MySQL and the backend.
- MySQL will be initialized with the schema in `mysql/init-scripts/init.sql`.

### 3. Backend Setup
- Create a `.env` file in `backend/` (optional, if you want to override defaults):
  ```env
  DB_PASSWORD=yourpassword
  DB_USER=webapp
  DB_NAME=webapp
  DB_HOST=mysql-sh
  MQTT_BROKER=mqtt://<raspberry-pi-ip>:1885
  ```
- In `docker-compose.yaml`, set:
  ```yaml
  environment:
    - NODE_ENV=development
    - HOST=0.0.0.0
    - PORT=3001
    - MQTT_BROKER=mqtt://<raspberry-pi-ip>:1885
  ```
- Replace `<raspberry-pi-ip>` with your Pi's actual IP address.

### 4. Frontend Setup
- Create a `.env` file in `frontend/`:
  ```env
  REACT_APP_API_URL=http://<backend-ip>:3003
  ```
- In `docker-compose.yaml`, set:
  ```yaml
  environment:
    - CHOKIDAR_USEPOLLING=true
    - REACT_APP_API_URL=http://<backend-ip>:3003
  ```
- Replace `<backend-ip>` with the IP address where your backend is running (can be your Pi or another device).

### 5. Running Everything
- Build and start all services:
  ```sh
  docker compose up --build
  ```
- Access the frontend at `http://<backend-ip>:3002` from any device on your network.
- Access Adminer at `http://<backend-ip>:9092` for MySQL management.

## Notes
- Make sure all `.env` files are created and contain the correct values.
- For security, use strong passwords for your database.
- Open necessary ports on your Raspberry Pi and local device firewall.
- The backend and frontend can run on the Pi or any other device in your network, as long as they can reach the MQTT broker and MySQL.
- The MQTT broker must be reachable at the IP and port you set in your environment variables.

## References

### Pinouts
