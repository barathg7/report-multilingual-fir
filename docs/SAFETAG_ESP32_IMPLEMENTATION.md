# SafeTag ESP32 Hardware Implementation & Companion Specification

> [!IMPORTANT]
> **ESP32 firmware is not currently included in the web application.**
> This document specifies the physical engineering reference architecture, BLE GATT profile, electrical wiring, power budget, and companion gateway bridge required to manufacture and deploy physical ESP32 SafeTag emergency tags with the REPORT Universal Emergency System.

---

## 1. ESP32 Recommended Hardware Architecture

The recommended micro-controller for SafeTag hardware is the **Espressif ESP32-C3** (or **ESP32-S3**) SoC:

| Component | Specification | Rationale |
| :--- | :--- | :--- |
| **SoC** | ESP32-C3FH4 (RISC-V single-core 160MHz) | Integrated 4MB flash, ultra-low deep-sleep current (~5µA), built-in Bluetooth 5.0 LE |
| **Antenna** | On-board ceramic chip antenna (or PCB inverted-F) | Small footprint form-factor (< 35mm × 25mm × 8mm) for keychain or pendant mounting |
| **Power Source** | CR2032 Coin Cell (220mAh) or rechargeable 300mAh LiPo | Up to 12–18 months standby on CR2032 with aggressive deep sleep |
| **Haptic Motor** | 0827 / 1027 Coin Linear Resonant Actuator (LRA) or ERM | Discrete silent haptic feedback confirming police acknowledgement |
| **Primary Button** | Sealed tactile dome switch with metal snap (IP67) | High-reliability emergency button with tactile snap |
| **Secondary Button** | Micro push-button switch (recessed) | Dedicated medical SOS / cancel button |
| **Status LED** | Bi-color / RGB SMD LED (Red / Blue / Green) | Visual telemetry during pairing and transmission |

---

## 2. BLE GATT Service & Characteristic UUIDs

SafeTag operates as a **Bluetooth Low Energy Peripheral (Server)** advertising a custom 128-bit Emergency GATT Service:

```
Emergency Service UUID:
0000ffe0-0000-1000-8000-00805f9b34fb
```

### Characteristics Summary

| Characteristic | UUID | Properties | Direction | Description |
| :--- | :--- | :--- | :--- | :--- |
| `CHAR_TRIGGER_EVENT` | `0000ffe1-0000-1000-8000-00805f9b34fb` | **Notify** | Uplink (SafeTag $\to$ Phone) | Transmits emergency trigger packets upon button press |
| `CHAR_POLICE_ACK` | `0000ffe2-0000-1000-8000-00805f9b34fb` | **Write**, **Indicate** | Downlink (Phone $\to$ SafeTag) | Receives police acknowledgment command from REPORT server |
| `CHAR_DEVICE_TELEMETRY` | `0000ffe3-0000-1000-8000-00805f9b34fb` | **Read**, **Notify** | Uplink (SafeTag $\to$ Phone) | Battery percentage, firmware version, and diagnostic state |

---

## 3. Event Packet Format

Uplink events are transmitted as binary-packed structs over `CHAR_TRIGGER_EVENT` notifications, which the companion application parses and transforms into canonical REPORT JSON packets:

### Binary Packet Structure (16 bytes)

```
Offset  Size  Field              Description
0x00    1B    Header             Magic byte (0x53 = 'S')
0x01    1B    Protocol Version   Version (0x01)
0x02    1B    Event Type         0x01: SOS_GENERAL, 0x02: SOS_PHYSICAL_THREAT, 0x03: SOS_MEDICAL, 0x04: CANCEL, 0x05: STATUS
0x03    1B    Battery Level      0–100 percentage
0x04    4B    Sequence Number    32-bit unsigned big-endian integer (monotonic counter)
0x08    8B    Event Nonce / ID   64-bit cryptographic entropy / unique timestamp counter
```

### Downlink Police Acknowledgment Packet (4 bytes)

```
Offset  Size  Field              Description
0x00    1B    Header             Magic byte (0x41 = 'A')
0x01    1B    Ack Status         0x01: ACKNOWLEDGED, 0x02: RESOLVED
0x02    1B    Vibration Pulses   0x02 (2 pulses)
0x03    1B    Pulse Duration     Duration in units of 50ms (0x06 = 300ms)
```

---

## 4. Hardware Wiring & Button Circuitry

