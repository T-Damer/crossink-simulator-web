// Browser HTTP backend for the simulator's sim_http_fetch port.
//
// Runs fetch() on a dedicated JS worker and blocks the calling firmware
// thread with Atomics.wait — no ASYNCIFY stack unwinding, so no mutex
// re-entrancy while a request is in flight. Request/response data moves
// through a SharedArrayBuffer region allocated from the wasm heap (shared
// with workers in -pthread builds) using this layout:
//
//   ctrl[0]  seq        (C++ increments per request; worker waits on it)
//   ctrl[1]  status     (worker writes HTTP status or -1, then notifies)
//   ctrl[2]  errLen
//   ctrl[3..8]          url/method/headers/auth/body/response lengths
//   data:   url@64 (1 KiB) method@1088 (16 B) headers@1104 (2 KiB)
//           auth@3152 (256 B) body@3408 (1 MiB) response@1051392 (4 MiB)
//           err@5253952 (256 B)
#include <emscripten.h>
#include <emscripten/atomic.h>

#include <cctype>
#include <cstdlib>
#include <cstring>
#include <map>
#include <string>

#include "SimHttpFetch.h"

namespace {

constexpr int CTRL_SEQ = 0;
constexpr int CTRL_STATUS = 1;
constexpr int CTRL_ERRLEN = 2;
constexpr int CTRL_URLLEN = 3;
constexpr int CTRL_METHODLEN = 4;
constexpr int CTRL_HDRLEN = 5;
constexpr int CTRL_AUTHLEN = 6;
constexpr int CTRL_BODYLEN = 7;
constexpr int CTRL_RESPLEN = 8;

constexpr int OFF_URL = 64;
constexpr int CAP_URL = 1024;
constexpr int OFF_METHOD = OFF_URL + CAP_URL;
constexpr int CAP_METHOD = 16;
constexpr int OFF_HDR = OFF_METHOD + CAP_METHOD;
constexpr int CAP_HDR = 2048;
constexpr int OFF_AUTH = OFF_HDR + CAP_HDR;
constexpr int CAP_AUTH = 256;
constexpr int OFF_BODY = OFF_AUTH + CAP_AUTH;
constexpr int CAP_BODY = 1024 * 1024;
constexpr int OFF_RESP = OFF_BODY + CAP_BODY;
constexpr int CAP_RESP = 4 * 1024 * 1024;
constexpr int OFF_ERR = OFF_RESP + CAP_RESP;
constexpr int CAP_ERR = 256;

uint8_t *sab = nullptr;

std::string base64Encode(const std::string &in) {
  static constexpr char kAlphabet[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string out;
  out.reserve(((in.size() + 2) / 3) * 4);
  size_t i = 0;
  while (i + 3 <= in.size()) {
    const uint32_t v = (static_cast<uint8_t>(in[i]) << 16) |
                       (static_cast<uint8_t>(in[i + 1]) << 8) |
                       static_cast<uint8_t>(in[i + 2]);
    out += kAlphabet[(v >> 18) & 0x3F];
    out += kAlphabet[(v >> 12) & 0x3F];
    out += kAlphabet[(v >> 6) & 0x3F];
    out += kAlphabet[v & 0x3F];
    i += 3;
  }
  const size_t rest = in.size() - i;
  if (rest == 1) {
    const uint32_t v = static_cast<uint8_t>(in[i]) << 16;
    out += kAlphabet[(v >> 18) & 0x3F];
    out += kAlphabet[(v >> 12) & 0x3F];
    out += "==";
  } else if (rest == 2) {
    const uint32_t v = (static_cast<uint8_t>(in[i]) << 16) |
                       (static_cast<uint8_t>(in[i + 1]) << 8);
    out += kAlphabet[(v >> 18) & 0x3F];
    out += kAlphabet[(v >> 12) & 0x3F];
    out += kAlphabet[(v >> 6) & 0x3F];
    out += '=';
  }
  return out;
}

} // namespace

// Called once from the page: carves the bridge region out of the (shared)
// wasm heap so both the firmware threads and the HTTP worker see the same
// bytes. The page then passes HEAPU8.buffer + the returned offset to the
// worker.
extern "C" EMSCRIPTEN_KEEPALIVE uint32_t crosspoint_http_sab_alloc(const int size) {
  if (sab == nullptr) {
    sab = static_cast<uint8_t *>(malloc(static_cast<size_t>(size)));
  }
  return static_cast<uint32_t>(reinterpret_cast<uintptr_t>(sab));
}

namespace sim_http_fetch {

bool wasmFetch(const std::string &url, const char *method,
               const std::map<std::string, std::string> &headers,
               const std::string &basicAuth, const char *body,
               size_t bodyLen, Response &out) {
  if (sab == nullptr) return false;
  volatile uint32_t *ctrl = reinterpret_cast<volatile uint32_t *>(sab);

  const std::string headersJson = [&] {
    std::string json = "{";
    bool first = true;
    for (const auto &header : headers) {
      if (!first) json += ",";
      first = false;
      std::string name = header.first;
      for (auto &c : name) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
      json += "\"" + name + "\":\"" + header.second + "\"";
    }
    if (!basicAuth.empty()) {
      if (!first) json += ",";
      json += "\"authorization\":\"Basic " + base64Encode(basicAuth) + "\"";
    }
    json += "}";
    return json;
  }();

  const auto put = [&](int off, int cap, const std::string &value) {
    const size_t n = std::min(value.size(), static_cast<size_t>(cap));
    memcpy(sab + off, value.data(), n);
    return static_cast<int>(n);
  };
  ctrl[CTRL_URLLEN] = put(OFF_URL, CAP_URL - 1, url);
  ctrl[CTRL_METHODLEN] = put(OFF_METHOD, CAP_METHOD - 1, method ? method : "GET");
  ctrl[CTRL_HDRLEN] = put(OFF_HDR, CAP_HDR - 1, headersJson);
  ctrl[CTRL_AUTHLEN] = 0; // auth rides inside the headers JSON now
  const size_t bodyBytes = (body && bodyLen > 0) ? std::min(bodyLen, static_cast<size_t>(CAP_BODY)) : 0;
  if (bodyBytes > 0) memcpy(sab + OFF_BODY, body, bodyBytes);
  ctrl[CTRL_BODYLEN] = static_cast<int>(bodyBytes);
  ctrl[CTRL_RESPLEN] = 0;
  ctrl[CTRL_ERRLEN] = 0;
  ctrl[CTRL_STATUS] = 0;

  // seq only ever increases; the worker waits for it to change.
  static uint32_t seq = 0;
  emscripten_atomic_store_u32((void *)(ctrl + CTRL_SEQ), ++seq);
  emscripten_atomic_notify((void *)(ctrl + CTRL_SEQ), 1);

  while (emscripten_atomic_load_u32((void *)(ctrl + CTRL_STATUS)) == 0) {
    emscripten_atomic_wait_u32((void *)(ctrl + CTRL_STATUS), 0, -1);
  }

  const int status = static_cast<int>(ctrl[CTRL_STATUS]);
  if (status < 0) {
    const int errLen = static_cast<int>(ctrl[CTRL_ERRLEN]);
    out.curlExitCode = 1; // transport-level failure, mirroring the curl path
    (void)errLen;
    return false;
  }

  const int respLen = static_cast<int>(ctrl[CTRL_RESPLEN]);
  out.body.assign(reinterpret_cast<const char *>(sab + OFF_RESP),
                  static_cast<size_t>(respLen));
  out.statusCode = status;
  return true;
}

} // namespace sim_http_fetch
