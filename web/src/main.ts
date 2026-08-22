import "@phosphor-icons/web/regular";
import { type TinyFile, TinyGit } from "@crosspoint/tiny-git";
import "./styles.css";

type DeviceProfile = {
  id: string;
  name: string;
  width: number;
  height: number;
  inches: number;
  ppi: number;
  bodyWidthMm: number;
  bodyHeightMm: number;
  bodyDepthMm: number;
  touch: boolean;
  skin: {
    src: string;
    screen: { top: number; right: number; bottom: number; left: number };
  };
};

type BrowserModule = {
  HEAPU32: Uint32Array;
  cwrap(name: string, returnType: string, argTypes: string[]): (...args: number[]) => number;
  FS: {
    mkdirTree(path: string): void;
    writeFile(path: string, data: Uint8Array): void;
  };
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

const DEVICES: Record<string, DeviceProfile> = {
  x4pro: {
    id: "x4pro",
    name: "Xteink X4 Pro",
    width: 800,
    height: 480,
    inches: 4.3,
    ppi: 219,
    bodyWidthMm: 111,
    bodyHeightMm: 69,
    bodyDepthMm: 5.95,
    touch: true,
    skin: {
      src: "/device-skins/x4pro.png",
      screen: { top: 5.1, right: 10.4, bottom: 12.3, left: 10.3 },
    },
  },
  x4: {
    id: "x4",
    name: "Xteink X4",
    width: 800,
    height: 480,
    inches: 4.3,
    ppi: 220,
    bodyWidthMm: 114,
    bodyHeightMm: 69,
    bodyDepthMm: 5.9,
    touch: false,
    skin: {
      src: "/device-skins/x4.png",
      screen: { top: 5.2, right: 11.3, bottom: 15, left: 10.4 },
    },
  },
  x3: {
    id: "x3",
    name: "Xteink X3",
    width: 792,
    height: 528,
    inches: 3.7,
    ppi: 259,
    bodyWidthMm: 97.6,
    bodyHeightMm: 63.7,
    bodyDepthMm: 5.1,
    touch: false,
    skin: {
      src: "/device-skins/x3.png",
      screen: { top: 5.8, right: 10.1, bottom: 14.8, left: 10.1 },
    },
  },
};

const selectedDevice =
  DEVICES[new URLSearchParams(location.search).get("device") ?? "x4pro"] ?? DEVICES.x4pro;
const panelWidthMm = Math.round((selectedDevice.width / selectedDevice.ppi) * 25.4 * 10) / 10;
const panelHeightMm = Math.round((selectedDevice.height / selectedDevice.ppi) * 25.4 * 10) / 10;
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) throw new Error("App mount is missing");

