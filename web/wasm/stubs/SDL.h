#pragma once

#include <cstddef>
#include <cstdint>

extern "C" {

constexpr uint32_t SDL_INIT_VIDEO = 0x20u;
constexpr uint32_t SDL_WINDOW_SHOWN = 0x00000004u;
constexpr uint32_t SDL_WINDOW_ALLOW_HIGHDPI = 0x00002000u;
constexpr uint32_t SDL_RENDERER_ACCELERATED = 0x00000002u;
constexpr int SDL_TEXTUREACCESS_STREAMING = 1;
constexpr uint32_t SDL_PIXELFORMAT_ARGB8888 = 0x16362004u;
constexpr int SDL_WINDOWPOS_UNDEFINED = 0x1FFF0000;
#define SDL_HINT_RENDER_SCALE_QUALITY "SDL_RENDER_SCALE_QUALITY"

struct SDL_Window;
struct SDL_Renderer;
struct SDL_Texture;
struct SDL_Surface;

SDL_Window* SDL_CreateWindow(const char*, int, int, int, int, uint32_t);
SDL_Renderer* SDL_CreateRenderer(SDL_Window*, int, uint32_t);
SDL_Texture* SDL_CreateTexture(SDL_Renderer*, uint32_t, int, int, int);
int SDL_Init(uint32_t);
void SDL_Quit();
const char* SDL_GetError();
int SDL_SetHint(const char*, const char*);
void SDL_SetWindowSize(SDL_Window*, int, int);
int SDL_RenderSetLogicalSize(SDL_Renderer*, int, int);
int SDL_GetRendererOutputSize(SDL_Renderer*, int*, int*);

struct SDL_Rect {
  int x;
  int y;
  int w;
  int h;
};
struct SDL_Point {
  int x;
  int y;
};
enum SDL_RendererFlip { SDL_FLIP_NONE = 0 };

int SDL_UpdateTexture(SDL_Texture*, const SDL_Rect*, const void*, int);
int SDL_RenderClear(SDL_Renderer*);
int SDL_RenderCopy(SDL_Renderer*, SDL_Texture*, const SDL_Rect*, const SDL_Rect*);
int SDL_RenderCopyEx(SDL_Renderer*, SDL_Texture*, const SDL_Rect*, const SDL_Rect*, double, const SDL_Point*, SDL_RendererFlip);
void SDL_RenderPresent(SDL_Renderer*);
int SDL_RenderReadPixels(SDL_Renderer*, const SDL_Rect*, uint32_t, void*, int);
SDL_Surface* SDL_CreateRGBSurfaceWithFormatFrom(void*, int, int, int, int, uint32_t);
int SDL_SaveBMP(SDL_Surface*, const char*);
void SDL_FreeSurface(SDL_Surface*);

uint32_t SDL_GetTicks();
void SDL_Delay(uint32_t);

using SDL_Scancode = int;
constexpr SDL_Scancode SDL_SCANCODE_H = 11;
constexpr SDL_Scancode SDL_SCANCODE_P = 19;
constexpr SDL_Scancode SDL_SCANCODE_S = 22;
constexpr SDL_Scancode SDL_SCANCODE_RETURN = 40;
constexpr SDL_Scancode SDL_SCANCODE_ESCAPE = 41;
constexpr SDL_Scancode SDL_SCANCODE_RIGHT = 79;
constexpr SDL_Scancode SDL_SCANCODE_LEFT = 80;
constexpr SDL_Scancode SDL_SCANCODE_DOWN = 81;
constexpr SDL_Scancode SDL_SCANCODE_UP = 82;
constexpr int SDL_NUM_SCANCODES = 512;

constexpr uint32_t SDL_QUIT = 0x100;
constexpr uint32_t SDL_KEYDOWN = 0x300;
constexpr uint32_t SDL_KEYUP = 0x301;
constexpr uint32_t SDL_MOUSEMOTION = 0x400;
constexpr uint32_t SDL_MOUSEBUTTONDOWN = 0x401;
constexpr uint32_t SDL_MOUSEBUTTONUP = 0x402;
constexpr uint8_t SDL_BUTTON_LEFT = 1;

struct SDL_Keysym {
  SDL_Scancode scancode;
};
struct SDL_KeyboardEvent {
  uint32_t type;
  uint8_t repeat;
  SDL_Keysym keysym;
};
struct SDL_MouseButtonEvent {
  uint32_t type;
  uint8_t button;
  int32_t x;
  int32_t y;
};
struct SDL_MouseMotionEvent {
  uint32_t type;
  int32_t x;
  int32_t y;
};
union SDL_Event {
  uint32_t type;
  SDL_KeyboardEvent key;
  SDL_MouseButtonEvent button;
  SDL_MouseMotionEvent motion;
};

int SDL_PollEvent(SDL_Event*);
const uint8_t* SDL_GetKeyboardState(int*);

}  // extern "C"
