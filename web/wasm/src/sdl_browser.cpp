#include <emscripten/emscripten.h>
#include <emscripten/threading.h>

#include <atomic>
#include <chrono>
#include <cstring>
#include <mutex>

#include "HalDisplay.h"
#include "SDL.h"

namespace {
constexpr size_t QUEUE_SIZE = 256;
constexpr size_t MAX_PIXELS = 800 * 528;

std::mutex frameMutex;
uint32_t present[MAX_PIXELS]{};
uint32_t staging[MAX_PIXELS]{};
std::atomic<int> dirty{1};
std::atomic<int> rotation{0};
std::atomic<bool> refreshSimulation{false};
int stagingWidth = HalDisplay::DISPLAY_WIDTH;
int stagingHeight = HalDisplay::DISPLAY_HEIGHT;
int stagingRotation = 0;

std::mutex inputMutex;
SDL_Event queue[QUEUE_SIZE]{};
size_t queueHead = 0;
size_t queueTail = 0;
uint8_t keys[SDL_NUM_SCANCODES]{};

uint32_t ticks() {
  const auto now = std::chrono::steady_clock::now().time_since_epoch();
  return static_cast<uint32_t>(std::chrono::duration_cast<std::chrono::milliseconds>(now).count());
}
}  // namespace

namespace simbrowser {
void pushEvent(const SDL_Event& event) {
  std::lock_guard lock(inputMutex);
  const size_t next = (queueTail + 1) % QUEUE_SIZE;
  if (next == queueHead) return;
  queue[queueTail] = event;
  queueTail = next;
}

void setKey(const int scancode, const bool down) {
  if (scancode < 0 || scancode >= SDL_NUM_SCANCODES) return;
  std::lock_guard lock(inputMutex);
  keys[scancode] = down ? 1 : 0;
}

const uint32_t* presentPixels() { return present; }
int presentWidth() { return HalDisplay::DISPLAY_WIDTH; }
int presentHeight() { return HalDisplay::DISPLAY_HEIGHT; }
int presentRotation() { return rotation.load(std::memory_order_acquire); }
int consumeDirty() { return dirty.exchange(0, std::memory_order_acquire); }
void setRefreshSimulation(const bool enabled) {
  refreshSimulation.store(enabled, std::memory_order_release);
}
}  // namespace simbrowser

extern "C" {
int SDL_Init(uint32_t) { return 0; }
void SDL_Quit() {}
const char* SDL_GetError() { return ""; }
SDL_Window* SDL_CreateWindow(const char*, int, int, int, int, uint32_t) { return reinterpret_cast<SDL_Window*>(1); }
SDL_Renderer* SDL_CreateRenderer(SDL_Window*, int, uint32_t) { return reinterpret_cast<SDL_Renderer*>(2); }
SDL_Texture* SDL_CreateTexture(SDL_Renderer*, uint32_t, int, int, int) { return reinterpret_cast<SDL_Texture*>(3); }
int SDL_SetHint(const char*, const char*) { return 1; }
void SDL_SetWindowSize(SDL_Window*, int, int) {}
int SDL_RenderSetLogicalSize(SDL_Renderer*, int, int) { return 0; }
int SDL_GetRendererOutputSize(SDL_Renderer*, int* width, int* height) {
  if (width) *width = stagingWidth;
  if (height) *height = stagingHeight;
  return 0;
}

int SDL_UpdateTexture(SDL_Texture*, const SDL_Rect*, const void* pixels, const int pitch) {
  if (!pixels || pitch <= 0) return -1;
  stagingWidth = pitch / static_cast<int>(sizeof(uint32_t));
  stagingHeight = HalDisplay::DISPLAY_HEIGHT;
  std::memcpy(staging, pixels, static_cast<size_t>(stagingWidth) * stagingHeight * sizeof(uint32_t));
  return 0;
}
int SDL_RenderClear(SDL_Renderer*) { return 0; }
int SDL_RenderCopy(SDL_Renderer*, SDL_Texture*, const SDL_Rect*, const SDL_Rect*) {
  stagingRotation = 0;
  return 0;
}
int SDL_RenderCopyEx(SDL_Renderer*, SDL_Texture*, const SDL_Rect*, const SDL_Rect*, const double angle, const SDL_Point*, SDL_RendererFlip) {
  stagingRotation = static_cast<int>(angle) % 360;
  if (stagingRotation < 0) stagingRotation += 360;
  return 0;
}
void SDL_RenderPresent(SDL_Renderer*) {
  // Keep the browser responsive while the firmware thread waits through a
  // representative e-ink update time.
  if (refreshSimulation.load(std::memory_order_acquire)) {
    emscripten_thread_sleep(700);
  }
  std::lock_guard lock(frameMutex);
  std::memcpy(present, staging, static_cast<size_t>(stagingWidth) * stagingHeight * sizeof(uint32_t));
  rotation.store(stagingRotation, std::memory_order_release);
  dirty.store(1, std::memory_order_release);
}
int SDL_RenderReadPixels(SDL_Renderer*, const SDL_Rect*, uint32_t, void*, int) { return -1; }
SDL_Surface* SDL_CreateRGBSurfaceWithFormatFrom(void*, int, int, int, int, uint32_t) { return nullptr; }
int SDL_SaveBMP(SDL_Surface*, const char*) { return -1; }
void SDL_FreeSurface(SDL_Surface*) {}
uint32_t SDL_GetTicks() { return ticks(); }
void SDL_Delay(const uint32_t milliseconds) { emscripten_thread_sleep(static_cast<double>(milliseconds)); }

int SDL_PollEvent(SDL_Event* event) {
  std::lock_guard lock(inputMutex);
  if (queueHead == queueTail) return 0;
  if (event) *event = queue[queueHead];
  queueHead = (queueHead + 1) % QUEUE_SIZE;
  return 1;
}
const uint8_t* SDL_GetKeyboardState(int* count) {
  if (count) *count = SDL_NUM_SCANCODES;
  return keys;
}
}  // extern "C"