app.innerHTML = `
  <div class="app-shell">
    <header class="app-header">
      <div class="brand-mark" aria-label="micro-mark D"><span>D</span><small>micro-mark</small></div>
      <div>
        <p class="eyebrow">CrossInk simulator package</p>
        <h1>Browser device lab</h1>
      </div>
      <div class="header-status" id="runtime-status" data-state="loading">Loading WASM…</div>
    </header>

    <section class="lab-grid">
      <aside class="control-panel" aria-label="Emulator controls">
        <div class="panel-section">
          <label for="device-select">Device profile</label>
          <select id="device-select">
            ${Object.values(DEVICES)
              .map(
                (device) =>
                  `<option value="${device.id}" ${device.id === selectedDevice.id ? "selected" : ""}>${device.name}</option>`,
              )
              .join("")}
          </select>
          <dl class="device-specs">
            <div><dt>Logical panel</dt><dd>${selectedDevice.width} × ${selectedDevice.height}px</dd></div>
            <div><dt>Screen</dt><dd>≈ ${panelWidthMm} × ${panelHeightMm}mm · ${selectedDevice.inches}″</dd></div>
            <div><dt>Body</dt><dd>${selectedDevice.bodyHeightMm} × ${selectedDevice.bodyWidthMm} × ${selectedDevice.bodyDepthMm}mm portrait</dd></div>
            <div><dt>Input</dt><dd>${selectedDevice.touch ? "touch + buttons" : "buttons"}</dd></div>
          </dl>
        </div>

        <div class="panel-section">
          <div class="section-heading"><h2>Device keys</h2><span>Keyboard works too</span></div>
          <div class="key-grid">
            <button class="hardware-key key-back" data-scancode="41" aria-label="Back"><i class="ph ph-arrow-left"></i></button>
            <button class="hardware-key key-up" data-scancode="82" aria-label="Up">↑</button>
            <button class="hardware-key key-confirm" data-scancode="40" aria-label="Confirm">OK</button>
            <button class="hardware-key key-left" data-scancode="80" aria-label="Left">←</button>
            <button class="hardware-key key-down" data-scancode="81" aria-label="Down">↓</button>
            <button class="hardware-key key-right" data-scancode="79" aria-label="Right">→</button>
          </div>
          <button class="capture-toggle" id="keyboard-capture" type="button" aria-pressed="false">
            <i class="ph ph-keyboard"></i><span>Capture keyboard</span><strong>Off</strong>
          </button>
          <p class="hint" id="keyboard-capture-status">Device shortcuts only; form fields remain editable.</p>
        </div>

        <div class="panel-section">
          <div class="section-heading"><h2>Browser card</h2><span>saved locally</span></div>
          <input id="image-input" type="file" accept="image/png,image/jpeg,image/bmp,image/webp" hidden />
          <button class="secondary-button" id="upload-button"><i class="ph ph-upload-simple"></i> Mount image on SD</button>
          <p class="hint" id="upload-status">Upload a PNG/JPG/BMP and it will be available at <code>/fs_/browser-upload/</code>.</p>
        </div>

        <div class="panel-section">
          <div class="section-heading"><h2><i class="ph ph-moon"></i> Auto-sleep</h2><span id="sleep-state">device default</span></div>
          <select id="sleep-select" aria-label="Auto-sleep timeout">
            <option value="31">Never — testing</option>
            <option value="1">After 1 minute</option>
            <option value="5">After 5 minutes</option>
            <option value="10">After 10 minutes (device default)</option>
            <option value="15">After 15 minutes</option>
            <option value="30">After 30 minutes</option>
          </select>
          <p class="hint">Applies immediately and is remembered for this browser. "Never" keeps scripted test sessions alive.</p>
          <button class="secondary-button" id="reset-device" type="button"><i class="ph ph-arrow-counter-clockwise"></i> Reset device</button>
          <p class="hint">Deep sleep cannot re-exec inside WASM — if the device slept, reset it here (or reload).</p>
        </div>

        <div class="panel-section tiny-git-panel">
          <div class="section-heading"><h2><i class="ph ph-git-branch"></i> tiny-git</h2><span id="git-branch">main</span></div>
          <input id="commit-message" type="text" value="Update browser card" aria-label="Commit message" />
          <button class="secondary-button" id="commit-button"><i class="ph ph-git-commit"></i> Commit staged card</button>
          <div class="git-branch-controls">
            <input id="branch-name" type="text" placeholder="new branch" aria-label="New branch name" />
            <button class="secondary-button" id="branch-button"><i class="ph ph-git-branch"></i> New branch</button>
          </div>
          <select id="branch-select" aria-label="Checkout branch"></select>
          <button class="secondary-button" id="checkout-button"><i class="ph ph-git-branch"></i> Checkout branch</button>
          <ol id="git-log" class="git-log" aria-live="polite"></ol>
        </div>
      </aside>

      <main class="device-column">
        <div class="device-frame" style="--device-ratio: ${selectedDevice.bodyHeightMm} / ${selectedDevice.bodyWidthMm}; --screen-inset-top: ${selectedDevice.skin.screen.top}%; --screen-inset-right: ${selectedDevice.skin.screen.right}%; --screen-inset-bottom: ${selectedDevice.skin.screen.bottom}%; --screen-inset-left: ${selectedDevice.skin.screen.left}%" data-device="${selectedDevice.id}" data-screen-width="${selectedDevice.width}" data-screen-height="${selectedDevice.height}">
          <img class="device-skin" src="${selectedDevice.skin.src}" alt="" aria-hidden="true" />
          ${
            selectedDevice.id === "x4"
              ? '<button class="device-edge-key device-edge-key-right-top" type="button" data-scancode="82" aria-label="Up side key"></button><button class="device-edge-key device-edge-key-right-bottom" type="button" data-scancode="81" aria-label="Down side key"></button>'
              : '<button class="device-edge-key device-edge-key-left" type="button" data-scancode="82" aria-label="Up side key"></button><button class="device-edge-key device-edge-key-right" type="button" data-scancode="81" aria-label="Down side key"></button>'
          }
          <div class="device-screen" id="device-mount" aria-label="${selectedDevice.name} display"></div>
        </div>
        <div class="screen-caption"><span>${selectedDevice.name}</span><span>${selectedDevice.width} × ${selectedDevice.height} logical pixels · 1-bit preview</span></div>
        <p class="browser-note">The canvas is fed by the same firmware framebuffer as the native simulator. Rotate the firmware and the browser follows the reported panel orientation.</p>
      </main>
    </section>

    <section class="workbench" aria-label="MicroMarkD browser workbench">
      <div class="workbench-heading"><div><p class="eyebrow">MicroMarkD preview</p><h2>Note tools for a button-first device</h2></div><span class="workbench-key">E edit · G graph · L links</span></div>
      <div class="workbench-grid">
        <article class="vault-card" id="vault-card">
          <div class="vault-toolbar"><span><i class="ph ph-folder-open"></i> /vault</span><button id="new-note-button" title="Create note"><i class="ph ph-file-plus"></i> New</button></div>
          <input id="vault-search" type="search" placeholder="Search notes" aria-label="Search notes" />
          <nav id="vault-notes" class="vault-notes" aria-label="Vault notes"></nav>
        </article>
        <article class="note-card" id="note-card">
          <div class="note-toolbar"><span><i class="ph ph-note"></i> <span id="note-path">/vault/field-notes.md</span></span><div><button data-note-action="edit" title="Edit note"><i class="ph ph-pencil-simple"></i><span data-edit-label>Edit</span></button><button data-note-action="menu" title="Open note menu"><i class="ph ph-list"></i><span>Menu</span></button></div></div>
          <h3 id="note-title">Small devices, durable notes</h3>
          <div class="editor-toolbar" id="editor-toolbar" hidden aria-label="Markdown formatting">
            <button data-format="heading" title="Heading"><i class="ph ph-text-h"></i></button>
            <button data-format="bold" title="Bold"><i class="ph ph-text-b"></i></button>
            <button data-format="italic" title="Italic"><i class="ph ph-text-italic"></i></button>
            <button data-format="check" title="Checklist"><i class="ph ph-check-square"></i></button>
            <button data-format="link" title="Wiki link"><i class="ph ph-link"></i></button>
            <button data-format="code" title="Inline code"><i class="ph ph-code"></i></button>
            <button data-note-action="preview" title="Preview Markdown"><i class="ph ph-eye"></i><span>Preview</span></button>
          </div>
          <p id="note-body"></p>
          <div id="note-preview" class="note-preview" hidden></div>
          <div id="note-tags" class="note-tags" aria-label="Note tags"></div>
          <div id="note-backlinks" class="note-backlinks"></div>
          <span class="note-state" id="note-state" aria-live="polite">Ready</span>
          <div class="note-menu" id="note-menu" hidden><button data-note-action="edit"><i class="ph ph-pencil-simple"></i><span data-edit-label>Edit note</span></button><button data-note-action="graph"><i class="ph ph-graph"></i>Graph view</button><button data-note-action="links"><i class="ph ph-link"></i>Links</button></div>
        </article>
        <article class="graph-card" id="graph-card">
          <div class="graph-toolbar"><span id="graph-title"><i class="ph ph-graph"></i> Link graph</span><div><button data-graph-action="prev" title="Previous graph page">←</button><span id="graph-page">1/2</span><button data-graph-action="next" title="Next graph page">→</button><button data-graph-action="zoom" title="Zoom graph"><i class="ph ph-magnifying-glass-minus"></i></button></div></div>
          <svg viewBox="0 0 800 300" role="img" aria-label="Markdown link graph"><path class="graph-edge" d="M150 90 C250 15 290 15 385 90 S530 170 650 90"/><path class="graph-edge" d="M150 90 C260 160 260 230 385 210 S540 150 650 210"/><g class="graph-node"><rect x="70" y="55" width="160" height="70" rx="10"/><text x="90" y="85">✦</text><text x="118" y="86">field-notes</text><text x="90" y="108">selected</text></g><g class="graph-node"><rect x="305" y="55" width="160" height="70" rx="10"/><text x="325" y="85">◇</text><text x="353" y="86">graph</text><text x="325" y="108">linked note</text></g><g class="graph-node"><rect x="570" y="55" width="160" height="70" rx="10"/><text x="590" y="85">◆</text><text x="618" y="86">tiny-git</text><text x="590" y="108">package</text></g><g class="graph-node"><rect x="305" y="175" width="160" height="70" rx="10"/><text x="325" y="205">□</text><text x="353" y="206">reader</text><text x="325" y="228">next page</text></g></svg>
        </article>
      </div>
    </section>
  </div>
`;