```
                    +3.3V / V_BATT
                         |
                       [10kΩ Pull-Up]
                         |
       GPIO9 ----------+------------------[ Pushbutton SW1: Primary SOS ]--- GND
       (Wakeup Pin)      |
                       [100nF] Debounce Cap
                         |
                        GND

       GPIO8 -----------------------------[ Pushbutton SW2: Secondary/Med ]--- GND
       GPIO3 ----------[ 220Ω ]-----------[ Green LED (Pairing / Status) ]--- GND
       GPIO4 ----------[ 220Ω ]-----------[ Red LED (Alarm Active) ]--------- GND
       GPIO5 ----------[ NPN / MOSFET Gate ]-[ Vibration Motor Driver ]------ GND
```

### Debounce Requirements
- **Hardware Filtering**: 100nF ceramic capacitor in parallel with switch to filter high-frequency contact bounce.
- **Firmware Debounce**: Active-low interrupt on falling edge with software refractory period of **50ms** (`SAFETAG_TIMINGS.DEBOUNCE_MS`).
- **Long Press Threshold**: **3,000ms** continuous hold required to trigger `SOS_GENERAL`.
- **Double Press Window**: Maximum interval between presses of **400ms** to trigger `SOS_PHYSICAL_THREAT`.
- **Cancellation Hold**: 5-second continuous hold on secondary button within **10,000ms** of trigger triggers `CANCEL`.

---

## 5. LED & Vibration Motor Telemetry States

| State | Red LED | Green LED | Vibration Motor | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Standby / Deep Sleep** | Off | Off | Off | Extreme power saving (<5µA) |
| **BLE Advertising** | Off | Blinking 1Hz | Off | Device discoverable by Android companion |
| **BLE Connected** | Off | Solid 3s then off | 1 short buzz (100ms) | Confirms pairing with victim's phone |
| **Emergency Triggered** | Blinking 4Hz | Off | 1 long buzz (500ms) | Confirms uplink transmission to companion |
| **Police Acknowledged** | Solid Red | Solid Green | **2 pulses (300ms ON, 150ms OFF, 300ms ON)** | **Downlink confirmation from police console** |
| **Emergency Cancelled** | 3 rapid blinks | 3 rapid blinks | 3 short buzzes (80ms each) | Accidental trigger cancellation confirmed |
| **Low Battery (< 15%)** | 1 blink every 10s | Off | Off | Maintenance indicator |

---

## 6. Battery Budget & Power Considerations

- In normal operation, the ESP32-C3 remains in **Deep Sleep** with ULP / RTC GPIO monitoring GPIO9 and GPIO8.
- **Standby Current**: ~5µA to 12µA.
- **Wakeup & BLE Event Transmission**: ~80mA peak for 450ms.
- **Police Ack Reception & Vibration**: ~120mA for 750ms.
- **Lifetime Estimate**:
  - CR2032 (220mAh): > 14 months on standby + 50 emergency activations.
  - Rechargeable 300mAh LiPo: > 18 months on standby.

---

## 7. Pairing & Security Considerations

1. **Bluetooth Security**: LE Secure Connections (LESC) with Numeric Comparison or Just Works + AES-128 cryptographic channel encryption.
2. **Replay Protection**: Every event contains an incrementing 32-bit `sequence_number` stored in ESP32 Non-Volatile Storage (NVS). Replayed packets are discarded by REPORT protocol engine.
3. **Identity Binding**: The SafeTag hardware MAC address and public key are registered in Supabase `safetag_devices` table and linked to the authenticated user ID.

---

## 8. Android Companion Gateway Architecture

Because web browsers running on Android/iOS cannot maintain continuous background BLE scanning when the phone screen is locked:

1. **Android Companion App**:
   - Runs a persistent `ForegroundService` with `START_STICKY` and a low-priority notification.
   - Utilizes `BluetoothLeScanner` with `ScanFilter` for Service UUID `0000ffe0-0000-1000-8000-00805f9b34fb`.
2. **Event Reception (Screen Locked)**:
   - When button is pressed, SafeTag wakes, connects to companion, and notifies `CHAR_TRIGGER_EVENT`.
   - Android Companion intercepts notification, immediately polls fused GPS provider for accurate location ($\pm 5$m), and acquires high-accuracy latitude/longitude.
3. **Dispatch to REPORT Backend**:
   - Companion invokes REPORT API endpoint:
     `POST https://report-fresh-five.vercel.app/api/sos/safetag-ingest`
     (or calls Supabase RPC `ingest_safetag_event` directly with HMAC device signature).
