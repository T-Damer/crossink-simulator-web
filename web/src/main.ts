import "./styles.css";

type DeviceProfile = {
  id: string;
  name: string;
  width: number;
  height: number;
  bodyWidthMm: number;
  bodyHeightMm: number;
  skin: {
    src: string;
    screen: { top: number; right: number; bottom: number; left: number };
  };
};

type BrowserModule = {
  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
  cwrap(name: string, returnType: string, argTypes: string[]): (...args: number[]) => number;
};

type ModuleFactory = (options: {
  locateFile: (file: string) => string;
  print: (line: string) => void;
  printErr: (line: string) => void;
}) => Promise<BrowserModule>;

declare global {
  interface Window {
    createCrosspoint?: ModuleFactory;
  }
}

const publicAsset = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

const DEVICES: Record<string, DeviceProfile> = {
  x4pro: {
    id: "x4pro",
    name: "Xteink X4 Pro",
    width: 800,
    height: 480,
    bodyWidthMm: 111,
    bodyHeightMm: 69,
    skin: {
      src: publicAsset("device-skins/x4pro.png"),
      screen: { top: 5.1, right: 10.4, bottom: 12.3, left: 10.3 },
    },
  },
  x4: {
    id: "x4",
    name: "Xteink X4",
    width: 800,
    height: 480,
    bodyWidthMm: 114,
    bodyHeightMm: 69,
    skin: {
      src: publicAsset("device-skins/x4.png"),
      screen: { top: 5.2, right: 11.3, bottom: 15, left: 10.4 },
    },
  },
  x3: {
    id: "x3",
    name: "Xteink X3",
    width: 792,
    height: 528,
    bodyWidthMm: 97.6,
    bodyHeightMm: 63.7,
    skin: {
      src: publicAsset("device-skins/x3.png"),
      screen: { top: 5.8, right: 10.1, bottom: 14.8, left: 10.1 },
    },
  },
};

const selectedDevice =
  DEVICES[new URLSearchParams(location.search).get("device") ?? "x4pro"] ?? DEVICES.x4pro;
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) throw new Error("App mount is missing");

app.innerHTML = `
  <div class="app-shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">Xteink web emulator</p>
        <h1>${selectedDevice.name}</h1>
      </div>
      <div class="header-status" id="runtime-status" data-state="loading" role="status" aria-live="polite">Loading WASM…</div>
    </header>

    <section class="emulator-layout">
      <section class="device-column" aria-label="${selectedDevice.name} preview">
        <div class="device-frame" style="--device-ratio: ${selectedDevice.bodyHeightMm / selectedDevice.bodyWidthMm}; --screen-inset-top: ${selectedDevice.skin.screen.top}%; --screen-inset-right: ${selectedDevice.skin.screen.right}%; --screen-inset-bottom: ${selectedDevice.skin.screen.bottom}%; --screen-inset-left: ${selectedDevice.skin.screen.left}%" data-device="${selectedDevice.id}" data-screen-width="${selectedDevice.width}" data-screen-height="${selectedDevice.height}">
          <img class="device-skin" src="${selectedDevice.skin.src}" alt="" aria-hidden="true" />
          ${
            selectedDevice.id === "x4"
              ? '<button class="device-edge-key device-edge-key-right-top" type="button" data-scancode="82" aria-label="Up side key"></button><button class="device-edge-key device-edge-key-right-bottom" type="button" data-scancode="81" aria-label="Down side key"></button>'
              : '<button class="device-edge-key device-edge-key-left" type="button" data-scancode="82" aria-label="Up side key"></button><button class="device-edge-key device-edge-key-right" type="button" data-scancode="81" aria-label="Down side key"></button>'
          }
          <div class="device-screen" id="device-mount" aria-label="${selectedDevice.name} display"></div>
        </div>
        <p class="screen-caption">${selectedDevice.width} × ${selectedDevice.height} · 1-bit firmware preview</p>
      </section>

      <aside class="control-panel" aria-label="Emulator controls">
        <div class="panel-section model-control">
          <label for="device-select">Model</label>
          <select id="device-select">
            ${Object.values(DEVICES)
              .map(
                (device) =>
                  `<option value="${device.id}" ${device.id === selectedDevice.id ? "selected" : ""}>${device.name}</option>`,
              )
              .join("")}
          </select>
        </div>

        <div class="panel-section">
          <h2>Controls</h2>
          <div class="key-grid">
            <button class="hardware-key key-back" data-scancode="41" aria-label="Back">Back</button>
            <button class="hardware-key key-up" data-scancode="82" aria-label="Up">↑</button>
            <button class="hardware-key key-confirm" data-scancode="40" aria-label="Confirm">OK</button>
            <button class="hardware-key key-left" data-scancode="80" aria-label="Left">←</button>
            <button class="hardware-key key-down" data-scancode="81" aria-label="Down">↓</button>
            <button class="hardware-key key-right" data-scancode="79" aria-label="Right">→</button>
          </div>
          <p class="hint">Use the buttons or your keyboard.</p>
          <button class="reset-button" id="reset-device" type="button">Reset emulator</button>
          <label class="log-toggle">
            <input id="firmware-logs" type="checkbox" />
            <span>Firmware debug logs</span>
          </label>
          <label class="log-toggle">
            <input id="screen-refresh" type="checkbox" />
            <span>Simulate screen refresh</span>
          </label>
        </div>
      </aside>
    </section>
  </div>
`;