const mount = document.querySelector<HTMLDivElement>("#device-mount");
const status = document.querySelector<HTMLDivElement>("#runtime-status");
const imageInput = document.querySelector<HTMLInputElement>("#image-input");
const uploadStatus = document.querySelector<HTMLParagraphElement>("#upload-status");
const keyboardCaptureButton = document.querySelector<HTMLButtonElement>("#keyboard-capture");
const keyboardCaptureStatus = document.querySelector<HTMLParagraphElement>("#keyboard-capture-status");
const tinyGit = TinyGit.restore(localStorage.getItem("xteink-tiny-git"), [
  {
    path: "/vault/field-notes.md",
    contents:
      "# Small devices, durable notes\n\nMicroMarkD keeps the vault close to the reader. Follow [[graph]] or [[tiny-git]] with the same arrows used by the Xteink.\n\n#reading #xteink\n",
  },
  {
    path: "/vault/graph.md",
    contents: "# Graph view\n\nThe graph is a compact map of [[field-notes]] and [[tiny-git]].\n\n#graph\n",
  },
  {
    path: "/vault/tiny-git.md",
    contents: "# tiny-git\n\nLocal commits keep notes recoverable before a remote sync exists.\n\n#tools\n",
  },
]);

if (!mount || !status || !imageInput || !uploadStatus || !keyboardCaptureButton || !keyboardCaptureStatus)
  throw new Error("Browser emulator controls are missing");

