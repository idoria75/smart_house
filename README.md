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

## References

### Pinouts
