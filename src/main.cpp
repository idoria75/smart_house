#include <WiFi.h>
#include <ArduinoOTA.h>
#include <DHT.h>
#include <PubSubClient.h>

#include "secrets.h"

// DHT22 setup
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

#define LED 2
#define BLINK_INTERVAL 200
#define READINGS_INTERVAL 5000
#define MAX_READINGS 3000 // Adjust buffer size (number of readings)

unsigned long lastReadingTime = 0;

WiFiClient espClient;
PubSubClient client(espClient);

// Function to get current timestamp using NTP
String getTimeString()
{
  configTime(0, 0, "pool.ntp.org"); // Set NTP server for time sync
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo))
  {
    Serial.println("Failed to obtain time");
    return "Unknown Time";
  }

  char timeString[20];
  strftime(timeString, sizeof(timeString), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(timeString);
}

void blink()
{
  digitalWrite(LED, HIGH);
  delay(BLINK_INTERVAL);
  digitalWrite(LED, LOW);
}

void connectWiFi()
{
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected. IP Address: " + WiFi.localIP().toString());
}

void connectMQTT()
{
  while (!client.connected())
  {
    Serial.print("Connecting to MQTT...");
    if (client.connect("ESP32Client"))
    { // Client ID
      Serial.println("Connected to MQTT broker!");
    }
    else
    {
      Serial.print("Failed, rc=");
      Serial.print(client.state());
      Serial.println(" Retrying in 5 seconds...");
      delay(5000);
    }
  }
}

void setup()
{
  pinMode(LED, OUTPUT);
  Serial.begin(115200);

  // Initialize DHT sensor
  dht.begin();

  connectWiFi();
  client.setServer(MQTT_BROKER, MQTT_PORT);

  // OTA setup
  ArduinoOTA.begin();

  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void loop()
{
  ArduinoOTA.handle(); // Keep OTA responsive

  unsigned long currentMillis = millis(); // Get current time

  if (currentMillis - lastReadingTime >= READINGS_INTERVAL)
  {
    lastReadingTime = currentMillis; // Update last recorded time

    if (!client.connected())
    {
      connectMQTT();
    }
    client.loop();

    // Read temperature and humidity
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();

    if (isnan(temperature) || isnan(humidity))
    {
      Serial.println("Failed to read from DHT sensor!");
      return;
    }

    // Get current time as a timestamp
    String timestamp = getTimeString();

    Serial.println(".");

    char message[100];

    snprintf(message, sizeof(message), "%s,%.2f,%.2f", timestamp.c_str(), temperature, humidity);

    // Print to Serial
    Serial.printf("Current measurement: %s\n", message);

    // Publish to MQTT
    client.publish(MQTT_TOPIC, message);

    blink();
  }
}