let keyboardCaptureEnabled = false;
const setKeyboardCapture = (enabled: boolean): void => {
  keyboardCaptureEnabled = enabled;
  keyboardCaptureButton.setAttribute("aria-pressed", String(enabled));
  keyboardCaptureButton.classList.toggle("is-active", enabled);
  const state = keyboardCaptureButton.querySelector("strong");
  if (state) state.textContent = enabled ? "On" : "Off";
  keyboardCaptureStatus.textContent = enabled
    ? "On — keyboard events are sent to the emulator."
    : "Device shortcuts only; form fields remain editable.";
};
keyboardCaptureButton.addEventListener("click", () => setKeyboardCapture(!keyboardCaptureEnabled));

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
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLElement && target.isContentEditable);

const renderGitLog = (): void => {
  const branch = document.querySelector<HTMLSpanElement>("#git-branch");
  const log = document.querySelector<HTMLOListElement>("#git-log");
  const branchSelect = document.querySelector<HTMLSelectElement>("#branch-select");
  if (!branch || !log || !branchSelect) return;
  branch.textContent = tinyGit.branch;
  branchSelect.replaceChildren();
  for (const name of tinyGit.branchesList) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    option.selected = name === tinyGit.branch;
    branchSelect.append(option);
  }
  log.replaceChildren();
  for (const commit of tinyGit.log.slice(0, 3)) {
    const item = document.createElement("li");
    const id = document.createElement("code");
    id.textContent = commit.id;
    item.append(id, document.createTextNode(` ${commit.message}`));
    log.append(item);
  }
  if (tinyGit.log.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No commits yet";
    log.append(item);
  }
};

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
    await loadScript(`/emulator/${selectedDevice.id}/crosspoint.js`);
    if (!window.createCrosspoint) throw new Error("WASM factory is missing");
    const module = await window.createCrosspoint({
      locateFile: (file) => `/emulator/${selectedDevice.id}/${file}`,
      print: (line) => console.info(`[firmware] ${line}`),
      printErr: (line) => console.warn(`[firmware] ${line}`),
    });
    startDisplay(module);
  } catch (error) {
    status.dataset.state = "error";
    status.innerHTML = `<i class="ph ph-warning-circle"></i> Build WASM first`;
    mount.innerHTML = `<div class="runtime-error"><i class="ph ph-terminal-window"></i><strong>Browser artifact missing</strong><code>python3 web/wasm/build.py --firmware-root /path/to/microMarkD --environment simulator_x4_pro</code><span>${error instanceof Error ? error.message : String(error)}</span></div>`;
  }
};

