#include "HalPowerManager.h"

#include "HalGPIO.h"

HalPowerManager powerManager;

void HalPowerManager::begin() {}
void HalPowerManager::startDeepSleep(HalGPIO &gpio) const { gpio.startDeepSleep(); }
bool HalPowerManager::lightSleep(const HalGPIO &) const { return false; }
bool HalPowerManager::onEinkBusyWaitSlice(int8_t, uint8_t) { return false; }
void HalPowerManager::noteMainLoopIteration() {}
void HalPowerManager::noteRenderWaitBegin() {}
void HalPowerManager::noteRenderWaitEnd() {}
void HalPowerManager::setPowerSaving(bool enable) {}
uint16_t HalPowerManager::getBatteryPercentage() const { return 100; }

HalPowerManager::Lock::Lock() {}
HalPowerManager::Lock::~Lock() {}
