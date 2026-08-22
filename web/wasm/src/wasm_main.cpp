#include <emscripten/emscripten.h>

#include <cstdint>

#include "HalDisplay.h"
#include "HalGPIO.h"
#include "SDL.h"
#include "SimulatorLifecycle.h"
#include "freertos/task.h"

#include "CrossPointSettings.h"

extern void setup();
extern void loop();
extern HalDisplay display;
extern HalGPIO gpio;

namespace simbrowser {
void pushEvent(const SDL_Event& event);
void setKey(int scancode, bool down);
const uint32_t* presentPixels();
int presentWidth();
int presentHeight();
int presentRotation();
int consumeDirty();
}  // namespace simbrowser

namespace {
void firmwareTask(void*) {
  setup();
  while (true) {
    gpio.beginFrame();
    loop();
    display.presentIfNeeded();
    SDL_Delay(1);
  }
}
}  // namespace

int main(int argc, char** argv) {
  SimulatorLifecycle::initProcessArgs(argv);
  xTaskCreate(&firmwareTask, "firmware", 8192, nullptr, 1, nullptr);
  return 0;
}

extern "C" {
EMSCRIPTEN_KEEPALIVE uintptr_t crosspoint_frame_ptr() { return reinterpret_cast<uintptr_t>(simbrowser::presentPixels()); }
EMSCRIPTEN_KEEPALIVE int crosspoint_frame_width() { return simbrowser::presentWidth(); }
EMSCRIPTEN_KEEPALIVE int crosspoint_frame_height() { return simbrowser::presentHeight(); }
EMSCRIPTEN_KEEPALIVE int crosspoint_frame_rotation() { return simbrowser::presentRotation(); }
EMSCRIPTEN_KEEPALIVE int crosspoint_consume_dirty() { return simbrowser::consumeDirty(); }

EMSCRIPTEN_KEEPALIVE void crosspoint_touch(const int phase, const int x, const int y) {
  SDL_Event event{};
  if (phase == 1) {
    event.motion.type = SDL_MOUSEMOTION;
    event.motion.x = x;
    event.motion.y = y;
  } else {
    event.button.type = phase == 0 ? SDL_MOUSEBUTTONDOWN : SDL_MOUSEBUTTONUP;
    event.button.button = SDL_BUTTON_LEFT;
    event.button.x = x;
    event.button.y = y;
  }
  simbrowser::pushEvent(event);
}

EMSCRIPTEN_KEEPALIVE void crosspoint_key(const int scancode, const int down) {
  SDL_Event event{};
  event.key.type = down ? SDL_KEYDOWN : SDL_KEYUP;
  event.key.repeat = 0;
  event.key.keysym.scancode = scancode;
  simbrowser::pushEvent(event);
  simbrowser::setKey(scancode, down != 0);
}

// Simulator-only control: override the auto-sleep timeout from the browser.
// The firmware polls getSleepTimeoutMs() every loop (src/main.cpp), so this
// takes effect immediately; >= 31 minutes means never. The write races the
// firmware task only on a single byte, which is acceptable for a simulator
// control and is re-applied by the UI after each page load.
EMSCRIPTEN_KEEPALIVE void crosspoint_set_sleep_timeout(const int minutes) {
  SETTINGS.sleepTimeoutMinutes = static_cast<uint8_t>(minutes);
}

EMSCRIPTEN_KEEPALIVE int crosspoint_get_sleep_timeout() {
  return static_cast<int>(SETTINGS.sleepTimeoutMinutes);
}
}  // extern "C"