const startDisplay = (module: BrowserModule): void => {
  const framePtr = module.cwrap("crosspoint_frame_ptr", "number", []);
  const frameWidth = module.cwrap("crosspoint_frame_width", "number", []);
  const frameHeight = module.cwrap("crosspoint_frame_height", "number", []);
  const frameRotation = module.cwrap("crosspoint_frame_rotation", "number", []);
  const consumeDirty = module.cwrap("crosspoint_consume_dirty", "number", []);
  const touch = module.cwrap("crosspoint_touch", "void", ["number", "number", "number"]);
  const key = module.cwrap("crosspoint_key", "void", ["number", "number"]);
  const setSleepTimeout = module.cwrap("crosspoint_set_sleep_timeout", "void", ["number"]);
  const getSleepTimeout = module.cwrap("crosspoint_get_sleep_timeout", "number", []);
  const output = document.createElement("canvas");
  output.className = "firmware-canvas";
  output.tabIndex = 0;
  mount.replaceChildren(output);

  // Auto-sleep control: re-apply the remembered override (the WASM filesystem
  // is fresh on every page load), then keep the selector in sync with it.
  const sleepSelect = document.querySelector<HTMLSelectElement>("#sleep-select");
  const sleepState = document.querySelector<HTMLSpanElement>("#sleep-state");
  const applySleepTimeout = (minutes: number): void => {
    setSleepTimeout(minutes);
    localStorage.setItem("xteink-sleep-timeout", String(minutes));
    if (sleepState) sleepState.textContent = minutes >= 31 ? "never" : `${minutes} min`;
  };
  if (sleepSelect && sleepState) {
    const remembered = Number(localStorage.getItem("xteink-sleep-timeout"));
    if (Number.isFinite(remembered) && remembered >= 1) applySleepTimeout(Math.floor(remembered));
    else sleepState.textContent = `${getSleepTimeout()} min`;
    sleepSelect.addEventListener("change", () => {
      const minutes = Number(sleepSelect.value);
      if (Number.isFinite(minutes) && minutes >= 1) applySleepTimeout(Math.floor(minutes));
    });
    document.querySelector<HTMLButtonElement>("#reset-device")?.addEventListener("click", () => {
      location.reload();
    });
  }
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
    // The simulator consumes native-window (orientation-space) coordinates —
    // the same space the SDL window uses on desktop. displayX/Y above are
    // already in that space, so no rotation is applied here.
    // Measured on X4 Pro portrait: the firmware's touch path lands points
    // exactly 48px higher than requested (viewable-area origin), so shift
    // down before reporting. ponytail: constant until the panel->logical
    // mapping is fixed at the source.
    const FIRMWARE_TOUCH_Y_OFFSET = 48;
    const displayX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * logicalWidth;
    const displayY =
      Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) * logicalHeight +
      FIRMWARE_TOUCH_Y_OFFSET;
    return [Math.round(displayX), Math.round(displayY)];
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
    if (keyboardCaptureEnabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (scancode === undefined || event.repeat) return;
    } else if (scancode === undefined || isEditableTarget(event.target) || event.repeat) {
      return;
    }
    event.preventDefault();
    setHardwareKeyState(scancode, true);
    key(scancode, 1);
  });
  window.addEventListener("keyup", (event) => {
    const scancode = scancodeForKeyboardEvent(event);
    if (keyboardCaptureEnabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (scancode === undefined || isEditableTarget(event.target)) {
      return;
    }
    if (scancode === undefined) return;
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
  status.innerHTML = `<i class="ph ph-check-circle"></i> Firmware ready`;
  loop();

  imageInput.addEventListener("change", async () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    module.FS.mkdirTree("/fs_/browser-upload");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    module.FS.writeFile(`/fs_/browser-upload/${safeName}`, new Uint8Array(await file.arrayBuffer()));
    uploadStatus.innerHTML = `<i class="ph ph-check"></i> Mounted <code>${safeName}</code> under <code>/fs_/browser-upload/</code>.`;
  });
};

document.querySelector<HTMLSelectElement>("#device-select")?.addEventListener("change", (event) => {
  const device = (event.target as HTMLSelectElement).value;
  location.search = `?device=${encodeURIComponent(device)}`;
});
document
  .querySelector<HTMLButtonElement>("#upload-button")
  ?.addEventListener("click", () => imageInput.click());
const vaultSearch = document.querySelector<HTMLInputElement>("#vault-search");
const vaultNotes = document.querySelector<HTMLElement>("#vault-notes");
const notePath = document.querySelector<HTMLSpanElement>("#note-path");
const noteTags = document.querySelector<HTMLDivElement>("#note-tags");
const noteBacklinks = document.querySelector<HTMLDivElement>("#note-backlinks");
const noteTitle = document.querySelector<HTMLHeadingElement>("#note-title");
const noteBody = document.querySelector<HTMLParagraphElement>("#note-body");
const notePreview = document.querySelector<HTMLDivElement>("#note-preview");
const editorToolbar = document.querySelector<HTMLDivElement>("#editor-toolbar");
const noteState = document.querySelector<HTMLSpanElement>("#note-state");
const editLabels = Array.from(document.querySelectorAll<HTMLSpanElement>("[data-edit-label]"));
let activeNotePath = "/vault/field-notes.md";
let linkedNotes: HTMLButtonElement[] = [];
let selectedLink = -1;
const selectLink = (index: number): void => {
  if (linkedNotes.length === 0) return;
  selectedLink = (index + linkedNotes.length) % linkedNotes.length;
  linkedNotes.forEach((link, linkIndex) => {
    link.classList.toggle("keyboard-selected", linkIndex === selectedLink);
  });
  linkedNotes[selectedLink].focus({ preventScroll: true });
};
const followSelectedLink = (): void => {
  if (selectedLink >= 0) linkedNotes[selectedLink].click();
};

const activeNote = (): TinyFile | undefined =>
  tinyGit.stagedFiles.find((file) => file.path === activeNotePath);
const noteTitleFrom = (contents: string, path: string): string =>
  contents.match(/^#\s+(.+)$/m)?.[1].trim() ?? path.split("/").pop()?.replace(/\.md$/i, "") ?? "Untitled";
const noteBodyFrom = (contents: string): string => contents.replace(/^#\s+.+(?:\r?\n|$)/m, "").trim();
const notePathFor = (target: string): string => {
  const clean = target.trim().replace(/^\/+/, "");
  const withPath = clean.startsWith("vault/") ? `/${clean}` : `/vault/${clean}`;
  return /\.(md|markdown)$/i.test(withPath) ? withPath : `${withPath}.md`;
};
const noteExists = (path: string): boolean => tinyGit.stagedFiles.some((file) => file.path === path);

const appendNoteInline = (target: HTMLElement, source: string): HTMLButtonElement[] => {
  const links: HTMLButtonElement[] = [];
  const inlinePattern = /(\[\[[^\]|]+(?:\|[^\]]+)?\]\])|(\*\*[^*]+\*\*)|(_[^_]+_)|(`[^`]+`)/g;
  let cursor = 0;
  for (const match of source.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    if (index > cursor) target.append(document.createTextNode(source.slice(cursor, index)));
    const token = match[0];
    const wikiLink = token.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
    if (wikiLink) {
      const link = document.createElement("button");
      link.className = "inline-link";
      link.dataset.noteLink = notePathFor(wikiLink[1]);
      link.textContent = wikiLink[2]?.trim() || wikiLink[1].trim();
      link.addEventListener("click", () => openNote(link.dataset.noteLink ?? ""));
      target.append(link);
      links.push(link);
    } else {
      const styled = document.createElement(
        token.startsWith("**") ? "strong" : token.startsWith("_") ? "em" : "code",
      );
      styled.textContent = token.slice(token.startsWith("**") ? 2 : 1, token.startsWith("**") ? -2 : -1);
      target.append(styled);
    }
    cursor = index + match[0].length;
  }
  if (cursor < source.length) target.append(document.createTextNode(source.slice(cursor)));
  target.normalize();
  return links;
};

const renderNoteBody = (contents: string): void => {
  if (!noteBody) return;
  noteBody.replaceChildren();
  linkedNotes = appendNoteInline(noteBody, noteBodyFrom(contents));
  selectedLink = -1;
};

const renderMarkdownPreview = (contents: string): void => {
  if (!notePreview) return;
  notePreview.replaceChildren();
  for (const line of noteBodyFrom(contents).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      notePreview.append(document.createElement("br"));
      continue;
    }
    const heading = trimmed.match(/^#{1,3}\s+(.+)$/);
    const checklist = trimmed.match(/^-\s+\[([ xX])\]\s+(.+)$/);
    const block = document.createElement(heading ? "h4" : "p");
    if (heading) {
      block.textContent = heading[1];
    } else if (checklist) {
      block.append(document.createTextNode(checklist[1].toLowerCase() === "x" ? "☑ " : "☐ "));
      appendNoteInline(block, checklist[2]);
    } else {
      appendNoteInline(block, line);
    }
    notePreview.append(block);
  }
};

const renderTags = (contents: string): void => {
  if (!noteTags) return;
  noteTags.replaceChildren();
  const tags = [...contents.matchAll(/(?:^|\s)#([a-zA-Z0-9_-]+)/g)].map((match) => match[1]);
  for (const tag of [...new Set(tags)]) {
    const button = document.createElement("button");
    button.className = "note-tag";
    button.textContent = `#${tag}`;
    button.addEventListener("click", () => {
      if (vaultSearch) vaultSearch.value = `#${tag}`;
      renderVault();
    });
    noteTags.append(button);
  }
};

