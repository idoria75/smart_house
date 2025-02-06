#include <Arduino.h>
#include <ArduinoOTA.h>
#include <Wire.h>

#include "secrets.h"

#define LED_BUILTIN 2

const char *ssid = WIFI_SSID;
const char *password = WIFI_PASSWORD;

// the setup function runs once when you press reset or power the board
void setup()
{
  // initialize digital pin LED_BUILTIN as an output.
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH); // turn the LED off by making the voltage LOW

  Serial.begin(115200);

  bool led_state = LOW;

  Serial.println("Scanning for WiFi networks...");

  Serial.print("SSID: ");
  Serial.println(WIFI_SSID);
  Serial.print("Password: ");
  Serial.println(WIFI_PASSWORD); // Be careful with this!

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_BUILTIN, led_state);
    led_state = !led_state;
  }
  Serial.println("\nConnected to WiFi");

  delay(2000);
}

// the loop function runs over and over again forever
void loop()
{
  Serial.println("LED ON");
  digitalWrite(LED_BUILTIN, HIGH); // turn the LED on (HIGH is the voltage level)
  delay(2000);
  Serial.println("LED OFF");
  digitalWrite(LED_BUILTIN, LOW); // turn the LED off by making the voltage LOW
  delay(2000);                    // wait for a second
}