const mount = document.querySelector<HTMLDivElement>("#device-mount");
const status = document.querySelector<HTMLDivElement>("#runtime-status");
const firmwareLogs = document.querySelector<HTMLInputElement>("#firmware-logs");
const screenRefresh = document.querySelector<HTMLInputElement>("#screen-refresh");
let firmwareLogsEnabled = false;
let screenRefreshEnabled = false;
let setRefreshSimulation: ((enabled: number) => number) | null = null;

if (!mount || !status) throw new Error("Browser emulator controls are missing");

const SDL_SCANCODES: Record<string, number> = {
  Enter: 40,
  Escape: 41,
  Backspace: 42,
  Tab: 43,
  Space: 44,
  Minus: 45,
  Equal: 46,
  BracketLeft: 47,
  BracketRight: 48,
  Backslash: 49,
  Semicolon: 51,
  Quote: 52,
  Backquote: 53,
  Comma: 54,
  Period: 55,
  Slash: 56,
  CapsLock: 57,
  F1: 58,
  F2: 59,
  F3: 60,
  F4: 61,
  F5: 62,
  F6: 63,
  F7: 64,
  F8: 65,
  F9: 66,
  F10: 67,
  F11: 68,
  F12: 69,
  PrintScreen: 70,
  ScrollLock: 71,
  Pause: 72,
  Insert: 73,
  Home: 74,
  PageUp: 75,
  Delete: 76,
  End: 77,
  PageDown: 78,
  ArrowRight: 79,
  ArrowLeft: 80,
  ArrowDown: 81,
  ArrowUp: 82,
  NumLock: 83,
  NumpadDivide: 84,
  NumpadMultiply: 85,
  NumpadSubtract: 86,
  NumpadAdd: 87,
  NumpadEnter: 88,
  NumpadDecimal: 99,
  IntlBackslash: 100,
  ContextMenu: 101,
  NumpadEqual: 103,
  ShiftLeft: 225,
  ControlLeft: 224,
  AltLeft: 226,
  MetaLeft: 227,
  ControlRight: 228,
  ShiftRight: 229,
  AltRight: 230,
  MetaRight: 231,
};

const scancodeForKeyboardEvent = (event: KeyboardEvent): number | undefined => {
  const mapped = SDL_SCANCODES[event.code];
  if (mapped !== undefined) return mapped;
  if (event.code.startsWith("Key") && event.code.length === 4) {
    return event.code.charCodeAt(3) - "A".charCodeAt(0) + 4;
  }
  if (event.code.startsWith("Digit") && event.code.length === 6) {
    const digit = event.code.charCodeAt(5) - "0".charCodeAt(0);
    return digit === 0 ? 39 : 29 + digit;
  }
  if (event.code.startsWith("Numpad") && event.code.length === 7) {
    const digit = event.code.charCodeAt(6) - "0".charCodeAt(0);
    return digit === 0 ? 98 : 88 + digit;
  }
  return undefined;
};

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLSelectElement ||
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLElement && target.isContentEditable);