const renderBacklinks = (): void => {
  if (!noteBacklinks) return;
  noteBacklinks.replaceChildren();
  const sources = tinyGit.stagedFiles.filter(
    (file) =>
      file.path !== activeNotePath &&
      [...file.contents.matchAll(/\[\[([^\]|]+)/g)].some((match) => notePathFor(match[1]) === activeNotePath),
  );
  if (sources.length === 0) return;
  const label = document.createElement("span");
  label.textContent = "Backlinks";
  noteBacklinks.append(label);
  for (const source of sources) {
    const button = document.createElement("button");
    button.className = "backlink";
    button.textContent = noteTitleFrom(source.contents, source.path);
    button.addEventListener("click", () => openNote(source.path));
    noteBacklinks.append(button);
  }
};

const renderVault = (): void => {
  if (!vaultNotes) return;
  const query = vaultSearch?.value.trim().toLowerCase() ?? "";
  vaultNotes.replaceChildren();
  const files = tinyGit.stagedFiles
    .filter(
      (file) =>
        file.path.startsWith("/vault/") &&
        (!query || `${file.path}\n${file.contents}`.toLowerCase().includes(query)),
    )
    .sort((left, right) => left.path.localeCompare(right.path));
  for (const file of files) {
    const button = document.createElement("button");
    button.className = "vault-note";
    button.classList.toggle("is-active", file.path === activeNotePath);
    button.dataset.notePath = file.path;
    const title = document.createElement("strong");
    const path = document.createElement("small");
    title.textContent = noteTitleFrom(file.contents, file.path);
    path.textContent = file.path.replace("/vault/", "");
    button.append(title, path);
    button.addEventListener("click", () => openNote(file.path));
    vaultNotes.append(button);
  }
  if (files.length === 0) {
    const empty = document.createElement("p");
    empty.className = "vault-empty";
    empty.textContent = "No notes found";
    vaultNotes.append(empty);
  }
};

let noteEditing = false;
let notePreviewing = false;
const renderActiveNote = (): void => {
  const file = activeNote();
  if (!noteTitle || !noteBody) return;
  noteEditing = false;
  notePreviewing = false;
  noteBody.hidden = false;
  if (notePreview) notePreview.hidden = true;
  if (editorToolbar) editorToolbar.hidden = true;
  if (!file) {
    if (notePath) notePath.textContent = activeNotePath;
    noteTitle.textContent = "No note on this branch";
    noteBody.textContent = "Create a note or checkout a branch with committed notes.";
    noteTags?.replaceChildren();
    noteBacklinks?.replaceChildren();
    linkedNotes = [];
    selectedLink = -1;
    if (noteState) noteState.textContent = "Empty branch";
    renderVault();
    return;
  }
  noteTitle.textContent = noteTitleFrom(file.contents, file.path);
  if (notePath) notePath.textContent = file.path;
  noteTitle.removeAttribute("contenteditable");
  noteBody.removeAttribute("contenteditable");
  noteTitle.classList.remove("editing");
  noteBody.classList.remove("editing");
  renderNoteBody(file.contents);
  renderTags(file.contents);
  renderBacklinks();
  if (noteState) noteState.textContent = "Ready";
  renderVault();
};

const saveActiveNote = (): void => {
  if (!noteTitle || !noteBody) return;
  const title = noteTitle.textContent?.trim() || "Untitled";
  const body = noteBody.textContent?.replace(/\r\n/g, "\n").trim() ?? "";
  tinyGit.stage({ path: activeNotePath, contents: `# ${title}\n\n${body}\n` });
  const commit = tinyGit.commit(`Update ${activeNotePath.split("/").pop() ?? "note"}`);
  localStorage.setItem("xteink-tiny-git", tinyGit.snapshot());
  renderGitLog();
  renderActiveNote();
  if (noteState) noteState.textContent = commit ? `Saved in ${commit.id}` : "No changes to save";
};
const setNoteEditing = (editing: boolean): void => {
  const wasEditing = noteEditing;
  if (wasEditing && !editing) saveActiveNote();
  noteEditing = editing;
  notePreviewing = false;
  noteBody?.removeAttribute("hidden");
  if (notePreview) notePreview.hidden = true;
  if (editorToolbar) editorToolbar.hidden = !editing;
  if (editing && noteTitle && noteBody) {
    const file = activeNote();
    noteTitle.textContent = file ? noteTitleFrom(file.contents, file.path) : "Untitled";
    noteBody.textContent = file ? noteBodyFrom(file.contents) : "";
    noteTitle.setAttribute("contenteditable", "true");
    noteBody.setAttribute("contenteditable", "true");
    noteTitle.classList.add("editing");
    noteBody.classList.add("editing");
  }
  editLabels.forEach((label) => {
    label.textContent = editing
      ? label.closest(".note-menu")
        ? "Save note"
        : "Save"
      : label.closest(".note-menu")
        ? "Edit note"
        : "Edit";
  });
  if (noteState && !(wasEditing && !editing)) {
    noteState.textContent = editing ? "Editing — press Save when done" : "Saved in this preview";
  }
  if (editing) noteTitle?.focus();
};

const toggleMarkdownPreview = (): void => {
  if (!noteEditing || !noteBody || !notePreview) return;
  notePreviewing = !notePreviewing;
  noteBody.hidden = notePreviewing;
  notePreview.hidden = !notePreviewing;
  if (notePreviewing) {
    renderMarkdownPreview(
      `# ${noteTitle?.textContent?.trim() || "Untitled"}\n\n${noteBody.textContent ?? ""}`,
    );
    if (noteState) noteState.textContent = "Markdown preview";
  } else {
    noteBody.focus();
    if (noteState) noteState.textContent = "Editing — press Save when done";
  }
};

const markdownTokens: Record<string, string> = {
  heading: "# ",
  bold: "**bold**",
  italic: "_italic_",
  check: "- [ ] ",
  link: "[[note]]",
  code: "`code`",
};
document.querySelectorAll<HTMLButtonElement>("[data-format]").forEach((button) => {
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => {
    if (!noteEditing || !noteBody) return;
    noteBody.focus();
    document.execCommand("insertText", false, markdownTokens[button.dataset.format ?? ""] ?? "");
  });
});

