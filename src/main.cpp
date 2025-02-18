#include <WiFi.h>
#include <ArduinoOTA.h>
#include <DHT.h>
#include <FS.h>
#include <SPIFFS.h>
#include <ESPAsyncWebServer.h>

#include "secrets.h"

// DHT22 setup
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

#define LED 2
#define BLINK_INTERVAL 200
#define READINGS_INTERVAL 120000
#define MAX_READINGS 3000 // Adjust buffer size (number of readings)

unsigned long lastReadingTime = 0;

// Setup web server
AsyncWebServer server(80);

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
  delay(200);
  digitalWrite(LED, LOW);
}

void trimCSVFile(const char *filename, int maxLines)
{
  File file = SPIFFS.open(filename, "r");
  if (!file)
  {
    Serial.println("Failed to open file for trimming");
    return;
  }

  // Count total lines
  int lineCount = 0;
  while (file.available())
  {
    file.readStringUntil('\n');
    lineCount++;
  }
  file.close();

  // If file is within limit, no trimming needed
  if (lineCount <= maxLines)
    return;

  Serial.println("Trimming CSV file...");

  // Reopen the file and create a temporary file
  file = SPIFFS.open(filename, "r");
  File tempFile = SPIFFS.open("/temp.csv", "w");
  if (!tempFile)
  {
    Serial.println("Failed to create temp file");
    file.close();
    return;
  }

  // Skip the oldest lines (keep the most recent ones)
  int linesToSkip = lineCount - maxLines / 2;
  int currentLine = 0;
  while (file.available())
  {
    String line = file.readStringUntil('\n');
    if (currentLine >= linesToSkip)
    {
      tempFile.println(line); // Copy recent data
    }
    currentLine++;
  }

  file.close();
  tempFile.close();

  // Replace old file with trimmed file
  SPIFFS.remove(filename);
  SPIFFS.rename("/temp.csv", filename);

  Serial.println("CSV file trimmed successfully.");
}

void appendToCSV(String data)
{
  File file = SPIFFS.open("/readings.csv", "r");
  int lineCount = 0;

  // Count number of lines
  while (file.available())
  {
    file.readStringUntil('\n');
    lineCount++;
  }
  file.close();

  // Trim file if too large
  if (lineCount >= MAX_READINGS)
  {
    Serial.println("File too large, trimming...");
    trimCSVFile("/readings.csv", MAX_READINGS);
  }

  // Append new data
  file = SPIFFS.open("/readings.csv", FILE_APPEND);
  if (!file)
  {
    Serial.println("Failed to open file for writing");
    return;
  }
  file.println(data);
  file.close();
  Serial.println("Data written to CSV");
}

void setup()
{
  pinMode(LED, OUTPUT);
  Serial.begin(115200);

  // Initialize DHT sensor
  dht.begin();

  // Initialize Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("WiFi connected");

  // Initialize SPIFFS
  if (!SPIFFS.begin(true))
  {
    Serial.println("Failed to mount SPIFFS");
    return;
  }

  // OTA setup
  ArduinoOTA.begin();

  // Serve CSV file for download
  server.on("/download", HTTP_GET, [](AsyncWebServerRequest *request)
            { request->send(SPIFFS, "/readings.csv", "text/csv"); });

  // Start server
  server.begin();

  Serial.println("Server started");
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

    // Read temperature and humidity
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();

    if (isnan(temperature) || isnan(humidity))
    {
      Serial.println("Failed to read from DHT sensor!");
      return;
    }

    // Open CSV file for appending
    File file = SPIFFS.open("/readings.csv", FILE_APPEND);
    if (!file)
    {
      Serial.println("Failed to open file for writing");
      return;
    }

    // Get current time as a timestamp
    String timestamp = getTimeString();

    // Write data to the file in CSV format
    file.printf("%s,%.2f,%.2f\n", timestamp.c_str(), temperature, humidity);
    file.close();

    Serial.println(".");
    Serial.printf("Data written to CSV: %s,%.2f,%.2f\n", timestamp.c_str(), temperature, humidity);
    blink();
  }

  delay(500);
  Serial.print(".");
}