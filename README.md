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

## Raspberry Pi Deployment (Pre-built Images)

### 1. Build Images for Raspberry Pi (on your development machine)

- Make sure Docker is set up for cross-building (use Docker Desktop or QEMU for ARM builds).
- Build images for ARM architecture:
  ```sh
  docker buildx build --platform linux/arm64 -t ghcr.io/<your-github-username>/smart-house-backend:latest ./backend --push
  docker buildx build --platform linux/arm64 -t ghcr.io/<your-github-username>/smart-house-frontend:latest ./frontend --push
  ```
- Replace `<your-github-username>` with your actual GitHub username.
- This will push the images to GitHub Container Registry.

### 2. Prepare Raspberry Pi for Deployment

- Install Docker and Docker Compose on your Raspberry Pi:
  ```sh
  sudo apt update
  sudo apt install docker.io docker-compose
  sudo usermod -aG docker $USER
  # Log out and back in for group changes to take effect
  ```

### 3. Create a Deployment Docker Compose File

- Create a new file `docker-compose.deploy.yaml` with the following content:
  ```yaml
  version: '3.8'

  services:
    backend:
      image: ghcr.io/<your-github-username>/smart-house-backend:latest
      container_name: backend-sh
      ports:
        - "3003:3001"
      environment:
        - NODE_ENV=production
        - HOST=0.0.0.0
        - PORT=3001
        - MQTT_BROKER=mqtt://localhost:1885
        - DB_PASSWORD=yourpassword
        - DB_USER=webapp
        - DB_NAME=webapp
        - DB_HOST=mysql-sh
      networks:
        - server-network

    frontend:
      image: ghcr.io/<your-github-username>/smart-house-frontend:latest
      container_name: frontend-sh
      ports:
        - "3002:3000"
      environment:
        - CHOKIDAR_USEPOLLING=true
        - REACT_APP_API_URL=http://localhost:3003
      networks:
        - server-network

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

    mysql:
      container_name: mysql-sh
      image: mysql:8.4.3
      restart: always
      ports:
        - 3308:3306
      volumes:
        - ./mysql/init-scripts:/docker-entrypoint-initdb.d
        - ./mysql/db:/var/lib/mysql
      environment:
        MYSQL_ROOT_PASSWORD: yourpassword
        MYSQL_PASSWORD: yourpassword
        MYSQL_DATABASE: webapp
        MYSQL_USER: webapp
      networks:
        - server-network

    adminer:
      container_name: adminer-sh
      image: adminer
      restart: always
      ports:
        - 9092:8080
      environment:
        ADMINER_DEFAULT_SERVER: mysql
      networks:
        - server-network

  networks:
    server-network:
      driver: bridge
  ```
- Replace `<your-github-username>` and passwords as needed.

### 4. Deploy on Raspberry Pi

- Pull and start the containers:
  ```sh
  docker compose -f docker-compose.deploy.yaml up -d
  ```
- Access the frontend at `http://<raspberry-pi-ip>:3002` and backend at `http://<raspberry-pi-ip>:3003`.

### 5. Environment Variables
- You can set sensitive variables in a `.env` file and reference it in the compose file if preferred.
- Make sure your MQTT broker and MySQL volumes/configs are present on the Pi.

### 6. Updating Images
- To update, rebuild and push new images to GitHub Container Registry, then run:
  ```sh
  docker compose -f docker-compose.deploy.yaml pull
  docker compose -f docker-compose.deploy.yaml up -d
  ```