const openNote = (path: string): void => {
  if (!noteExists(path)) {
    if (noteState) noteState.textContent = `Missing note: ${path}`;
    return;
  }
  activeNotePath = path;
  noteEditing = false;
  renderActiveNote();
};

vaultSearch?.addEventListener("input", renderVault);
document.querySelector<HTMLButtonElement>("#new-note-button")?.addEventListener("click", () => {
  const rawTitle = window.prompt("Note title", "Untitled");
  if (!rawTitle) return;
  const filename =
    rawTitle
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9а-яё_-]+/gi, "-")
      .replace(/^-|-$/g, "") || "untitled";
  const path = `/vault/${filename}.md`;
  if (noteExists(path)) {
    if (noteState) noteState.textContent = "A note with this name already exists";
    return;
  }
  tinyGit.stage({ path, contents: `# ${rawTitle.trim()}\n\n` });
  localStorage.setItem("xteink-tiny-git", tinyGit.snapshot());
  openNote(path);
  setNoteEditing(true);
});
document.querySelector<HTMLButtonElement>("#commit-button")?.addEventListener("click", () => {
  if (noteEditing) setNoteEditing(false);
  const message = document.querySelector<HTMLInputElement>("#commit-message")?.value ?? "Update browser card";
  const commit = tinyGit.commit(message);
  localStorage.setItem("xteink-tiny-git", tinyGit.snapshot());
  renderGitLog();
  if (noteState) noteState.textContent = commit ? `Committed ${commit.id}` : "Nothing new to commit";
});
document.querySelector<HTMLButtonElement>("#branch-button")?.addEventListener("click", () => {
  const input = document.querySelector<HTMLInputElement>("#branch-name");
  if (!input || !tinyGit.createBranch(input.value)) {
    if (noteState) noteState.textContent = "Branch name is empty or already exists";
    return;
  }
  const created = input.value.trim();
  input.value = "";
  localStorage.setItem("xteink-tiny-git", tinyGit.snapshot());
  renderGitLog();
  if (noteState) noteState.textContent = `Created branch ${created}`;
});
document.querySelector<HTMLButtonElement>("#checkout-button")?.addEventListener("click", () => {
  const name = document.querySelector<HTMLSelectElement>("#branch-select")?.value;
  if (!name || !tinyGit.checkout(name)) {
    if (noteState) noteState.textContent = "Commit or discard changes before checkout";
    return;
  }
  activeNotePath = tinyGit.stagedFiles[0]?.path ?? "/vault/field-notes.md";
  localStorage.setItem("xteink-tiny-git", tinyGit.snapshot());
  renderGitLog();
  renderActiveNote();
});