4. **Downlink Police Acknowledgement**:
   - Companion maintains Supabase Realtime channel or receives FCM high-priority push when police click **Claim & Acknowledge**.
   - Companion writes acknowledgement byte to BLE `CHAR_POLICE_ACK` on SafeTag.
   - SafeTag executes the 2-pulse haptic vibration motor pattern on victim's keychain.

---

## 9. ESP32 Firmware Pseudocode (C++ / ESP-IDF / Arduino)

```cpp
/**
 * SafeTag ESP32 Firmware Reference Architecture
 * Targets: ESP32-C3 / ESP32-S3
 * NOTE: Firmware is provided for hardware deployment reference and is not part of web bundle.
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Preferences.h>

#define SERVICE_UUID           "0000ffe0-0000-1000-8000-00805f9b34fb"
#define CHAR_TRIGGER_UUID      "0000ffe1-0000-1000-8000-00805f9b34fb"
#define CHAR_POLICE_ACK_UUID   "0000ffe2-0000-1000-8000-00805f9b34fb"
#define CHAR_TELEMETRY_UUID    "0000ffe3-0000-1000-8000-00805f9b34fb"

#define PIN_BUTTON_SOS         9
#define PIN_BUTTON_MED         8
#define PIN_LED_RED            4
#define PIN_LED_GREEN          3
#define PIN_HAPTIC_MOTOR       5

Preferences prefs;
BLECharacteristic *pTriggerChar;
BLECharacteristic *pPoliceAckChar;
uint32_t sequenceNumber = 0;

void executePoliceVibration() {
  // 2 pulses: 300ms buzz, 150ms pause, 300ms buzz
  digitalWrite(PIN_HAPTIC_MOTOR, HIGH);
  delay(300);
  digitalWrite(PIN_HAPTIC_MOTOR, LOW);
  delay(150);
  digitalWrite(PIN_HAPTIC_MOTOR, HIGH);
  delay(300);
  digitalWrite(PIN_HAPTIC_MOTOR, LOW);
}

class PoliceAckCallback: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) {
    uint8_t* data = pChar->getData();
    if (pChar->getLength() >= 2 && data[0] == 'A') {
      executePoliceVibration();
    }
  }
};

void sendEmergencyEvent(uint8_t eventType) {
  sequenceNumber++;
  prefs.putUInt("seq", sequenceNumber);

  uint8_t packet[16];
  packet[0] = 'S';          // Header
  packet[1] = 0x01;         // Version
  packet[2] = eventType;    // Event Type
  packet[3] = 95;           // Battery Level %
  packet[4] = (sequenceNumber >> 24) & 0xFF;
  packet[5] = (sequenceNumber >> 16) & 0xFF;
  packet[6] = (sequenceNumber >> 8) & 0xFF;
  packet[7] = sequenceNumber & 0xFF;
  esp_fill_random(&packet[8], 8); // Cryptographic nonce

  pTriggerChar->setValue(packet, sizeof(packet));
  pTriggerChar->notify();

  // Indicate active alarm
  digitalWrite(PIN_LED_RED, HIGH);
}

void setup() {
  pinMode(PIN_BUTTON_SOS, INPUT_PULLUP);
  pinMode(PIN_BUTTON_MED, INPUT_PULLUP);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_HAPTIC_MOTOR, OUTPUT);

  prefs.begin("safetag", false);
  sequenceNumber = prefs.getUInt("seq", 0);

  BLEDevice::init("REPORT-SafeTag-C3");
  BLEServer *pServer = BLEDevice::createServer();
  BLEService *pService = pServer->createService(SERVICE_UUID);

  pTriggerChar = pService->createCharacteristic(CHAR_TRIGGER_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  pTriggerChar->addDescriptor(new BLE2902());

  pPoliceAckChar = pService->createCharacteristic(CHAR_POLICE_ACK_UUID, BLECharacteristic::PROPERTY_WRITE);
  pPoliceAckChar->setCallbacks(new PoliceAckCallback());

  pService->start();
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->start();

  esp_sleep_enable_ext0_wakeup((gpio_num_t)PIN_BUTTON_SOS, 0); // Wake on button press
}

void loop() {
  // Deep sleep until button press interrupt occurs
  if (digitalRead(PIN_BUTTON_SOS) == LOW) {
    sendEmergencyEvent(0x01); // SOS_GENERAL
    delay(1000);
  }
}
```