const loadScript = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Unable to load ${src}`));
    document.head.append(script);
  });

const paintRuntime = async (): Promise<void> => {
  status.textContent = `Loading ${selectedDevice.name}…`;
  try {
    await loadScript(publicAsset(`emulator/${selectedDevice.id}/crosspoint.js`));
    if (!window.createCrosspoint) throw new Error("WASM factory is missing");
    const module = await window.createCrosspoint({
      locateFile: (file) => publicAsset(`emulator/${selectedDevice.id}/${file}`),
      print: (line) => {
        if (firmwareLogsEnabled) console.info(`[firmware] ${line}`);
      },
      printErr: (line) => {
        if (firmwareLogsEnabled) console.warn(`[firmware] ${line}`);
      },
    });
    startDisplay(module);
  } catch (error) {
    status.dataset.state = "error";
    status.textContent = "WASM unavailable";
    mount.innerHTML = `<div class="runtime-error"><strong>Emulator build is missing</strong><code>python3 web/wasm/build.py --firmware-root /path/to/microMarkD --environment simulator_x4_pro</code><span>${error instanceof Error ? error.message : String(error)}</span></div>`;
  }
};

// Blocking-fetch bridge: a dedicated worker performs fetch() calls while the
// firmware thread blocks on Atomics.wait over a shared control block carved
// from the wasm heap (shared with workers in -pthread builds). Layout must
// match web/wasm/src/http_wasm_fetch.cpp.
const HTTP_WORKER_SRC = `
const CTRL_SEQ = 0, CTRL_STATUS = 1, CTRL_ERRLEN = 2, CTRL_URLLEN = 3,
      CTRL_METHODLEN = 4, CTRL_HDRLEN = 5, CTRL_AUTHLEN = 6, CTRL_BODYLEN = 7,
      CTRL_RESPLEN = 8;
const OFF_URL = 64, CAP_URL = 1024, OFF_METHOD = 1088, OFF_HDR = 1104,
      CAP_HDR = 2048, OFF_BODY = 3408, CAP_BODY = 1048576, OFF_RESP = 1051392,
      CAP_RESP = 4194304, OFF_ERR = 5253952, CAP_ERR = 256;