document.querySelectorAll<HTMLButtonElement>("[data-note-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.noteAction;
    const menu = document.querySelector<HTMLDivElement>("#note-menu");
    if (action === "menu") {
      menu?.toggleAttribute("hidden");
      return;
    }
    menu?.setAttribute("hidden", "");
    if (action === "edit") {
      setNoteEditing(!noteEditing);
    } else if (action === "preview") {
      toggleMarkdownPreview();
    } else if (action === "graph") {
      document
        .querySelector<HTMLElement>("#graph-card")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (noteState) noteState.textContent = "Graph view";
    } else if (action === "links") {
      selectLink(0);
      noteTitle?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (noteState) noteState.textContent = "Link selected — press Enter to open";
    }
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-graph-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const page = document.querySelector<HTMLSpanElement>("#graph-page");
    const title = document.querySelector<HTMLSpanElement>("#graph-title");
    if (!page) return;
    const [current, total] = (page.textContent ?? "1/2").split("/").map(Number);
    const next =
      button.dataset.graphAction === "next"
        ? (current % total) + 1
        : button.dataset.graphAction === "prev"
          ? ((current - 2 + total) % total) + 1
          : current;
    page.textContent = `${String(next)}/${String(total)}`;
    if (title && button.dataset.graphAction !== "zoom")
      title.innerHTML = `<i class="ph ph-graph"></i> ${next === 1 ? "Link graph" : "Reader neighborhood"}`;
    if (button.dataset.graphAction === "zoom") {
      const svg = document.querySelector<SVGElement>("#graph-card svg");
      const zoomed = svg?.classList.toggle("zoomed") ?? false;
      button.title = zoomed ? "Zoom out graph" : "Zoom graph";
    }
  });
});

window.addEventListener("keydown", (event) => {
  if (keyboardCaptureEnabled) return;
  if (isEditableTarget(event.target) || event.repeat) return;
  const shortcut = event.key.toLowerCase();
  if (shortcut === "e") {
    document.querySelector<HTMLButtonElement>('[data-note-action="edit"]')?.click();
  } else if (shortcut === "g") {
    document
      .querySelector<HTMLElement>("#graph-card")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  } else if (shortcut === "l") {
    selectLink(selectedLink < 0 ? 0 : selectedLink);
  } else if (selectedLink >= 0 && ["ArrowLeft", "ArrowUp"].includes(event.key)) {
    selectLink(selectedLink - 1);
  } else if (selectedLink >= 0 && ["ArrowRight", "ArrowDown"].includes(event.key)) {
    selectLink(selectedLink + 1);
  } else if (selectedLink >= 0 && event.key === "Enter") {
    followSelectedLink();
  } else {
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
});

renderGitLog();
renderActiveNote();
void paintRuntime();
