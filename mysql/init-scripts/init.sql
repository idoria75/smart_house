-- init.sql
CREATE TABLE
    sensors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        location VARCHAR(100) NOT NULL,
        ip_addr VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

CREATE TABLE
    readings (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        sensor_id INT NOT NULL,
        temperature DECIMAL(5, 2) NOT NULL,
        humidity DECIMAL(5, 2) NOT NULL,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sensor_id) REFERENCES sensors (id) ON DELETE CASCADE INDEX,
        
        idx_sensor_id (sensor_id),
        INDEX idx_sensor_time (sensor_id, recorded_at),
        INDEX idx_time (recorded_at)
    );