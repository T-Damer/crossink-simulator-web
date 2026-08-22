#include <HalStorage.h>
#include <Logging.h>

#include <string>

#include "network/HttpDownloader.h"

namespace {
bool readCard(const std::string& url, const HttpDownloader::DataCallback& callback) {
  LOG_ERR("WASMHTTP", "Network is unavailable in browser build: %s", url.c_str());
  (void)callback;
  return false;
}
}  // namespace

bool HttpDownloader::fetchUrl(const std::string& url, std::string& output, const std::string&, const std::string&) {
  output.clear();
  return readCard(url, [&output](const uint8_t* data, const size_t size) {
    output.append(reinterpret_cast<const char*>(data), size);
    return true;
  });
}

bool HttpDownloader::fetchUrl(const std::string& url, Stream& stream, const std::string&, const std::string&) {
  return readCard(url, [&stream](const uint8_t* data, const size_t size) {
    stream.write(data, size);
    return true;
  });
}

bool HttpDownloader::fetchUrl(const std::string& url, const DataCallback& callback, const std::string&, const std::string&) {
  return readCard(url, callback);
}

HttpDownloader::DownloadError HttpDownloader::downloadToFile(const std::string& url, const std::string&, ProgressCallback, bool*, const std::string&, const std::string&) {
  readCard(url, [](const uint8_t*, size_t) { return true; });
  return HTTP_ERROR;
}