self.onmessage = (e) => {
  const bytes = new Uint8Array(e.data.sab, e.data.ptr);
  const ctrl = new Int32Array(e.data.sab, e.data.ptr, 16);
  const dec = new TextDecoder();
  let seen = 0;
  for (;;) {
    Atomics.wait(ctrl, CTRL_SEQ, seen);
    seen = Atomics.load(ctrl, CTRL_SEQ);
    const url = dec.decode(bytes.subarray(OFF_URL, OFF_URL + ctrl[CTRL_URLLEN]));
    const method = dec.decode(bytes.subarray(OFF_METHOD, OFF_METHOD + ctrl[CTRL_METHODLEN]));
    let headers = {};
    try { headers = JSON.parse(dec.decode(bytes.subarray(OFF_HDR, OFF_HDR + ctrl[CTRL_HDRLEN]))) || {}; } catch {}
    const bodyLen = ctrl[CTRL_BODYLEN];
    const init = { method, headers };
    if (bodyLen > 0) init.body = bytes.slice(OFF_BODY, OFF_BODY + bodyLen);
    fetch(url, init).then(async (resp) => {
      const buf = new Uint8Array(await resp.arrayBuffer());
      const n = Math.min(buf.length, CAP_RESP);
      bytes.set(buf.subarray(0, n), OFF_RESP);
      Atomics.store(ctrl, CTRL_RESPLEN, n);
      Atomics.store(ctrl, CTRL_STATUS, resp.status);
      Atomics.notify(ctrl, CTRL_STATUS);
    }).catch((err) => {
      const msg = new TextEncoder().encode(String(err)).subarray(0, CAP_ERR);
      bytes.set(msg, OFF_ERR);
      Atomics.store(ctrl, CTRL_ERRLEN, msg.length);
      Atomics.store(ctrl, CTRL_RESPLEN, 0);
      Atomics.store(ctrl, CTRL_STATUS, -1);
      Atomics.notify(ctrl, CTRL_STATUS);
    });
  }
};
`;

const startHttpWorker = (module: BrowserModule): void => {
  const alloc = module.cwrap("crosspoint_http_sab_alloc", "number", ["number"]);
  const ptr = alloc(6 * 1024 * 1024);
  if (!ptr || !module.HEAPU8.buffer.constructor.name.includes("Shared")) return;
  const worker = new Worker(URL.createObjectURL(new Blob([HTTP_WORKER_SRC], { type: "text/javascript" })));
  worker.postMessage({ sab: module.HEAPU8.buffer, ptr });
};

const startDisplay = (module: BrowserModule): void => {
  const framePtr = module.cwrap("crosspoint_frame_ptr", "number", []);
  const frameWidth = module.cwrap("crosspoint_frame_width", "number", []);
  const frameHeight = module.cwrap("crosspoint_frame_height", "number", []);
  const frameRotation = module.cwrap("crosspoint_frame_rotation", "number", []);
  const consumeDirty = module.cwrap("crosspoint_consume_dirty", "number", []);
  const touch = module.cwrap("crosspoint_touch", "void", ["number", "number", "number"]);
  const key = module.cwrap("crosspoint_key", "void", ["number", "number"]);
  setRefreshSimulation = module.cwrap("crosspoint_set_refresh_simulation", "void", ["number"]);
  setRefreshSimulation(screenRefreshEnabled ? 1 : 0);
  startHttpWorker(module);
  const setSleepTimeout = module.cwrap("crosspoint_set_sleep_timeout", "void", ["number"]);
  setSleepTimeout(31);
  const output = document.createElement("canvas");
  output.className = "firmware-canvas";
  output.tabIndex = 0;
  mount.replaceChildren(output);
  // Scripted-testing hook: raw module access for deterministic input injection.
  (window as unknown as Record<string, unknown>).__firmware = module;

  const buffer = document.createElement("canvas");
  const bufferContext = buffer.getContext("2d");
  const outputContext = output.getContext("2d");
  if (!bufferContext || !outputContext) throw new Error("Canvas 2D context is unavailable");
  const image = bufferContext.createImageData(selectedDevice.width, selectedDevice.height);
  let rotation = 90;
  let frameW = selectedDevice.width;
  let frameH = selectedDevice.height;
  let pointerId: number | null = null;
  let repaintAfterResize = true;

  const resize = (): void => {
    const portrait = rotation === 90 || rotation === 270;
    const logicalWidth = portrait ? frameH : frameW;
    const logicalHeight = portrait ? frameW : frameH;
    output.style.aspectRatio = `${logicalWidth} / ${logicalHeight}`;
    const rect = output.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    output.width = Math.max(1, Math.round(rect.width * dpr));
    output.height = Math.max(1, Math.round(rect.height * dpr));
    outputContext.imageSmoothingEnabled = true;
    outputContext.imageSmoothingQuality = "high";
    repaintAfterResize = true;
  };

  const renderFrame = (): void => {
    frameW = frameWidth();
    frameH = frameHeight();
    rotation = frameRotation();
    const portrait = rotation === 90 || rotation === 270;
    const logicalWidth = portrait ? frameH : frameW;
    const logicalHeight = portrait ? frameW : frameH;
    if (output.dataset.logicalWidth !== String(logicalWidth)) {
      output.dataset.logicalWidth = String(logicalWidth);
      output.dataset.logicalHeight = String(logicalHeight);
      resize();
    }
    const words = module.HEAPU32;
    const source = framePtr() >> 2;
    for (let pixel = 0; pixel < frameW * frameH; pixel += 1) {
      const argb = words[source + pixel];
      const offset = pixel * 4;
      image.data[offset] = (argb >> 16) & 0xff;
      image.data[offset + 1] = (argb >> 8) & 0xff;
      image.data[offset + 2] = argb & 0xff;
      image.data[offset + 3] = 255;
    }
    buffer.width = frameW;
    buffer.height = frameH;
    bufferContext.putImageData(image, 0, 0);
    const scale = Math.min(output.width / logicalWidth, output.height / logicalHeight);
    outputContext.setTransform(1, 0, 0, 1, 0, 0);
    outputContext.fillStyle = "#ffffff";
    outputContext.fillRect(0, 0, output.width, output.height);
    outputContext.save();
    outputContext.translate(output.width / 2, output.height / 2);
    outputContext.rotate((rotation * Math.PI) / 180);
    outputContext.scale(scale, scale);
    outputContext.drawImage(buffer, -frameW / 2, -frameH / 2);
    outputContext.restore();
    repaintAfterResize = false;
  };

  const loop = (): void => {
    if (consumeDirty() || repaintAfterResize) renderFrame();
    requestAnimationFrame(loop);
  };

  const toLogical = (event: PointerEvent): [number, number] => {
    const rect = output.getBoundingClientRect();
    const portrait = rotation === 90 || rotation === 270;
    const logicalWidth = portrait ? frameH : frameW;
    const logicalHeight = portrait ? frameW : frameH;
    // crosspoint_touch() receives coordinates in the native simulator window
    // space. Map the browser canvas to the cropped SDL window; HalDisplay adds
    // the panel inset before converting the point back to panel coordinates.
    const SIMULATOR_WINDOW_BEZEL_INSET = 2;
    const normalizedX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const normalizedY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const visibleWidth = Math.max(1, logicalWidth - SIMULATOR_WINDOW_BEZEL_INSET * 2);
    const visibleHeight = Math.max(1, logicalHeight - SIMULATOR_WINDOW_BEZEL_INSET * 2);
    return [Math.round(normalizedX * (visibleWidth - 1)), Math.round(normalizedY * (visibleHeight - 1))];
  };

  output.addEventListener("pointerdown", (event) => {
    if (pointerId !== null) return;
    pointerId = event.pointerId;
    try {
      output.setPointerCapture(event.pointerId);
    } catch {
      // Inactive-element captures throw; the tap is still valid without it.
    }
    const [x, y] = toLogical(event);
    touch(0, x, y);
  });
  // A lost up/cancel must not wedge the single-pointer guard: clear it when
  // the pointer leaves the canvas or the window loses focus.
  output.addEventListener("pointerleave", () => {
    pointerId = null;
  });
  window.addEventListener("blur", () => {
    pointerId = null;
  });
  output.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    const [x, y] = toLogical(event);
    touch(1, x, y);
  });
  const pointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    const [x, y] = toLogical(event);
    touch(2, x, y);
  };
  output.addEventListener("pointerup", pointerUp);
  output.addEventListener("pointercancel", pointerUp);
  const setHardwareKeyState = (scancode: number, pressed: boolean): void => {
    document
      .querySelectorAll<HTMLButtonElement>(`.hardware-key[data-scancode="${scancode}"]`)
      .forEach((button) => {
        button.classList.toggle("keyboard-pressed", pressed);
      });
  };
  window.addEventListener("keydown", (event) => {
    const scancode = scancodeForKeyboardEvent(event);
    if (scancode === undefined || isEditableTarget(event.target) || event.repeat) return;
    event.preventDefault();
    setHardwareKeyState(scancode, true);
    key(scancode, 1);
  });
  window.addEventListener("keyup", (event) => {
    const scancode = scancodeForKeyboardEvent(event);
    if (scancode === undefined || isEditableTarget(event.target)) return;
    setHardwareKeyState(scancode, false);
    key(scancode, 0);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-scancode]").forEach((button) => {
    const scancode = Number(button.dataset.scancode);
    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      button.setPointerCapture(event.pointerId);
      key(scancode, 1);
    });
    const release = () => key(scancode, 0);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });
  window.addEventListener("resize", resize);
  resize();
  renderFrame();
  status.dataset.state = "ready";
  status.textContent = "Firmware ready";
  loop();
};

document.querySelector<HTMLSelectElement>("#device-select")?.addEventListener("change", (event) => {
  const device = (event.target as HTMLSelectElement).value;
  location.search = `?device=${encodeURIComponent(device)}`;
});
document.querySelector<HTMLButtonElement>("#reset-device")?.addEventListener("click", () => {
  location.reload();
});
firmwareLogs?.addEventListener("change", () => {
  firmwareLogsEnabled = firmwareLogs.checked;
});
screenRefresh?.addEventListener("change", () => {
  screenRefreshEnabled = screenRefresh.checked;
  setRefreshSimulation?.(screenRefreshEnabled ? 1 : 0);
});
void paintRuntime();
