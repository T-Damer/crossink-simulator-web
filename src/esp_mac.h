#pragma once
#include <cstdint>
#include <cstring>

#include "esp_err.h"

typedef enum {
  ESP_MAC_WIFI_STA = 0,
} esp_mac_type_t;

// Simulator stub: return a fixed fake MAC address
static inline int esp_efuse_mac_get_default(uint8_t mac[6]) {
  static const uint8_t fakeMac[6] = {0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x01};
  memcpy(mac, fakeMac, 6);
  return 0;
}

static inline esp_err_t esp_read_mac(uint8_t mac[6], esp_mac_type_t type) {
  if (type != ESP_MAC_WIFI_STA || mac == nullptr) {
    return ESP_FAIL;
  }
  return esp_efuse_mac_get_default(mac) == 0 ? ESP_OK : ESP_FAIL;
}
