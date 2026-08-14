#pragma once

#include <Arduino.h>

#define FREEINK_LOG_TRANSPORT_SERIAL 0
#define FREEINK_LOG_TRANSPORT_USB_CDC_WRITE 1
#define FREEINK_LOG_TRANSPORT_ROM_PRINTF 2
#if defined(SIMULATOR_DEVICE_STICKY)
#define FREEINK_LOG_TRANSPORT FREEINK_LOG_TRANSPORT_ROM_PRINTF
#else
#define FREEINK_LOG_TRANSPORT FREEINK_LOG_TRANSPORT_SERIAL
#endif
#define FREEINK_SERIAL_HAS_TX_TIMEOUT 1

#if defined(SIMULATOR_DEVICE_STICKY)
#define FREEINK_DEVICE_X4 0
#define FREEINK_DEVICE_X3 0
#define FREEINK_DEVICE_X4PRO 0
#define FREEINK_DEVICE_STICKY 1
#define FREEINK_CAP_TOUCH 1
#define FREEINK_CAP_FRONTLIGHT 0
#elif defined(SIMULATOR_DEVICE_X4_PRO)
#define FREEINK_DEVICE_X4 0
#define FREEINK_DEVICE_X3 0
#define FREEINK_DEVICE_X4PRO 1
#define FREEINK_DEVICE_STICKY 0
#define FREEINK_CAP_TOUCH 1
#define FREEINK_CAP_FRONTLIGHT 1
#elif defined(SIMULATOR_DEVICE_X3)
#define FREEINK_DEVICE_X4 0
#define FREEINK_DEVICE_X3 1
#define FREEINK_DEVICE_X4PRO 0
#define FREEINK_DEVICE_STICKY 0
#define FREEINK_CAP_TOUCH 0
#define FREEINK_CAP_FRONTLIGHT 0
#else
#define FREEINK_DEVICE_X4 1
#define FREEINK_DEVICE_X3 0
#define FREEINK_DEVICE_X4PRO 0
#define FREEINK_DEVICE_STICKY 0
#define FREEINK_CAP_TOUCH 0
#define FREEINK_CAP_FRONTLIGHT 0
#endif

// Keep the simulator's BoardConfig contract aligned with the FreeInk SDK.
// Firmware uses these family flags for compile-time resource choices, while
// the simulator selects a single device profile above.
#define FREEINK_MCU_C3 (FREEINK_DEVICE_X3 || FREEINK_DEVICE_X4)
#define FREEINK_MCU_S3 (FREEINK_DEVICE_X4PRO || FREEINK_DEVICE_STICKY)
#define FREEINK_MCU_ESP32 0

namespace BoardConfig {

enum class Board {
  XteinkX4,
  XteinkX3,
  XteinkX4Pro,
  Sticky,
};

struct BoardProfile {
  Board board;
  const char *name;
};

inline constexpr BoardProfile XTEINK_X4 = {Board::XteinkX4, "xteink_x4"};
inline constexpr BoardProfile XTEINK_X3 = {Board::XteinkX3, "xteink_x3"};
inline constexpr BoardProfile XTEINK_X4_PRO = {Board::XteinkX4Pro,
                                               "xteink_x4_pro"};
inline constexpr BoardProfile STICKY = {Board::Sticky, "sticky"};

#if defined(SIMULATOR_DEVICE_STICKY)
inline BoardProfile ACTIVE = STICKY;
#elif defined(SIMULATOR_DEVICE_X4_PRO)
inline BoardProfile ACTIVE = XTEINK_X4_PRO;
#elif defined(SIMULATOR_DEVICE_X3)
inline BoardProfile ACTIVE = XTEINK_X3;
#else
inline BoardProfile ACTIVE = XTEINK_X4;
#endif

inline bool selectDevice(Board board) {
  switch (board) {
  case Board::XteinkX4:
    ACTIVE = XTEINK_X4;
    return true;
  case Board::XteinkX3:
    ACTIVE = XTEINK_X3;
    return true;
  case Board::XteinkX4Pro:
    ACTIVE = XTEINK_X4_PRO;
    return true;
  case Board::Sticky:
    ACTIVE = STICKY;
    return true;
  }
  return false;
}

inline bool isX4Pro() { return ACTIVE.board == Board::XteinkX4Pro; }
inline bool isSticky() { return ACTIVE.board == Board::Sticky; }
inline bool hasTouch() { return isX4Pro() || isSticky(); }
inline bool hasHomeKey() { return isX4Pro(); }
inline bool hasPwmFrontlight() { return isX4Pro(); }

inline auto &serialTransport() {
  static HWCDC transport;
  return transport;
}

inline void holdPowerRails() {}

} // namespace BoardConfig
