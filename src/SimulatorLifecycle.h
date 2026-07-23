#pragma once

#include <cstdint>

namespace SimulatorLifecycle {

enum class WakeReason { None, PowerButton };

void initProcessArgs(char** argv);
WakeReason consumeWakeReason();
void setSilentRebootToken(uint32_t magic, uint32_t target, uint32_t payload);
void restoreSilentRebootToken(uint32_t& magic, uint32_t& target, uint32_t& payload);
[[noreturn]] void reboot();
[[noreturn]] void rebootAsPowerWake();

}  // namespace SimulatorLifecycle
