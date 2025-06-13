"use strict";
(() => {
  // node_modules/zotero-plugin-toolkit/dist/utils/debugBridge.js
  var DebugBridge = class _DebugBridge {
    static version = 2;
    static passwordPref = "extensions.zotero.debug-bridge.password";
    get version() {
      return _DebugBridge.version;
    }
    _disableDebugBridgePassword;
    get disableDebugBridgePassword() {
      return this._disableDebugBridgePassword;
    }
    set disableDebugBridgePassword(value) {
      this._disableDebugBridgePassword = value;
    }
    get password() {
      return BasicTool.getZotero().Prefs.get(_DebugBridge.passwordPref, true);
    }
    set password(v) {
      BasicTool.getZotero().Prefs.set(_DebugBridge.passwordPref, v, true);
    }
    constructor() {
      this._disableDebugBridgePassword = false;
      this.initializeDebugBridge();
    }
    static setModule(instance) {
      if (!instance.debugBridge?.version || instance.debugBridge.version < _DebugBridge.version) {
        instance.debugBridge = new _DebugBridge();
      }
    }
    initializeDebugBridge() {
      const debugBridgeExtension = {
        noContent: true,
        doAction: async (uri) => {
          const Zotero2 = BasicTool.getZotero();
          const window2 = Zotero2.getMainWindow();
          const uriString = uri.spec.split("//").pop();
          if (!uriString) {
            return;
          }
          const params = {};
          uriString.split("?").pop()?.split("&").forEach((p) => {
            params[p.split("=")[0]] = decodeURIComponent(p.split("=")[1]);
          });
          const skipPasswordCheck = toolkitGlobal_default.getInstance()?.debugBridge.disableDebugBridgePassword;
          let allowed = false;
          if (skipPasswordCheck) {
            allowed = true;
          } else {
            if (typeof params.password === "undefined" && typeof this.password === "undefined") {
              allowed = window2.confirm(`External App ${params.app} wants to execute command without password.
Command:
${(params.run || params.file || "").slice(0, 100)}
If you do not know what it is, please click Cancel to deny.`);
            } else {
              allowed = this.password === params.password;
            }
          }
          if (allowed) {
            if (params.run) {
              try {
                const AsyncFunction = Object.getPrototypeOf(async () => {
                }).constructor;
                const f = new AsyncFunction("Zotero,window", params.run);
                await f(Zotero2, window2);
              } catch (e) {
                Zotero2.debug(e);
                window2.console.log(e);
              }
            }
            if (params.file) {
              try {
                Services.scriptloader.loadSubScript(params.file, {
                  Zotero: Zotero2,
                  window: window2
                });
              } catch (e) {
                Zotero2.debug(e);
                window2.console.log(e);
              }
            }
          }
        },
        newChannel(uri) {
          this.doAction(uri);
        }
      };
      Services.io.getProtocolHandler("zotero").wrappedJSObject._extensions["zotero://ztoolkit-debug"] = debugBridgeExtension;
    }
  };

  // node_modules/zotero-plugin-toolkit/dist/utils/pluginBridge.js
  var PluginBridge = class _PluginBridge {
    static version = 1;
    get version() {
      return _PluginBridge.version;
    }
    constructor() {
      this.initializePluginBridge();
    }
    static setModule(instance) {
      if (!instance.pluginBridge?.version || instance.pluginBridge.version < _PluginBridge.version) {
        instance.pluginBridge = new _PluginBridge();
      }
    }
    initializePluginBridge() {
      const { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
      const Zotero2 = BasicTool.getZotero();
      const pluginBridgeExtension = {
        noContent: true,
        doAction: async (uri) => {
          try {
            const uriString = uri.spec.split("//").pop();
            if (!uriString) {
              return;
            }
            const params = {};
            uriString.split("?").pop()?.split("&").forEach((p) => {
              params[p.split("=")[0]] = decodeURIComponent(p.split("=")[1]);
            });
            if (params.action === "install" && params.url) {
              if (params.minVersion && Services.vc.compare(Zotero2.version, params.minVersion) < 0 || params.maxVersion && Services.vc.compare(Zotero2.version, params.maxVersion) > 0) {
                throw new Error(`Plugin is not compatible with Zotero version ${Zotero2.version}.The plugin requires Zotero version between ${params.minVersion} and ${params.maxVersion}.`);
              }
              const addon2 = await AddonManager.getInstallForURL(params.url);
              if (addon2 && addon2.state === AddonManager.STATE_AVAILABLE) {
                addon2.install();
                hint("Plugin installed successfully.", true);
              } else {
                throw new Error(`Plugin ${params.url} is not available.`);
              }
            }
          } catch (e) {
            Zotero2.logError(e);
            hint(e.message, false);
          }
        },
        newChannel(uri) {
          this.doAction(uri);
        }
      };
      Services.io.getProtocolHandler("zotero").wrappedJSObject._extensions["zotero://plugin"] = pluginBridgeExtension;
    }
  };
  function hint(content, success) {
    const progressWindow = new Zotero.ProgressWindow({ closeOnClick: true });
    progressWindow.changeHeadline("Plugin Toolkit");
    progressWindow.progress = new progressWindow.ItemProgress(success ? "chrome://zotero/skin/tick.png" : "chrome://zotero/skin/cross.png", content);
    progressWindow.progress.setProgress(100);
    progressWindow.show();
    progressWindow.startCloseTimer(5e3);
  }

  // node_modules/zotero-plugin-toolkit/dist/managers/toolkitGlobal.js
  var ToolkitGlobal = class _ToolkitGlobal {
    debugBridge;
    pluginBridge;
    prompt;
    currentWindow;
    constructor() {
      initializeModules(this);
      this.currentWindow = BasicTool.getZotero().getMainWindow();
    }
    /**
     * Get the global unique instance of `class ToolkitGlobal`.
     * @returns An instance of `ToolkitGlobal`.
     */
    static getInstance() {
      let _Zotero;
      try {
        if (typeof Zotero !== "undefined") {
          _Zotero = Zotero;
        } else {
          _Zotero = BasicTool.getZotero();
        }
      } catch {
      }
      if (!_Zotero) {
        return void 0;
      }
      let requireInit = false;
      if (!("_toolkitGlobal" in _Zotero)) {
        _Zotero._toolkitGlobal = new _ToolkitGlobal();
        requireInit = true;
      }
      const currentGlobal = _Zotero._toolkitGlobal;
      if (currentGlobal.currentWindow !== _Zotero.getMainWindow()) {
        checkWindowDependentModules(currentGlobal);
        requireInit = true;
      }
      if (requireInit) {
        initializeModules(currentGlobal);
      }
      return currentGlobal;
    }
  };
  function initializeModules(instance) {
    setModule(instance, "prompt", {
      _ready: false,
      instance: void 0
    });
    DebugBridge.setModule(instance);
    PluginBridge.setModule(instance);
  }
  function setModule(instance, key, module) {
    if (!module) {
      return;
    }
    if (!instance[key]) {
      instance[key] = module;
    }
    for (const moduleKey in module) {
      instance[key][moduleKey] ??= module[moduleKey];
    }
  }
  function checkWindowDependentModules(instance) {
    instance.currentWindow = BasicTool.getZotero().getMainWindow();
    instance.prompt = void 0;
  }
  var toolkitGlobal_default = ToolkitGlobal;

  // node_modules/zotero-plugin-toolkit/dist/basic.js
  var BasicTool = class _BasicTool {
    /**
     * configurations.
     */
    _basicOptions;
    _console;
    /**
     * @deprecated Use `patcherManager` instead.
     */
    patchSign = "zotero-plugin-toolkit@3.0.0";
    get basicOptions() {
      return this._basicOptions;
    }
    /**
     *
     * @param data Pass an BasicTool instance to copy its options.
     */
    constructor(data) {
      this._basicOptions = {
        log: {
          _type: "toolkitlog",
          disableConsole: false,
          disableZLog: false,
          prefix: ""
        },
        debug: toolkitGlobal_default.getInstance()?.debugBridge || {
          disableDebugBridgePassword: false,
          password: ""
        },
        api: {
          pluginID: "zotero-plugin-toolkit@windingwind.com"
        },
        listeners: {
          callbacks: {
            onMainWindowLoad: /* @__PURE__ */ new Set(),
            onMainWindowUnload: /* @__PURE__ */ new Set(),
            onPluginUnload: /* @__PURE__ */ new Set()
          },
          _mainWindow: void 0,
          _plugin: void 0
        }
      };
      if (typeof globalThis.ChromeUtils?.import !== "undefined") {
        const { ConsoleAPI } = ChromeUtils.import("resource://gre/modules/Console.jsm");
        this._console = new ConsoleAPI({
          consoleID: `${this._basicOptions.api.pluginID}-${Date.now()}`
        });
      }
      this.updateOptions(data);
    }
    getGlobal(k) {
      if (typeof globalThis[k] !== "undefined") {
        return globalThis[k];
      }
      const _Zotero = _BasicTool.getZotero();
      try {
        const window2 = _Zotero.getMainWindow();
        switch (k) {
          case "Zotero":
          case "zotero":
            return _Zotero;
          case "window":
            return window2;
          case "windows":
            return _Zotero.getMainWindows();
          case "document":
            return window2.document;
          case "ZoteroPane":
          case "ZoteroPane_Local":
            return _Zotero.getActiveZoteroPane();
          default:
            return window2[k];
        }
      } catch (e) {
        Zotero.logError(e);
      }
    }
    /**
     * If it's an XUL element
     * @param elem
     */
    isXULElement(elem) {
      return elem.namespaceURI === "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    }
    /**
     * Create an XUL element
     *
     * For Zotero 6, use `createElementNS`;
     *
     * For Zotero 7+, use `createXULElement`.
     * @param doc
     * @param type
     * @example
     * Create a `<menuitem>`:
     * ```ts
     * const compat = new ZoteroCompat();
     * const doc = compat.getWindow().document;
     * const elem = compat.createXULElement(doc, "menuitem");
     * ```
     */
    createXULElement(doc, type) {
      return doc.createXULElement(type);
    }
    /**
     * Output to both Zotero.debug and console.log
     * @param data e.g. string, number, object, ...
     */
    log(...data) {
      if (data.length === 0) {
        return;
      }
      let _Zotero;
      try {
        if (typeof Zotero !== "undefined") {
          _Zotero = Zotero;
        } else {
          _Zotero = _BasicTool.getZotero();
        }
      } catch {
      }
      let options;
      if (data[data.length - 1]?._type === "toolkitlog") {
        options = data.pop();
      } else {
        options = this._basicOptions.log;
      }
      try {
        if (options.prefix) {
          data.splice(0, 0, options.prefix);
        }
        if (!options.disableConsole) {
          let _console;
          if (typeof console !== "undefined") {
            _console = console;
          } else if (_Zotero) {
            _console = _Zotero.getMainWindow()?.console;
          }
          if (!_console) {
            if (!this._console) {
              return;
            }
            _console = this._console;
          }
          if (_console.groupCollapsed) {
            _console.groupCollapsed(...data);
          } else {
            _console.group(...data);
          }
          _console.trace();
          _console.groupEnd();
        }
        if (!options.disableZLog) {
          if (typeof _Zotero === "undefined") {
            return;
          }
          _Zotero.debug(data.map((d) => {
            try {
              return typeof d === "object" ? JSON.stringify(d) : String(d);
            } catch {
              _Zotero.debug(d);
              return "";
            }
          }).join("\n"));
        }
      } catch (e) {
        if (_Zotero)
          Zotero.logError(e);
        else {
          console.error(e);
        }
      }
    }
    /**
     * Patch a function
     * @deprecated Use {@link PatchHelper} instead.
     * @param object The owner of the function
     * @param funcSign The signature of the function(function name)
     * @param ownerSign The signature of patch owner to avoid patching again
     * @param patcher The new wrapper of the patched function
     */
    patch(object, funcSign, ownerSign, patcher) {
      if (object[funcSign][ownerSign]) {
        throw new Error(`${String(funcSign)} re-patched`);
      }
      this.log("patching", funcSign, `by ${ownerSign}`);
      object[funcSign] = patcher(object[funcSign]);
      object[funcSign][ownerSign] = true;
    }
    /**
     * Add a Zotero event listener callback
     * @param type Event type
     * @param callback Event callback
     */
    addListenerCallback(type, callback) {
      if (["onMainWindowLoad", "onMainWindowUnload"].includes(type)) {
        this._ensureMainWindowListener();
      }
      if (type === "onPluginUnload") {
        this._ensurePluginListener();
      }
      this._basicOptions.listeners.callbacks[type].add(callback);
    }
    /**
     * Remove a Zotero event listener callback
     * @param type Event type
     * @param callback Event callback
     */
    removeListenerCallback(type, callback) {
      this._basicOptions.listeners.callbacks[type].delete(callback);
      this._ensureRemoveListener();
    }
    /**
     * Remove all Zotero event listener callbacks when the last callback is removed.
     */
    _ensureRemoveListener() {
      const { listeners } = this._basicOptions;
      if (listeners._mainWindow && listeners.callbacks.onMainWindowLoad.size === 0 && listeners.callbacks.onMainWindowUnload.size === 0) {
        Services.wm.removeListener(listeners._mainWindow);
        delete listeners._mainWindow;
      }
      if (listeners._plugin && listeners.callbacks.onPluginUnload.size === 0) {
        Zotero.Plugins.removeObserver(listeners._plugin);
        delete listeners._plugin;
      }
    }
    /**
     * Ensure the main window listener is registered.
     */
    _ensureMainWindowListener() {
      if (this._basicOptions.listeners._mainWindow) {
        return;
      }
      const mainWindowListener = {
        onOpenWindow: (xulWindow) => {
          const domWindow = xulWindow.docShell.domWindow;
          const onload = async () => {
            domWindow.removeEventListener("load", onload, false);
            if (domWindow.location.href !== "chrome://zotero/content/zoteroPane.xhtml") {
              return;
            }
            for (const cbk of this._basicOptions.listeners.callbacks.onMainWindowLoad) {
              try {
                cbk(domWindow);
              } catch (e) {
                this.log(e);
              }
            }
          };
          domWindow.addEventListener("load", () => onload(), false);
        },
        onCloseWindow: async (xulWindow) => {
          const domWindow = xulWindow.docShell.domWindow;
          if (domWindow.location.href !== "chrome://zotero/content/zoteroPane.xhtml") {
            return;
          }
          for (const cbk of this._basicOptions.listeners.callbacks.onMainWindowUnload) {
            try {
              cbk(domWindow);
            } catch (e) {
              this.log(e);
            }
          }
        }
      };
      this._basicOptions.listeners._mainWindow = mainWindowListener;
      Services.wm.addListener(mainWindowListener);
    }
    /**
     * Ensure the plugin listener is registered.
     */
    _ensurePluginListener() {
      if (this._basicOptions.listeners._plugin) {
        return;
      }
      const pluginListener = {
        shutdown: (...args) => {
          for (const cbk of this._basicOptions.listeners.callbacks.onPluginUnload) {
            try {
              cbk(...args);
            } catch (e) {
              this.log(e);
            }
          }
        }
      };
      this._basicOptions.listeners._plugin = pluginListener;
      Zotero.Plugins.addObserver(pluginListener);
    }
    updateOptions(source) {
      if (!source) {
        return this;
      }
      if (source instanceof _BasicTool) {
        this._basicOptions = source._basicOptions;
      } else {
        this._basicOptions = source;
      }
      return this;
    }
    static getZotero() {
      if (typeof Zotero !== "undefined") {
        return Zotero;
      }
      const { Zotero: _Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");
      return _Zotero;
    }
  };
  var ManagerTool = class extends BasicTool {
    _ensureAutoUnregisterAll() {
      this.addListenerCallback("onPluginUnload", (params, _reason) => {
        if (params.id !== this.basicOptions.api.pluginID) {
          return;
        }
        this.unregisterAll();
      });
    }
  };
  function unregister(tools) {
    Object.values(tools).forEach((tool) => {
      if (tool instanceof ManagerTool || typeof tool?.unregisterAll === "function") {
        tool.unregisterAll();
      }
    });
  }
  function makeHelperTool(cls, options) {
    return new Proxy(cls, {
      construct(target, args) {
        const _origin = new cls(...args);
        if (_origin instanceof BasicTool) {
          _origin.updateOptions(options);
        }
        return _origin;
      }
    });
  }

  // node_modules/zotero-plugin-toolkit/dist/tools/ui.js
  var UITool = class extends BasicTool {
    get basicOptions() {
      return this._basicOptions;
    }
    /**
     * Store elements created with this instance
     *
     * @remarks
     * > What is this for?
     *
     * In bootstrap plugins, elements must be manually maintained and removed on exiting.
     *
     * This API does this for you.
     */
    elementCache;
    constructor(base) {
      super(base);
      this.elementCache = [];
      if (!this._basicOptions.ui) {
        this._basicOptions.ui = {
          enableElementRecord: true,
          enableElementJSONLog: false,
          enableElementDOMLog: true
        };
      }
    }
    /**
     * Remove all elements created by `createElement`.
     *
     * @remarks
     * > What is this for?
     *
     * In bootstrap plugins, elements must be manually maintained and removed on exiting.
     *
     * This API does this for you.
     */
    unregisterAll() {
      this.elementCache.forEach((e) => {
        try {
          e?.deref()?.remove();
        } catch (e2) {
          this.log(e2);
        }
      });
    }
    createElement(...args) {
      const doc = args[0];
      const tagName = args[1].toLowerCase();
      let props = args[2] || {};
      if (!tagName) {
        return;
      }
      if (typeof args[2] === "string") {
        props = {
          namespace: args[2],
          enableElementRecord: args[3]
        };
      }
      if (typeof props.enableElementJSONLog !== "undefined" && props.enableElementJSONLog || this.basicOptions.ui.enableElementJSONLog) {
        this.log(props);
      }
      props.properties = props.properties || props.directAttributes;
      props.children = props.children || props.subElementOptions;
      let elem;
      if (tagName === "fragment") {
        const fragElem = doc.createDocumentFragment();
        elem = fragElem;
      } else {
        let realElem = props.id && (props.checkExistenceParent ? props.checkExistenceParent : doc).querySelector(`#${props.id}`);
        if (realElem && props.ignoreIfExists) {
          return realElem;
        }
        if (realElem && props.removeIfExists) {
          realElem.remove();
          realElem = void 0;
        }
        if (props.customCheck && !props.customCheck(doc, props)) {
          return void 0;
        }
        if (!realElem || !props.skipIfExists) {
          let namespace = props.namespace;
          if (!namespace) {
            const mightHTML = HTMLElementTagNames.includes(tagName);
            const mightXUL = XULElementTagNames.includes(tagName);
            const mightSVG = SVGElementTagNames.includes(tagName);
            if (Number(mightHTML) + Number(mightXUL) + Number(mightSVG) > 1) {
              this.log(`[Warning] Creating element ${tagName} with no namespace specified. Found multiply namespace matches.`);
            }
            if (mightHTML) {
              namespace = "html";
            } else if (mightXUL) {
              namespace = "xul";
            } else if (mightSVG) {
              namespace = "svg";
            } else {
              namespace = "html";
            }
          }
          if (namespace === "xul") {
            realElem = this.createXULElement(doc, tagName);
          } else {
            realElem = doc.createElementNS({
              html: "http://www.w3.org/1999/xhtml",
              svg: "http://www.w3.org/2000/svg"
            }[namespace], tagName);
          }
          if (typeof props.enableElementRecord !== "undefined" ? props.enableElementRecord : this.basicOptions.ui.enableElementRecord) {
            this.elementCache.push(new WeakRef(realElem));
          }
        }
        if (props.id) {
          realElem.id = props.id;
        }
        if (props.styles && Object.keys(props.styles).length) {
          Object.keys(props.styles).forEach((k) => {
            const v = props.styles[k];
            typeof v !== "undefined" && (realElem.style[k] = v);
          });
        }
        if (props.properties && Object.keys(props.properties).length) {
          Object.keys(props.properties).forEach((k) => {
            const v = props.properties[k];
            typeof v !== "undefined" && (realElem[k] = v);
          });
        }
        if (props.attributes && Object.keys(props.attributes).length) {
          Object.keys(props.attributes).forEach((k) => {
            const v = props.attributes[k];
            typeof v !== "undefined" && realElem.setAttribute(k, String(v));
          });
        }
        if (props.classList?.length) {
          realElem.classList.add(...props.classList);
        }
        if (props.listeners?.length) {
          props.listeners.forEach(({ type, listener, options }) => {
            listener && realElem.addEventListener(type, listener, options);
          });
        }
        elem = realElem;
      }
      if (props.children?.length) {
        const subElements = props.children.map((childProps) => {
          childProps.namespace = childProps.namespace || props.namespace;
          return this.createElement(doc, childProps.tag, childProps);
        }).filter((e) => e);
        elem.append(...subElements);
      }
      if (typeof props.enableElementDOMLog !== "undefined" ? props.enableElementDOMLog : this.basicOptions.ui.enableElementDOMLog) {
        this.log(elem);
      }
      return elem;
    }
    /**
     * Append element(s) to a node.
     * @param properties See {@link ElementProps}
     * @param container The parent node to append to.
     * @returns A Node that is the appended child (aChild),
     *          except when aChild is a DocumentFragment,
     *          in which case the empty DocumentFragment is returned.
     */
    appendElement(properties, container) {
      return container.appendChild(this.createElement(container.ownerDocument, properties.tag, properties));
    }
    /**
     * Inserts a node before a reference node as a child of its parent node.
     * @param properties See {@link ElementProps}
     * @param referenceNode The node before which newNode is inserted.
     * @returns Node
     */
    insertElementBefore(properties, referenceNode) {
      if (referenceNode.parentNode)
        return referenceNode.parentNode.insertBefore(this.createElement(referenceNode.ownerDocument, properties.tag, properties), referenceNode);
      else
        this.log(`${referenceNode.tagName} has no parent, cannot insert ${properties.tag}`);
    }
    /**
     * Replace oldNode with a new one.
     * @param properties See {@link ElementProps}
     * @param oldNode The child to be replaced.
     * @returns The replaced Node. This is the same node as oldChild.
     */
    replaceElement(properties, oldNode) {
      if (oldNode.parentNode)
        return oldNode.parentNode.replaceChild(this.createElement(oldNode.ownerDocument, properties.tag, properties), oldNode);
      else
        this.log(`${oldNode.tagName} has no parent, cannot replace it with ${properties.tag}`);
    }
    /**
     * Parse XHTML to XUL fragment. For Zotero 6.
     *
     * To load preferences from a Zotero 7's `.xhtml`, use this method to parse it.
     * @param str xhtml raw text
     * @param entities dtd file list ("chrome://xxx.dtd")
     * @param defaultXUL true for default XUL namespace
     */
    parseXHTMLToFragment(str, entities = [], defaultXUL = true) {
      const parser = new DOMParser();
      const xulns = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
      const htmlns = "http://www.w3.org/1999/xhtml";
      const wrappedStr = `${entities.length ? `<!DOCTYPE bindings [ ${entities.reduce((preamble, url, index) => {
        return `${preamble}<!ENTITY % _dtd-${index} SYSTEM "${url}"> %_dtd-${index}; `;
      }, "")}]>` : ""}
      <html:div xmlns="${defaultXUL ? xulns : htmlns}"
          xmlns:xul="${xulns}" xmlns:html="${htmlns}">
      ${str}
      </html:div>`;
      this.log(wrappedStr, parser);
      const doc = parser.parseFromString(wrappedStr, "text/xml");
      this.log(doc);
      if (doc.documentElement.localName === "parsererror") {
        throw new Error("not well-formed XHTML");
      }
      const range = doc.createRange();
      range.selectNodeContents(doc.querySelector("div"));
      return range.extractContents();
    }
  };
  var HTMLElementTagNames = [
    "a",
    "abbr",
    "address",
    "area",
    "article",
    "aside",
    "audio",
    "b",
    "base",
    "bdi",
    "bdo",
    "blockquote",
    "body",
    "br",
    "button",
    "canvas",
    "caption",
    "cite",
    "code",
    "col",
    "colgroup",
    "data",
    "datalist",
    "dd",
    "del",
    "details",
    "dfn",
    "dialog",
    "div",
    "dl",
    "dt",
    "em",
    "embed",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "head",
    "header",
    "hgroup",
    "hr",
    "html",
    "i",
    "iframe",
    "img",
    "input",
    "ins",
    "kbd",
    "label",
    "legend",
    "li",
    "link",
    "main",
    "map",
    "mark",
    "menu",
    "meta",
    "meter",
    "nav",
    "noscript",
    "object",
    "ol",
    "optgroup",
    "option",
    "output",
    "p",
    "picture",
    "pre",
    "progress",
    "q",
    "rp",
    "rt",
    "ruby",
    "s",
    "samp",
    "script",
    "section",
    "select",
    "slot",
    "small",
    "source",
    "span",
    "strong",
    "style",
    "sub",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "template",
    "textarea",
    "tfoot",
    "th",
    "thead",
    "time",
    "title",
    "tr",
    "track",
    "u",
    "ul",
    "var",
    "video",
    "wbr"
  ];
  var XULElementTagNames = [
    "action",
    "arrowscrollbox",
    "bbox",
    "binding",
    "bindings",
    "box",
    "broadcaster",
    "broadcasterset",
    "button",
    "browser",
    "checkbox",
    "caption",
    "colorpicker",
    "column",
    "columns",
    "commandset",
    "command",
    "conditions",
    "content",
    "deck",
    "description",
    "dialog",
    "dialogheader",
    "editor",
    "grid",
    "grippy",
    "groupbox",
    "hbox",
    "iframe",
    "image",
    "key",
    "keyset",
    "label",
    "listbox",
    "listcell",
    "listcol",
    "listcols",
    "listhead",
    "listheader",
    "listitem",
    "member",
    "menu",
    "menubar",
    "menuitem",
    "menulist",
    "menupopup",
    "menuseparator",
    "observes",
    "overlay",
    "page",
    "popup",
    "popupset",
    "preference",
    "preferences",
    "prefpane",
    "prefwindow",
    "progressmeter",
    "radio",
    "radiogroup",
    "resizer",
    "richlistbox",
    "richlistitem",
    "row",
    "rows",
    "rule",
    "script",
    "scrollbar",
    "scrollbox",
    "scrollcorner",
    "separator",
    "spacer",
    "splitter",
    "stack",
    "statusbar",
    "statusbarpanel",
    "stringbundle",
    "stringbundleset",
    "tab",
    "tabbrowser",
    "tabbox",
    "tabpanel",
    "tabpanels",
    "tabs",
    "template",
    "textnode",
    "textbox",
    "titlebar",
    "toolbar",
    "toolbarbutton",
    "toolbargrippy",
    "toolbaritem",
    "toolbarpalette",
    "toolbarseparator",
    "toolbarset",
    "toolbarspacer",
    "toolbarspring",
    "toolbox",
    "tooltip",
    "tree",
    "treecell",
    "treechildren",
    "treecol",
    "treecols",
    "treeitem",
    "treerow",
    "treeseparator",
    "triple",
    "vbox",
    "window",
    "wizard",
    "wizardpage"
  ];
  var SVGElementTagNames = [
    "a",
    "animate",
    "animateMotion",
    "animateTransform",
    "circle",
    "clipPath",
    "defs",
    "desc",
    "ellipse",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feDropShadow",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
    "filter",
    "foreignObject",
    "g",
    "image",
    "line",
    "linearGradient",
    "marker",
    "mask",
    "metadata",
    "mpath",
    "path",
    "pattern",
    "polygon",
    "polyline",
    "radialGradient",
    "rect",
    "script",
    "set",
    "stop",
    "style",
    "svg",
    "switch",
    "symbol",
    "text",
    "textPath",
    "title",
    "tspan",
    "use",
    "view"
  ];

  // node_modules/zotero-plugin-toolkit/dist/helpers/dialog.js
  var DialogHelper = class extends UITool {
    /**
     * Passed to dialog window for data-binding and lifecycle controls. See {@link DialogHelper.setDialogData}
     */
    dialogData;
    /**
     * Dialog window instance
     */
    window;
    elementProps;
    /**
     * Create a dialog helper with row \* column grids.
     * @param row
     * @param column
     */
    constructor(row, column) {
      super();
      if (row <= 0 || column <= 0) {
        throw new Error(`row and column must be positive integers.`);
      }
      this.elementProps = {
        tag: "vbox",
        attributes: { flex: 1 },
        styles: {
          width: "100%",
          height: "100%"
        },
        children: []
      };
      for (let i = 0; i < Math.max(row, 1); i++) {
        this.elementProps.children.push({
          tag: "hbox",
          attributes: { flex: 1 },
          children: []
        });
        for (let j = 0; j < Math.max(column, 1); j++) {
          this.elementProps.children[i].children.push({
            tag: "vbox",
            attributes: { flex: 1 },
            children: []
          });
        }
      }
      this.elementProps.children.push({
        tag: "hbox",
        attributes: { flex: 0, pack: "end" },
        children: []
      });
      this.dialogData = {};
    }
    /**
     * Add a cell at (row, column). Index starts from 0.
     * @param row
     * @param column
     * @param elementProps Cell element props. See {@link ElementProps}
     * @param cellFlex If the cell is flex. Default true.
     */
    addCell(row, column, elementProps, cellFlex = true) {
      if (row >= this.elementProps.children.length || column >= this.elementProps.children[row].children.length) {
        throw new Error(`Cell index (${row}, ${column}) is invalid, maximum (${this.elementProps.children.length}, ${this.elementProps.children[0].children.length})`);
      }
      this.elementProps.children[row].children[column].children = [
        elementProps
      ];
      this.elementProps.children[row].children[column].attributes.flex = cellFlex ? 1 : 0;
      return this;
    }
    /**
     * Add a control button to the bottom of the dialog.
     * @param label Button label
     * @param id Button id.
     * The corresponding id of the last button user clicks before window exit will be set to `dialogData._lastButtonId`.
     * @param options Options
     * @param [options.noClose] Don't close window when clicking this button.
     * @param [options.callback] Callback of button click event.
     */
    addButton(label, id, options = {}) {
      id = id || `${Zotero.Utilities.randomString()}-${(/* @__PURE__ */ new Date()).getTime()}`;
      this.elementProps.children[this.elementProps.children.length - 1].children.push({
        tag: "vbox",
        styles: {
          margin: "10px"
        },
        children: [
          {
            tag: "button",
            namespace: "html",
            id,
            attributes: {
              type: "button",
              "data-l10n-id": label
            },
            properties: {
              innerHTML: label
            },
            listeners: [
              {
                type: "click",
                listener: (e) => {
                  this.dialogData._lastButtonId = id;
                  if (options.callback) {
                    options.callback(e);
                  }
                  if (!options.noClose) {
                    this.window.close();
                  }
                }
              }
            ]
          }
        ]
      });
      return this;
    }
    /**
     * Dialog data.
     * @remarks
     * This object is passed to the dialog window.
     *
     * The control button id is in `dialogData._lastButtonId`;
     *
     * The data-binding values are in `dialogData`.
     * ```ts
     * interface DialogData {
     *   [key: string | number | symbol]: any;
     *   loadLock?: _ZoteroTypes.PromiseObject; // resolve after window load (auto-generated)
     *   loadCallback?: Function; // called after window load
     *   unloadLock?: _ZoteroTypes.PromiseObject; // resolve after window unload (auto-generated)
     *   unloadCallback?: Function; // called after window unload
     *   beforeUnloadCallback?: Function; // called before window unload when elements are accessable.
     * }
     * ```
     * @param dialogData
     */
    setDialogData(dialogData) {
      this.dialogData = dialogData;
      return this;
    }
    /**
     * Open the dialog
     * @param title Window title
     * @param windowFeatures
     * @param windowFeatures.width Ignored if fitContent is `true`.
     * @param windowFeatures.height Ignored if fitContent is `true`.
     * @param windowFeatures.left
     * @param windowFeatures.top
     * @param windowFeatures.centerscreen Open window at the center of screen.
     * @param windowFeatures.resizable If window is resizable.
     * @param windowFeatures.fitContent Resize the window to content size after elements are loaded.
     * @param windowFeatures.noDialogMode Dialog mode window only has a close button. Set `true` to make maximize and minimize button visible.
     * @param windowFeatures.alwaysRaised Is the window always at the top.
     */
    open(title, windowFeatures = {
      centerscreen: true,
      resizable: true,
      fitContent: true
    }) {
      this.window = openDialog(this, `${Zotero.Utilities.randomString()}-${(/* @__PURE__ */ new Date()).getTime()}`, title, this.elementProps, this.dialogData, windowFeatures);
      return this;
    }
  };
  function openDialog(dialogHelper, targetId, title, elementProps, dialogData, windowFeatures = {
    centerscreen: true,
    resizable: true,
    fitContent: true
  }) {
    const Zotero2 = dialogHelper.getGlobal("Zotero");
    dialogData = dialogData || {};
    if (!dialogData.loadLock) {
      dialogData.loadLock = Zotero2.Promise.defer();
    }
    if (!dialogData.unloadLock) {
      dialogData.unloadLock = Zotero2.Promise.defer();
    }
    let featureString = `resizable=${windowFeatures.resizable ? "yes" : "no"},`;
    if (windowFeatures.width || windowFeatures.height) {
      featureString += `width=${windowFeatures.width || 100},height=${windowFeatures.height || 100},`;
    }
    if (windowFeatures.left) {
      featureString += `left=${windowFeatures.left},`;
    }
    if (windowFeatures.top) {
      featureString += `top=${windowFeatures.top},`;
    }
    if (windowFeatures.centerscreen) {
      featureString += "centerscreen,";
    }
    if (windowFeatures.noDialogMode) {
      featureString += "dialog=no,";
    }
    if (windowFeatures.alwaysRaised) {
      featureString += "alwaysRaised=yes,";
    }
    const win = dialogHelper.getGlobal("openDialog")("about:blank", targetId || "_blank", featureString, dialogData);
    dialogData.loadLock?.promise.then(() => {
      win.document.head.appendChild(dialogHelper.createElement(win.document, "title", {
        properties: { innerText: title },
        attributes: { "data-l10n-id": title }
      }));
      let l10nFiles = dialogData.l10nFiles || [];
      if (typeof l10nFiles === "string") {
        l10nFiles = [l10nFiles];
      }
      l10nFiles.forEach((file) => {
        win.document.head.appendChild(dialogHelper.createElement(win.document, "link", {
          properties: {
            rel: "localization",
            href: file
          }
        }));
      });
      dialogHelper.appendElement({
        tag: "fragment",
        children: [
          {
            tag: "style",
            properties: {
              // eslint-disable-next-line ts/no-use-before-define
              innerHTML: style
            }
          },
          {
            tag: "link",
            properties: {
              rel: "stylesheet",
              href: "chrome://zotero-platform/content/zotero.css"
            }
          }
        ]
      }, win.document.head);
      replaceElement(elementProps, dialogHelper);
      win.document.body.appendChild(dialogHelper.createElement(win.document, "fragment", {
        children: [elementProps]
      }));
      Array.from(win.document.querySelectorAll("*[data-bind]")).forEach((elem) => {
        const bindKey = elem.getAttribute("data-bind");
        const bindAttr = elem.getAttribute("data-attr");
        const bindProp = elem.getAttribute("data-prop");
        if (bindKey && dialogData && dialogData[bindKey]) {
          if (bindProp) {
            elem[bindProp] = dialogData[bindKey];
          } else {
            elem.setAttribute(bindAttr || "value", dialogData[bindKey]);
          }
        }
      });
      if (windowFeatures.fitContent) {
        setTimeout(() => {
          win.sizeToContent();
        }, 300);
      }
      win.focus();
    }).then(() => {
      dialogData?.loadCallback && dialogData.loadCallback();
    });
    dialogData.unloadLock.promise.then(() => {
      dialogData?.unloadCallback && dialogData.unloadCallback();
    });
    win.addEventListener("DOMContentLoaded", function onWindowLoad(_ev) {
      win.arguments[0]?.loadLock?.resolve();
      win.removeEventListener("DOMContentLoaded", onWindowLoad, false);
    }, false);
    win.addEventListener("beforeunload", function onWindowBeforeUnload(_ev) {
      Array.from(win.document.querySelectorAll("*[data-bind]")).forEach((elem) => {
        const dialogData2 = this.window.arguments[0];
        const bindKey = elem.getAttribute("data-bind");
        const bindAttr = elem.getAttribute("data-attr");
        const bindProp = elem.getAttribute("data-prop");
        if (bindKey && dialogData2) {
          if (bindProp) {
            dialogData2[bindKey] = elem[bindProp];
          } else {
            dialogData2[bindKey] = elem.getAttribute(bindAttr || "value");
          }
        }
      });
      this.window.removeEventListener("beforeunload", onWindowBeforeUnload, false);
      dialogData?.beforeUnloadCallback && dialogData.beforeUnloadCallback();
    });
    win.addEventListener("unload", function onWindowUnload(_ev) {
      if (this.window.arguments[0]?.loadLock.promise.isPending()) {
        return;
      }
      this.window.arguments[0]?.unloadLock?.resolve();
      this.window.removeEventListener("unload", onWindowUnload, false);
    });
    if (win.document.readyState === "complete") {
      win.arguments[0]?.loadLock?.resolve();
    }
    return win;
  }
  function replaceElement(elementProps, uiTool) {
    let checkChildren = true;
    if (elementProps.tag === "select") {
      checkChildren = false;
      const customSelectProps = {
        tag: "div",
        classList: ["dropdown"],
        listeners: [
          {
            type: "mouseleave",
            listener: (ev) => {
              const select = ev.target.querySelector("select");
              select?.blur();
            }
          }
        ],
        children: [
          Object.assign({}, elementProps, {
            tag: "select",
            listeners: [
              {
                type: "focus",
                listener: (ev) => {
                  const select = ev.target;
                  const dropdown = select.parentElement?.querySelector(".dropdown-content");
                  dropdown && (dropdown.style.display = "block");
                  select.setAttribute("focus", "true");
                }
              },
              {
                type: "blur",
                listener: (ev) => {
                  const select = ev.target;
                  const dropdown = select.parentElement?.querySelector(".dropdown-content");
                  dropdown && (dropdown.style.display = "none");
                  select.removeAttribute("focus");
                }
              }
            ]
          }),
          {
            tag: "div",
            classList: ["dropdown-content"],
            children: elementProps.children?.map((option) => ({
              tag: "p",
              attributes: {
                value: option.properties?.value
              },
              properties: {
                innerHTML: option.properties?.innerHTML || option.properties?.textContent
              },
              classList: ["dropdown-item"],
              listeners: [
                {
                  type: "click",
                  listener: (ev) => {
                    const select = ev.target.parentElement?.previousElementSibling;
                    select && (select.value = ev.target.getAttribute("value") || "");
                    select?.blur();
                  }
                }
              ]
            }))
          }
        ]
      };
      for (const key in elementProps) {
        delete elementProps[key];
      }
      Object.assign(elementProps, customSelectProps);
    } else if (elementProps.tag === "a") {
      const href = elementProps?.properties?.href || "";
      elementProps.properties ??= {};
      elementProps.properties.href = "javascript:void(0);";
      elementProps.attributes ??= {};
      elementProps.attributes["zotero-href"] = href;
      elementProps.listeners ??= [];
      elementProps.listeners.push({
        type: "click",
        listener: (ev) => {
          const href2 = ev.target?.getAttribute("zotero-href");
          href2 && uiTool.getGlobal("Zotero").launchURL(href2);
        }
      });
      elementProps.classList ??= [];
      elementProps.classList.push("zotero-text-link");
    }
    if (checkChildren) {
      elementProps.children?.forEach((child) => replaceElement(child, uiTool));
    }
  }
  var style = `
.zotero-text-link {
  -moz-user-focus: normal;
  color: -moz-nativehyperlinktext;
  text-decoration: underline;
  border: 1px solid transparent;
  cursor: pointer;
}
.dropdown {
  position: relative;
  display: inline-block;
}
.dropdown-content {
  display: none;
  position: absolute;
  background-color: var(--material-toolbar);
  min-width: 160px;
  box-shadow: 0px 0px 5px 0px rgba(0, 0, 0, 0.5);
  border-radius: 5px;
  padding: 5px 0 5px 0;
  z-index: 999;
}
.dropdown-item {
  margin: 0px;
  padding: 5px 10px 5px 10px;
}
.dropdown-item:hover {
  background-color: var(--fill-quinary);
}
`;

  // node_modules/zotero-plugin-toolkit/dist/helpers/progressWindow.js
  var icons = {
    success: "chrome://zotero/skin/tick.png",
    fail: "chrome://zotero/skin/cross.png"
  };
  var ProgressWindowHelper = class {
    win;
    lines;
    closeTime;
    /**
     *
     * @param header window header
     * @param options
     * @param options.window
     * @param options.closeOnClick
     * @param options.closeTime
     * @param options.closeOtherProgressWindows
     */
    constructor(header, options = {
      closeOnClick: true,
      closeTime: 5e3
    }) {
      this.win = new (BasicTool.getZotero()).ProgressWindow(options);
      this.lines = [];
      this.closeTime = options.closeTime || 5e3;
      this.win.changeHeadline(header);
      if (options.closeOtherProgressWindows) {
        BasicTool.getZotero().ProgressWindowSet.closeAll();
      }
    }
    /**
     * Create a new line
     * @param options
     * @param options.type
     * @param options.icon
     * @param options.text
     * @param options.progress
     * @param options.idx
     */
    createLine(options) {
      const icon = this.getIcon(options.type, options.icon);
      const line = new this.win.ItemProgress(icon || "", options.text || "");
      if (typeof options.progress === "number") {
        line.setProgress(options.progress);
      }
      this.lines.push(line);
      this.updateIcons();
      return this;
    }
    /**
     * Change the line content
     * @param options
     * @param options.type
     * @param options.icon
     * @param options.text
     * @param options.progress
     * @param options.idx
     */
    changeLine(options) {
      if (this.lines?.length === 0) {
        return this;
      }
      const idx = typeof options.idx !== "undefined" && options.idx >= 0 && options.idx < this.lines.length ? options.idx : 0;
      const icon = this.getIcon(options.type, options.icon);
      if (icon) {
        this.lines[idx].setItemTypeAndIcon(icon);
      }
      options.text && this.lines[idx].setText(options.text);
      typeof options.progress === "number" && this.lines[idx].setProgress(options.progress);
      this.updateIcons();
      return this;
    }
    show(closeTime = void 0) {
      this.win.show();
      typeof closeTime !== "undefined" && (this.closeTime = closeTime);
      if (this.closeTime && this.closeTime > 0) {
        this.win.startCloseTimer(this.closeTime);
      }
      setTimeout(this.updateIcons.bind(this), 50);
      return this;
    }
    /**
     * Set custom icon uri for progress window
     * @param key
     * @param uri
     */
    static setIconURI(key, uri) {
      icons[key] = uri;
    }
    getIcon(type, defaultIcon) {
      return type && type in icons ? icons[type] : defaultIcon;
    }
    updateIcons() {
      try {
        this.lines.forEach((line) => {
          const box = line._image;
          const icon = box.dataset.itemType;
          if (icon && icon.startsWith("chrome://") && !box.style.backgroundImage.includes("progress_arcs")) {
            box.style.backgroundImage = `url(${box.dataset.itemType})`;
          }
        });
      } catch {
      }
    }
    changeHeadline(text, icon, postText) {
      this.win.changeHeadline(text, icon, postText);
      return this;
    }
    addLines(labels, icons2) {
      this.win.addLines(labels, icons2);
      return this;
    }
    addDescription(text) {
      this.win.addDescription(text);
      return this;
    }
    startCloseTimer(ms, requireMouseOver) {
      this.win.startCloseTimer(ms, requireMouseOver);
      return this;
    }
    close() {
      this.win.close();
      return this;
    }
  };

  // node_modules/zotero-plugin-toolkit/dist/utils/wait.js
  var basicTool = new BasicTool();

  // node_modules/zotero-plugin-toolkit/dist/managers/menu.js
  var MenuManager = class extends ManagerTool {
    ui;
    constructor(base) {
      super(base);
      this.ui = new UITool(this);
    }
    /**
     * Insert an menu item/menu(with popup)/menuseprator into a menupopup
     * @remarks
     * options:
     * ```ts
     * export interface MenuitemOptions {
     *   tag: "menuitem" | "menu" | "menuseparator";
     *   id?: string;
     *   label?: string;
     *   // data url (chrome://xxx.png) or base64 url (data:image/png;base64,xxx)
     *   icon?: string;
     *   class?: string;
     *   styles?: { [key: string]: string };
     *   hidden?: boolean;
     *   disabled?: boolean;
     *   oncommand?: string;
     *   commandListener?: EventListenerOrEventListenerObject;
     *   // Attributes below are used when type === "menu"
     *   popupId?: string;
     *   onpopupshowing?: string;
     *   subElementOptions?: Array<MenuitemOptions>;
     * }
     * ```
     * @param menuPopup
     * @param options
     * @param insertPosition
     * @param anchorElement The menuitem will be put before/after `anchorElement`. If not set, put at start/end of the menupopup.
     * @example
     * Insert menuitem with icon into item menupopup
     * ```ts
     * // base64 or chrome:// url
     * const menuIcon = "chrome://addontemplate/content/icons/favicon@0.5x.png";
     * ztoolkit.Menu.register("item", {
     *   tag: "menuitem",
     *   id: "zotero-itemmenu-addontemplate-test",
     *   label: "Addon Template: Menuitem",
     *   oncommand: "alert('Hello World! Default Menuitem.')",
     *   icon: menuIcon,
     * });
     * ```
     * @example
     * Insert menu into file menupopup
     * ```ts
     * ztoolkit.Menu.register(
     *   "menuFile",
     *   {
     *     tag: "menu",
     *     label: "Addon Template: Menupopup",
     *     subElementOptions: [
     *       {
     *         tag: "menuitem",
     *         label: "Addon Template",
     *         oncommand: "alert('Hello World! Sub Menuitem.')",
     *       },
     *     ],
     *   },
     *   "before",
     *   Zotero.getMainWindow().document.querySelector(
     *     "#zotero-itemmenu-addontemplate-test"
     *   )
     * );
     * ```
     */
    register(menuPopup, options, insertPosition = "after", anchorElement) {
      let popup;
      if (typeof menuPopup === "string") {
        popup = this.getGlobal("document").querySelector(MenuSelector[menuPopup]);
      } else {
        popup = menuPopup;
      }
      if (!popup) {
        return false;
      }
      const doc = popup.ownerDocument;
      const genMenuElement = (menuitemOption) => {
        const elementOption = {
          tag: menuitemOption.tag,
          id: menuitemOption.id,
          namespace: "xul",
          attributes: {
            label: menuitemOption.label || "",
            hidden: Boolean(menuitemOption.hidden),
            disabled: Boolean(menuitemOption.disabled),
            class: menuitemOption.class || "",
            oncommand: menuitemOption.oncommand || ""
          },
          classList: menuitemOption.classList,
          styles: menuitemOption.styles || {},
          listeners: [],
          children: []
        };
        if (menuitemOption.icon) {
          if (!this.getGlobal("Zotero").isMac) {
            if (menuitemOption.tag === "menu") {
              elementOption.attributes.class += " menu-iconic";
            } else {
              elementOption.attributes.class += " menuitem-iconic";
            }
          }
          elementOption.styles["list-style-image"] = `url(${menuitemOption.icon})`;
        }
        if (menuitemOption.commandListener) {
          elementOption.listeners?.push({
            type: "command",
            listener: menuitemOption.commandListener
          });
        }
        if (menuitemOption.tag === "menuitem") {
          elementOption.attributes.type = menuitemOption.type || "";
          elementOption.attributes.checked = menuitemOption.checked || false;
        }
        const menuItem = this.ui.createElement(doc, menuitemOption.tag, elementOption);
        if (menuitemOption.getVisibility) {
          popup?.addEventListener("popupshowing", (ev) => {
            const showing = menuitemOption.getVisibility(menuItem, ev);
            if (typeof showing === "undefined") {
              return;
            }
            if (showing) {
              menuItem.removeAttribute("hidden");
            } else {
              menuItem.setAttribute("hidden", "true");
            }
          });
        }
        if (menuitemOption.tag === "menu") {
          const subPopup = this.ui.createElement(doc, "menupopup", {
            id: menuitemOption.popupId,
            attributes: { onpopupshowing: menuitemOption.onpopupshowing || "" }
          });
          menuitemOption.children?.forEach((childOption) => {
            subPopup.append(genMenuElement(childOption));
          });
          menuItem.append(subPopup);
        }
        return menuItem;
      };
      const topMenuItem = genMenuElement(options);
      if (!anchorElement) {
        anchorElement = insertPosition === "after" ? popup.lastElementChild : popup.firstElementChild;
      }
      anchorElement[insertPosition](topMenuItem);
    }
    unregister(menuId) {
      this.getGlobal("document").querySelector(`#${menuId}`)?.remove();
    }
    unregisterAll() {
      this.ui.unregisterAll();
    }
  };
  var MenuSelector;
  (function(MenuSelector2) {
    MenuSelector2["menuFile"] = "#menu_FilePopup";
    MenuSelector2["menuEdit"] = "#menu_EditPopup";
    MenuSelector2["menuView"] = "#menu_viewPopup";
    MenuSelector2["menuGo"] = "#menu_goPopup";
    MenuSelector2["menuTools"] = "#menu_ToolsPopup";
    MenuSelector2["menuHelp"] = "#menu_HelpPopup";
    MenuSelector2["collection"] = "#zotero-collectionmenu";
    MenuSelector2["item"] = "#zotero-itemmenu";
  })(MenuSelector || (MenuSelector = {}));

  // package.json
  var config = {
    addonName: "Zotero Reading List",
    addonID: "reading-list@hotmail.com",
    addonRef: "zotero-reading-list",
    addonInstance: "ZoteroReadingList",
    prefsPrefix: "extensions.zotero.zotero-reading-list",
    releasePage: "https://github.com/Dominic-DallOsto/zotero-reading-list/releases",
    updateJSON: "https://github.com/Dominic-DallOsto/zotero-reading-list/releases/latest/download/update.json"
  };

  // src/utils/locale.ts
  function initLocale() {
    const l10n = new (typeof Localization === "undefined" ? ztoolkit.getGlobal("Localization") : Localization)([`${config.addonRef}-addon.ftl`], true);
    addon.data.locale = {
      current: l10n
    };
  }
  function getString(...inputs) {
    if (inputs.length === 1) {
      return _getString(inputs[0]);
    } else if (inputs.length === 2) {
      if (typeof inputs[1] === "string") {
        return _getString(inputs[0], { branch: inputs[1] });
      } else {
        return _getString(inputs[0], inputs[1]);
      }
    } else {
      throw new Error("Invalid arguments");
    }
  }
  function _getString(localeString, options = {}) {
    const localStringWithPrefix = `${config.addonRef}-${localeString}`;
    const { branch, args } = options;
    const pattern = addon.data.locale?.current.formatMessagesSync([
      { id: localStringWithPrefix, args }
    ])[0];
    if (!pattern) {
      return localStringWithPrefix;
    }
    if (branch && pattern.attributes) {
      return pattern.attributes[branch] || localStringWithPrefix;
    } else {
      return pattern.value || localStringWithPrefix;
    }
  }

  // src/utils/patcher.ts
  var patchMarker = "ZoteroReadingListPatch";
  var patchMarkerOriginal = "ZoteroReadingListPatch_original";
  function patch(methodObject, methodName, patcher) {
    if (typeof methodObject[methodName] !== "function") {
      throw new Error(
        `${methodObject}.${methodName} either isn't a function or doesn't exist`
      );
    }
    const originalFunction = methodObject[methodName];
    if (typeof methodObject[methodName][patchMarker] !== "undefined")
      throw new Error(
        `${methodObject}.${methodName} is already patched by ${patchMarker}`
      );
    methodObject[methodName] = patcher(originalFunction);
    methodObject[methodName][patchMarker] = true;
    methodObject[methodName][patchMarkerOriginal] = originalFunction;
  }
  function unpatch(methodObject, methodName) {
    if (typeof methodObject[methodName] !== "function") {
      throw new Error(
        `${methodObject}.${methodName} either isn't a function or doesn't exist`
      );
    }
    if (methodObject[methodName][patchMarker] == "undefined" || methodObject[methodName][patchMarkerOriginal] == "undefined") {
      throw new Error(
        `${methodObject}.${methodName} isn't already patched by ${patchMarker} so can't be unpatched`
      );
    } else {
      methodObject[methodName] = methodObject[methodName][patchMarkerOriginal];
      delete methodObject[methodName][patchMarker];
      delete methodObject[methodName][patchMarkerOriginal];
    }
  }

  // src/utils/prefs.ts
  function getPref(key) {
    return Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true);
  }
  function getPrefGlobalName(key) {
    return `${config.prefsPrefix}.${key}`;
  }
  function setPref(key, value) {
    return Zotero.Prefs.set(`${config.prefsPrefix}.${key}`, value, true);
  }
  function initialiseDefaultPref(key, defaultValue) {
    if (getPref(key) === void 0) {
      setPref(key, defaultValue);
    }
  }
  function clearPref(key) {
    return Zotero.Prefs.clear(`${config.prefsPrefix}.${key}`, true);
  }

  // src/utils/extraField.ts
  function isString(argument) {
    return typeof argument == "string";
  }
  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function getFieldValueFromExtraData(extraData, fieldName) {
    const pattern = new RegExp(`^${escapeRegExp(fieldName)}:(.+)$`, "i");
    return extraData.split(/\n/g).map((line) => {
      const lineMatch = line.match(pattern);
      if (lineMatch)
        return lineMatch[1].trim();
      else return false;
    }).filter(isString);
  }
  function removeFieldValueFromExtraData(extraData, fieldName) {
    const pattern = new RegExp(`^${escapeRegExp(fieldName)}:(.+)$`, "i");
    return extraData.split(/\n/g).filter((line) => !line.match(pattern)).join("\n");
  }
  function getItemExtraProperty(item, fieldName) {
    return getFieldValueFromExtraData(item.getField("extra"), fieldName);
  }
  function setItemExtraProperty(item, fieldName, values) {
    if (!Array.isArray(values)) values = [values];
    let restOfExtraField = removeFieldValueFromExtraData(
      item.getField("extra"),
      fieldName
    );
    for (const value of values) {
      if (value) {
        restOfExtraField += `
${fieldName}: ${value.trim()}`;
      }
    }
    item.setField("extra", restOfExtraField);
  }
  function clearItemExtraProperty(item, fieldName) {
    item.setField(
      "extra",
      removeFieldValueFromExtraData(item.getField("extra"), fieldName)
    );
  }

  // src/modules/reading-tasks.ts
  var READING_TASKS_EXTRA_FIELD = "Reading_Tasks";
  function getReadingTasks(item) {
    const extra = getItemExtraProperty(item, READING_TASKS_EXTRA_FIELD);
    if (extra.length) {
      try {
        return JSON.parse(extra[0]);
      } catch {
        return [];
      }
    }
    return [];
  }
  function setReadingTasks(item, tasks) {
    setItemExtraProperty(
      item,
      READING_TASKS_EXTRA_FIELD,
      JSON.stringify(tasks)
    );
    void item.saveTx();
    updateItemTagsFromTasks(item);
  }
  function addReadingTask(item, task) {
    const tasks = getReadingTasks(item);
    tasks.push(task);
    setReadingTasks(item, tasks);
  }
  function tasksToString(tasks) {
    return tasks.map((t, idx) => {
      const unit = t.unit ? `Unit ${t.unit}` : void 0;
      const details = [t.module, unit, t.chapter, t.pages, t.paragraph].filter(Boolean).join(" > ");
      const type = t.type ? ` (${t.type})` : "";
      return `${idx + 1}. ${details} [${t.status}]${type}`;
    }).join("\n");
  }
  function updateItemTagsFromTasks(item) {
    const tasks = getReadingTasks(item);
    const unitTags = /* @__PURE__ */ new Set();
    const moduleTags = /* @__PURE__ */ new Set();
    const typeTags = /* @__PURE__ */ new Set();
    for (const t of tasks) {
      if (t.unit) {
        unitTags.add(`Unit ${t.unit}`);
      }
      if (t.module && t.module.includes("ULAW")) {
        moduleTags.add(t.module);
      }
      if (t.type) {
        typeTags.add(t.type);
      }
    }
    const existing = item.getTags().map((t) => t.tag);
    for (const tag of existing) {
      if (/^Unit\s/.test(tag) && !unitTags.has(tag)) {
        item.removeTag(tag);
      } else if (/ULAW/.test(tag) && !moduleTags.has(tag)) {
        item.removeTag(tag);
      } else if (/^(Required|Additional)$/i.test(tag) && !typeTags.has(tag)) {
        item.removeTag(tag);
      }
    }
    for (const tag of unitTags) {
      if (!existing.includes(tag)) {
        item.addTag(tag);
      }
    }
    for (const tag of moduleTags) {
      if (!existing.includes(tag)) {
        item.addTag(tag);
      }
    }
    for (const tag of typeTags) {
      if (!existing.includes(tag)) {
        item.addTag(tag);
      }
    }
    void item.saveTx();
  }

  // src/modules/overlay.ts
  var READ_STATUS_COLUMN_ID = "readstatus";
  var READ_STATUS_EXTRA_FIELD = "Read_Status";
  var READ_DATE_EXTRA_FIELD = "Read_Status_Date";
  var DEFAULT_STATUS_NAMES = [
    "New",
    "To Read",
    "In Progress",
    "Read",
    "Not Reading"
  ];
  var DEFAULT_STATUS_ICONS = ["\u2B50", "\u{1F4D9}", "\u{1F4D6}", "\u{1F4D7}", "\u{1F4D5}"];
  var DEFAULT_STATUS_CHANGE_FROM = ["New", "To Read"];
  var DEFAULT_STATUS_CHANGE_TO = ["In Progress", "In Progress"];
  var SHOW_ICONS_PREF = "show-icons";
  var READ_STATUS_FORMAT_PREF = "read-status-format";
  var READ_STATUS_FORMAT_HEADER_SHOW_ICON = "readstatuscolumn-format-header-showicon";
  var LABEL_NEW_ITEMS_PREF = "label-new-items";
  var LABEL_NEW_ITEMS_PREF_DISABLED = "|none|";
  var LABEL_ITEMS_WHEN_OPENING_FILE_PREF = "label-items-when-opening-file";
  var ENABLE_KEYBOARD_SHORTCUTS_PREF = "enable-keyboard-shortcuts";
  var STATUS_NAME_AND_ICON_LIST_PREF = "statuses-and-icons-list";
  var STATUS_CHANGE_ON_OPEN_ITEM_LIST_PREF = "status-change-on-open-item-list";
  function getItemReadStatus(item) {
    const statusField = getItemExtraProperty(item, READ_STATUS_EXTRA_FIELD);
    return statusField.length == 1 ? statusField[0] : "";
  }
  function setItemReadStatus(item, statusName) {
    setItemExtraProperty(item, READ_STATUS_EXTRA_FIELD, statusName);
    setItemExtraProperty(
      item,
      READ_DATE_EXTRA_FIELD,
      new Date(Date.now()).toISOString()
    );
    void item.saveTx();
  }
  function setItemsReadStatus(items, statusName) {
    for (const item of items) {
      setItemReadStatus(item, statusName);
    }
  }
  function setSelectedItemsReadStatus(statusName) {
    setItemsReadStatus(getSelectedItems(), statusName);
  }
  function clearSelectedItemsReadStatus() {
    const items = getSelectedItems();
    for (const item of items) {
      clearItemExtraProperty(item, READ_STATUS_EXTRA_FIELD);
      clearItemExtraProperty(item, READ_DATE_EXTRA_FIELD);
      void item.saveTx();
    }
  }
  function updateItemStatusFromTasks(item) {
    const tasks = getReadingTasks(item);
    if (!tasks.length) {
      return;
    }
    const [statusNames] = prefStringToList(
      getPref(STATUS_NAME_AND_ICON_LIST_PREF)
    );
    let idx = 0;
    for (const t of tasks) {
      const sIdx = statusNames.indexOf(t.status);
      if (sIdx > idx) {
        idx = sIdx;
      }
    }
    setItemReadStatus(item, statusNames[idx]);
    updateItemTagsFromTasks(item);
  }
  function getSelectedItems() {
    return ZoteroPane.getSelectedItems().filter((item) => item.isRegularItem());
  }
  function showReadingTasks() {
    const items = getSelectedItems();
    if (!items.length) {
      return;
    }
    const lines = [];
    for (const item of items) {
      const tasks = getReadingTasks(item);
      if (tasks.length) {
        lines.push(item.getField("title"));
        lines.push(tasksToString(tasks));
      }
    }
    const message = lines.length ? lines.join("\n") : getString("reading-tasks-none");
    Services.prompt.alert(
      window,
      getString("reading-tasks-title"),
      message
    );
  }
  function openManageReadingTasks() {
    const items = getSelectedItems();
    if (!items.length) {
      return;
    }
    void addon.readingTasksView.open(items[0]);
  }
  function promptAddReadingTask() {
    const items = getSelectedItems();
    if (!items.length) {
      return;
    }
    const promptSvc = Services.prompt;
    const moduleInput = { value: "" };
    if (!promptSvc.prompt(
      window,
      getString("add-reading-task-menu"),
      getString("reading-task-prompt-module"),
      moduleInput,
      null,
      {}
    )) {
      return;
    }
    const unitInput = { value: "" };
    if (!promptSvc.prompt(
      window,
      getString("add-reading-task-menu"),
      getString("reading-task-prompt-unit"),
      unitInput,
      null,
      {}
    )) {
      return;
    }
    const chapterInput = { value: "" };
    promptSvc.prompt(
      window,
      getString("add-reading-task-menu"),
      getString("reading-task-prompt-chapter"),
      chapterInput,
      null,
      {}
    );
    const pagesInput = { value: "" };
    promptSvc.prompt(
      window,
      getString("add-reading-task-menu"),
      getString("reading-task-prompt-pages"),
      pagesInput,
      null,
      {}
    );
    const paragraphInput = { value: "" };
    promptSvc.prompt(
      window,
      getString("add-reading-task-menu"),
      getString("reading-task-prompt-paragraph"),
      paragraphInput,
      null,
      {}
    );
    const typeInput = { value: getString("reading-task-type-required") };
    promptSvc.prompt(
      window,
      getString("add-reading-task-menu"),
      getString("reading-task-prompt-type"),
      typeInput,
      null,
      {}
    );
    const task = {
      module: moduleInput.value.trim(),
      unit: unitInput.value.trim(),
      chapter: chapterInput.value.trim() || void 0,
      pages: pagesInput.value.trim() || void 0,
      paragraph: paragraphInput.value.trim() || void 0,
      type: typeInput.value.trim() || void 0,
      status: prefStringToList(
        getPref(STATUS_NAME_AND_ICON_LIST_PREF)
      )[0][1] || "To Read"
    };
    for (const item of items) {
      addReadingTask(item, task);
      updateItemStatusFromTasks(item);
    }
  }
  var FORBIDDEN_PREF_STRING_CHARACTERS = new Set(":;|");
  function prefStringToList(prefString) {
    const [statusString, iconString] = prefString.split("|");
    return [statusString.split(";"), iconString.split(";")];
  }
  function listToPrefString(stringList, iconList) {
    return stringList.join(";") + "|" + iconList.join(";");
  }
  var ZoteroReadingList = class {
    constructor() {
      this.keyboardEventHandler = (keyboardEvent) => {
        const possibleKeyCombinations = /* @__PURE__ */ new Map();
        for (let num = 0; num < this.statusNames.length; num++) {
          possibleKeyCombinations.set(`Digit${num + 1}`, num);
          possibleKeyCombinations.set(`Numpad${num + 1}`, num);
        }
        const clearStatusKeyCombinations = ["Digit0", "Numpad0"];
        if (!keyboardEvent.ctrlKey && !keyboardEvent.shiftKey && keyboardEvent.altKey) {
          if (possibleKeyCombinations.has(keyboardEvent.code)) {
            const selectedStatus = this.statusNames[possibleKeyCombinations.get(keyboardEvent.code)];
            void setSelectedItemsReadStatus(selectedStatus);
          } else if (clearStatusKeyCombinations.includes(keyboardEvent.code)) {
            void clearSelectedItemsReadStatus();
          }
        }
      };
      this.initialiseDefaultPreferences();
      [this.statusNames, this.statusIcons] = prefStringToList(
        getPref(STATUS_NAME_AND_ICON_LIST_PREF)
      );
      this.addReadStatusColumn();
      this.addPreferencesMenu();
      this.addRightClickMenuPopup();
      this.addReadingTasksPane();
      if (getPref(ENABLE_KEYBOARD_SHORTCUTS_PREF)) {
        this.addKeyboardShortcutListener();
      }
      if (getPref(LABEL_NEW_ITEMS_PREF) != LABEL_NEW_ITEMS_PREF_DISABLED) {
        this.addNewItemLabeller();
      }
      if (getPref(LABEL_ITEMS_WHEN_OPENING_FILE_PREF)) {
        this.addFileOpenedListener();
      }
      this.addPreferenceUpdateObservers();
      this.removeReadStatusFromExports();
    }
    unload() {
      this.removeReadStatusColumn();
      this.removePreferenceMenu();
      this.removeRightClickMenu();
      this.removeKeyboardShortcutListener();
      this.removeNewItemLabeller();
      this.removeFileOpenedListener();
      this.removePreferenceUpdateObservers();
      this.removeReadingTasksPane();
      this.unpatchExportFunction();
    }
    initialiseDefaultPreferences() {
      const oldReadStatusColumnFormatPref_showIcons = getPref(SHOW_ICONS_PREF);
      if (typeof oldReadStatusColumnFormatPref_showIcons == "boolean" && !oldReadStatusColumnFormatPref_showIcons) {
        initialiseDefaultPref(
          READ_STATUS_FORMAT_PREF,
          1 /* ShowText */
        );
      } else {
        initialiseDefaultPref(
          READ_STATUS_FORMAT_PREF,
          0 /* ShowBoth */
        );
      }
      initialiseDefaultPref(READ_STATUS_FORMAT_HEADER_SHOW_ICON, false);
      initialiseDefaultPref(ENABLE_KEYBOARD_SHORTCUTS_PREF, true);
      initialiseDefaultPref(LABEL_ITEMS_WHEN_OPENING_FILE_PREF, false);
      initialiseDefaultPref(
        STATUS_NAME_AND_ICON_LIST_PREF,
        listToPrefString(DEFAULT_STATUS_NAMES, DEFAULT_STATUS_ICONS)
      );
      initialiseDefaultPref(
        STATUS_CHANGE_ON_OPEN_ITEM_LIST_PREF,
        listToPrefString(
          DEFAULT_STATUS_CHANGE_FROM,
          DEFAULT_STATUS_CHANGE_TO
        )
      );
      const oldLabelNewItemsPref = getPref(LABEL_NEW_ITEMS_PREF);
      if (typeof oldLabelNewItemsPref == "boolean") {
        clearPref(LABEL_NEW_ITEMS_PREF);
        if (oldLabelNewItemsPref) {
          setPref(
            LABEL_NEW_ITEMS_PREF,
            prefStringToList(
              getPref(STATUS_NAME_AND_ICON_LIST_PREF)
            )[0][0]
          );
        } else {
          setPref(LABEL_NEW_ITEMS_PREF, LABEL_NEW_ITEMS_PREF_DISABLED);
        }
      } else {
        initialiseDefaultPref(
          LABEL_NEW_ITEMS_PREF,
          LABEL_NEW_ITEMS_PREF_DISABLED
        );
      }
    }
    addPreferenceUpdateObservers() {
      this.preferenceUpdateObservers = [
        Zotero.Prefs.registerObserver(
          getPrefGlobalName(ENABLE_KEYBOARD_SHORTCUTS_PREF),
          (value) => {
            if (value) {
              this.addKeyboardShortcutListener();
            } else {
              this.removeKeyboardShortcutListener();
            }
          },
          true
        ),
        Zotero.Prefs.registerObserver(
          getPrefGlobalName(LABEL_NEW_ITEMS_PREF),
          (value) => {
            if (value == LABEL_NEW_ITEMS_PREF_DISABLED) {
              this.removeNewItemLabeller();
            } else if (typeof this.itemAddedListenerID == "undefined") {
              this.addNewItemLabeller();
            }
          },
          true
        ),
        Zotero.Prefs.registerObserver(
          getPrefGlobalName(LABEL_ITEMS_WHEN_OPENING_FILE_PREF),
          (value) => {
            if (value) {
              this.addFileOpenedListener();
            } else {
              this.removeFileOpenedListener();
            }
          },
          true
        ),
        // refresh read status column on format change
        Zotero.Prefs.registerObserver(
          getPrefGlobalName(READ_STATUS_FORMAT_PREF),
          (value) => {
            this.removeReadStatusColumn();
            this.removeRightClickMenu();
            this.addReadStatusColumn();
            this.addRightClickMenuPopup();
          },
          true
        ),
        Zotero.Prefs.registerObserver(
          getPrefGlobalName(READ_STATUS_FORMAT_HEADER_SHOW_ICON),
          (value) => {
            this.removeReadStatusColumn();
            this.addReadStatusColumn();
          },
          true
        ),
        Zotero.Prefs.registerObserver(
          getPrefGlobalName(STATUS_NAME_AND_ICON_LIST_PREF),
          (value) => {
            [this.statusNames, this.statusIcons] = prefStringToList(value);
            this.removeRightClickMenu();
            this.addRightClickMenuPopup();
            this.removeKeyboardShortcutListener();
            this.addKeyboardShortcutListener();
            this.removeReadStatusColumn();
            this.addReadStatusColumn();
          },
          true
        )
      ];
    }
    removePreferenceUpdateObservers() {
      if (this.preferenceUpdateObservers) {
        for (const preferenceUpdateObserverSymbol of this.preferenceUpdateObservers) {
          Zotero.Prefs.unregisterObserver(preferenceUpdateObserverSymbol);
        }
        this.preferenceUpdateObservers = void 0;
      }
    }
    addReadStatusColumn() {
      const formatStatusName = (statusName) => this.formatStatusName(statusName);
      this.itemTreeReadStatusColumnId = Zotero.ItemTreeManager.registerColumn(
        {
          dataKey: READ_STATUS_COLUMN_ID,
          label: getString("read-status"),
          // If we just want to show the icon, overwrite the label with htmlLabel (#40)
          htmlLabel: getPref(READ_STATUS_FORMAT_HEADER_SHOW_ICON) ? `<span class="icon icon-css icon-16" style="background: url(chrome://${config.addonRef}/content/icons/favicon.png) content-box no-repeat center/contain;" />` : void 0,
          pluginID: config.addonID,
          dataProvider: (item, dataKey) => {
            return item.isRegularItem() ? getItemReadStatus(item) : "";
          },
          // if we put the icon in the dataprovider, it only gets updated when the read status changes
          // putting the icon in the render function updates when the row is clicked or column is sorted
          renderCell: function(index, data, column) {
            const text = document.createElementNS(
              "http://www.w3.org/1999/xhtml",
              "span"
            );
            text.className = "cell-text";
            text.innerText = formatStatusName(data);
            const cell = document.createElementNS(
              "http://www.w3.org/1999/xhtml",
              "span"
            );
            cell.className = `cell ${column.className}`;
            cell.append(text);
            return cell;
          },
          zoteroPersist: ["width", "hidden", "sortDirection"]
        }
      );
    }
    /**
     * Format name of status to localise text and include icon if enabled.
     * @param {string} statusName - The name of the status.
     * @returns {String} values - Name of the status, possibly prefixed with the corresponding icon.
     */
    formatStatusName(statusName) {
      switch (getPref(READ_STATUS_FORMAT_PREF)) {
        case 0 /* ShowBoth */: {
          const statusIndex = this.statusNames.indexOf(statusName);
          return statusIndex > -1 ? `${this.statusIcons[statusIndex]} ${statusName}` : statusName;
        }
        case 1 /* ShowText */: {
          return statusName;
        }
        case 2 /* ShowIcon */: {
          const statusIndex = this.statusNames.indexOf(statusName);
          return statusIndex > -1 ? `${this.statusIcons[statusIndex]}` : statusName;
        }
      }
    }
    removeReadStatusColumn() {
      if (this.itemTreeReadStatusColumnId) {
        Zotero.ItemTreeManager.unregisterColumn(
          this.itemTreeReadStatusColumnId
        );
        this.itemTreeReadStatusColumnId = void 0;
      }
    }
    addPreferencesMenu() {
      const prefOptions = {
        pluginID: config.addonID,
        src: rootURI + "chrome/content/preferences.xhtml",
        label: getString("prefs-title"),
        image: `chrome://${config.addonRef}/content/icons/favicon.png`,
        defaultXUL: true
      };
      void Zotero.PreferencePanes.register(prefOptions);
    }
    removePreferenceMenu() {
      Zotero.PreferencePanes.unregister(config.addonID);
    }
    addRightClickMenuPopup() {
      ztoolkit.Menu.register("item", {
        id: "zotero-reading-list-right-click-item-menu",
        tag: "menu",
        label: getString("menupopup-label"),
        children: [
          {
            tag: "menuitem",
            label: getString("status-none"),
            commandListener: () => void clearSelectedItemsReadStatus()
          },
          ...this.statusNames.map(
            (status_name) => ({
              tag: "menuitem",
              label: this.formatStatusName(status_name),
              commandListener: () => setSelectedItemsReadStatus(status_name)
            })
          ),
          {
            tag: "menuitem",
            label: getString("reading-tasks-menu"),
            commandListener: () => showReadingTasks()
          },
          {
            tag: "menuitem",
            label: getString("add-reading-task-menu"),
            commandListener: () => promptAddReadingTask()
          },
          {
            tag: "menuitem",
            label: getString("manage-reading-tasks-menu"),
            commandListener: () => openManageReadingTasks()
          }
        ],
        getVisibility: (element, event) => {
          return getSelectedItems().length > 0;
        }
      });
    }
    removeRightClickMenu() {
      ztoolkit.Menu.unregister("zotero-reading-list-right-click-item-menu");
    }
    addReadingTasksPane() {
      this.readingTasksPaneID = Zotero.ItemPaneManager.registerSection({
        paneID: "zotero-reading-tasks-pane",
        pluginID: config.addonID,
        header: {
          l10nID: "reading-tasks-title",
          icon: `chrome://${config.addonRef}/content/icons/favicon.png`
        },
        sidenav: {
          l10nID: "reading-tasks-title",
          icon: `chrome://${config.addonRef}/content/icons/favicon.png`
        },
        bodyXHTML: '<div xmlns="http://www.w3.org/1999/xhtml"><div id="reading-tasks-pane-body" style="white-space: pre-wrap;"></div><div style="margin-top:4px;"><button id="reading-tasks-pane-add"></button><button id="reading-tasks-pane-manage" style="margin-left:4px;"></button></div></div>',
        onRender: ({
          body,
          item
        }) => {
          const tasks = getReadingTasks(item);
          const textDiv = body.querySelector(
            "#reading-tasks-pane-body"
          );
          if (textDiv) {
            textDiv.textContent = tasks.length ? tasksToString(tasks) : getString("reading-tasks-none");
          }
          const addBtn = body.querySelector("#reading-tasks-pane-add");
          if (addBtn) {
            addBtn.textContent = getString("add-reading-task-menu");
            addBtn.onclick = () => promptAddReadingTask();
          }
          const manageBtn = body.querySelector("#reading-tasks-pane-manage");
          if (manageBtn) {
            manageBtn.textContent = getString("manage-reading-tasks-menu");
            manageBtn.onclick = () => addon.readingTasksView.open(item);
          }
        }
      });
    }
    removeReadingTasksPane() {
      if (typeof this.readingTasksPaneID === "string") {
        Zotero.ItemPaneManager.unregisterSection(this.readingTasksPaneID);
        this.readingTasksPaneID = void 0;
      }
    }
    addNewItemLabeller() {
      const addItemHandler = (action, type, ids, extraData) => {
        if (action == "add") {
          const items = Zotero.Items.get(ids).filter(
            (item) => item.isRegularItem()
          );
          setItemsReadStatus(
            items,
            getPref(LABEL_NEW_ITEMS_PREF)
          );
        }
      };
      this.itemAddedListenerID = Zotero.Notifier.registerObserver(
        {
          notify(...args) {
            addItemHandler.apply(null, args);
          }
        },
        ["item"],
        "zotero-reading-list",
        1
      );
    }
    removeNewItemLabeller() {
      if (this.itemAddedListenerID) {
        Zotero.Notifier.unregisterObserver(this.itemAddedListenerID);
        this.itemAddedListenerID = void 0;
      }
    }
    addFileOpenedListener() {
      const fileOpenHandler = (action, type, ids, extraData) => {
        if (action == "open") {
          const items = Zotero.Items.getTopLevel(
            Zotero.Items.get(ids)
          );
          const [statusFrom, statusTo] = prefStringToList(
            getPref(STATUS_CHANGE_ON_OPEN_ITEM_LIST_PREF)
          );
          for (const item of items) {
            const itemReadStatusIndex = statusFrom.indexOf(
              getItemReadStatus(item)
            );
            if (itemReadStatusIndex > -1) {
              setItemReadStatus(item, statusTo[itemReadStatusIndex]);
            }
          }
        }
      };
      this.fileOpenedListenerID = Zotero.Notifier.registerObserver(
        {
          notify(...args) {
            fileOpenHandler.apply(null, args);
          }
        },
        ["file"],
        "zotero-reading-list",
        1
      );
    }
    removeFileOpenedListener() {
      if (this.fileOpenedListenerID) {
        Zotero.Notifier.unregisterObserver(this.fileOpenedListenerID);
        this.fileOpenedListenerID = void 0;
      }
    }
    addKeyboardShortcutListener() {
      document.getElementById("sortSubmenuKeys")?.setAttribute("disabled", "true");
      document.addEventListener("keydown", this.keyboardEventHandler);
    }
    removeKeyboardShortcutListener() {
      document.removeEventListener("keydown", this.keyboardEventHandler);
      document.getElementById("sortSubmenuKeys")?.setAttribute("disabled", "false");
    }
    removeReadStatusFromExports() {
      patch(
        Zotero.Utilities.Internal,
        "itemToExportFormat",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        (original) => function Zotero_Utilities_Internal_itemToExportFormat(zoteroItem, _legacy, _skipChildItems) {
          const serializedItem = original.apply(this, arguments);
          if (serializedItem.extra) {
            let extraText = serializedItem.extra;
            extraText = removeFieldValueFromExtraData(
              extraText,
              READ_STATUS_EXTRA_FIELD
            );
            extraText = removeFieldValueFromExtraData(
              extraText,
              READ_DATE_EXTRA_FIELD
            );
            serializedItem.extra = extraText;
          }
          return serializedItem;
        }
      );
    }
    unpatchExportFunction() {
      unpatch(Zotero.Utilities.Internal, "itemToExportFormat");
    }
  };

  // src/utils/ztoolkit.ts
  function createZToolkit() {
    const _ztoolkit = new MyToolkit();
    initZToolkit(_ztoolkit);
    return _ztoolkit;
  }
  function initZToolkit(_ztoolkit) {
    const env = "production";
    _ztoolkit.basicOptions.log.prefix = `[${config.addonName}]`;
    _ztoolkit.basicOptions.log.disableConsole = env === "production";
    _ztoolkit.UI.basicOptions.ui.enableElementJSONLog = false;
    _ztoolkit.UI.basicOptions.ui.enableElementDOMLog = false;
    _ztoolkit.basicOptions.debug.disableDebugBridgePassword = false;
    _ztoolkit.basicOptions.api.pluginID = config.addonID;
    _ztoolkit.ProgressWindow.setIconURI(
      "default",
      `chrome://${config.addonRef}/content/icons/favicon.png`
    );
  }
  var MyToolkit = class extends BasicTool {
    constructor() {
      super();
      this.UI = new UITool(this);
      this.Menu = new MenuManager(this);
      this.ProgressWindow = makeHelperTool(ProgressWindowHelper, this);
    }
    unregisterAll() {
      unregister(this);
    }
  };

  // src/hooks.ts
  var zoteroReadingList;
  async function onStartup() {
    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise
    ]);
    if (false) {
      const loadDevToolWhen = `Plugin ${config.addonID} startup`;
      ztoolkit.log(loadDevToolWhen);
    }
    initLocale();
    await onMainWindowLoad(window);
  }
  async function onMainWindowLoad(win) {
    addon.data.ztoolkit = createZToolkit();
    zoteroReadingList = new ZoteroReadingList();
  }
  async function onMainWindowUnload(win) {
    zoteroReadingList.unload();
    ztoolkit.unregisterAll();
    addon.data.dialog?.window?.close();
  }
  function onShutdown() {
    ztoolkit.unregisterAll();
    addon.data.dialog?.window?.close();
    addon.data.alive = false;
    delete Zotero[config.addonInstance];
  }
  var hooks_default = {
    onStartup,
    onShutdown,
    onMainWindowLoad,
    onMainWindowUnload
  };

  // src/prefs-menu.ts
  var STATUS_NAMES_TABLE_BODY = "statusnames-table-body";
  var OPEN_ITEM_TABLE_BODY = "openitem-table-body";
  var OPEN_ITEM_HIDDEN_ROW = "openitem-table-hidden-row";
  var OPEN_ITEM_CHECKBOX = "zotero-prefpane-zotero-reading-list-label-items-when-opening-file";
  var LABEL_NEW_ITEMS_MENU_LIST = "automatically-label-new-items-menulist";
  function onPrefsLoad(window2) {
    setTableStatusNames(window2);
    setTableOpenItem(window2);
    fillAutomaticallyLabelNewItemsMenuList(window2);
  }
  function resetPrefsMenu(window2) {
    clearTableOpenItem(window2);
    setTableOpenItem(window2);
    clearAutomaticallyLabelNewItemsMenuList(window2);
    fillAutomaticallyLabelNewItemsMenuList(window2);
  }
  function setTableStatusNames(window2) {
    const tableBodyStatusNames = window2.document.getElementById(
      STATUS_NAMES_TABLE_BODY
    );
    for (const row of createTableRowsStatusNames(window2)) {
      tableBodyStatusNames?.append(row);
    }
  }
  function setTableOpenItem(window2) {
    const tableBodyOpenItem = window2.document.getElementById(OPEN_ITEM_TABLE_BODY);
    for (const row of createTableRowsOpenItem(window2)) {
      tableBodyOpenItem?.append(row);
    }
    if (tableBodyOpenItem?.parentElement) {
      tableBodyOpenItem.parentElement.hidden = !getPref(
        LABEL_ITEMS_WHEN_OPENING_FILE_PREF
      );
    }
  }
  function setTableVisibilityOpenItem(window2) {
    const tableBody = window2.document.getElementById(OPEN_ITEM_TABLE_BODY);
    const checkBox = window2.document.getElementById(
      OPEN_ITEM_CHECKBOX
    );
    if (tableBody?.parentElement && checkBox) {
      tableBody.parentElement.hidden = checkBox.checked;
    }
  }
  function addTableRowStatusNames(window2) {
    window2.document.getElementById(STATUS_NAMES_TABLE_BODY)?.append(createTableRowStatusNames(window2, "", ""));
  }
  function addTableRowOpenItem(window2) {
    window2.document.getElementById(OPEN_ITEM_TABLE_BODY)?.append(createTableRowOpenItem(window2, "", ""));
  }
  function resetTableStatusNames(window2) {
    const tableRows = window2.document.getElementById(
      STATUS_NAMES_TABLE_BODY
    )?.children;
    Array.from(tableRows ?? []).map((row) => {
      row.remove();
    });
    setPref(
      STATUS_NAME_AND_ICON_LIST_PREF,
      listToPrefString(DEFAULT_STATUS_NAMES, DEFAULT_STATUS_ICONS)
    );
    setTableStatusNames(window2);
    resetPrefsMenu(window2);
  }
  function resetTableOpenItem(window2) {
    setPref(
      STATUS_CHANGE_ON_OPEN_ITEM_LIST_PREF,
      listToPrefString(DEFAULT_STATUS_CHANGE_FROM, DEFAULT_STATUS_CHANGE_TO)
    );
    clearTableOpenItem(window2);
    setTableOpenItem(window2);
  }
  function clearTableOpenItem(window2) {
    const tableRows = window2.document.getElementById(OPEN_ITEM_TABLE_BODY)?.children;
    Array.from(tableRows ?? []).filter((row) => !row.hidden).map((row) => row.remove());
  }
  function getTableStatusRows(window2) {
    const tableRows = window2.document.getElementById(
      STATUS_NAMES_TABLE_BODY
    )?.children;
    const names = [];
    const icons2 = [];
    for (const row of tableRows ?? []) {
      icons2.push(row.children[0].firstChild.value);
      names.push(row.children[1].firstChild.value);
    }
    return { names, icons: icons2 };
  }
  function inputContainsForbiddenCharacters(input) {
    const valueCharacters = new Set(input.value);
    return [...FORBIDDEN_PREF_STRING_CHARACTERS].filter(
      (char) => valueCharacters.has(char)
    ).length > 0;
  }
  function setDuplicateTableRowsAsInvalid(window2, duplicates) {
    const tableRows = window2.document.getElementById(
      STATUS_NAMES_TABLE_BODY
    )?.children;
    for (const row of tableRows ?? []) {
      const nameInput = row.children[1].firstChild;
      if (duplicates.has(nameInput.value)) {
        nameInput.setCustomValidity("duplicate");
      }
    }
  }
  function checkAllTableRowsAreValid(window2) {
    const tableRows = window2.document.getElementById(
      STATUS_NAMES_TABLE_BODY
    )?.children;
    for (const row of tableRows ?? []) {
      const iconInput = row.children[0].firstChild;
      const nameInput = row.children[1].firstChild;
      iconInput.setCustomValidity(
        inputContainsForbiddenCharacters(iconInput) ? "invalid-characters" : ""
      );
      nameInput.setCustomValidity(
        inputContainsForbiddenCharacters(nameInput) ? "invalid-characters" : ""
      );
    }
  }
  function validateTableRows(window2) {
    checkAllTableRowsAreValid(window2);
    const { names } = getTableStatusRows(window2);
    const unique = new Set(names);
    if (unique.size != names.length) {
      const duplicates = new Set(
        names.filter((item) => {
          if (unique.has(item)) {
            unique.delete(item);
          } else {
            return item;
          }
        })
      );
      setDuplicateTableRowsAsInvalid(window2, duplicates);
    }
  }
  function tableContainsInvalidInput(window2) {
    const tableRows = window2.document.getElementById(
      STATUS_NAMES_TABLE_BODY
    )?.children;
    for (const row of tableRows ?? []) {
      const iconInput = row.children[0].firstChild;
      const nameInput = row.children[1].firstChild;
      if (inputContainsForbiddenCharacters(iconInput)) {
        return true;
      }
      if (inputContainsForbiddenCharacters(nameInput)) {
        return true;
      }
    }
    return false;
  }
  function saveTableStatusNames(window2) {
    const { names, icons: icons2 } = getTableStatusRows(window2);
    if (new Set(names).size != names.length) {
      Services.prompt.alert(
        window2,
        getString("duplicate-status-names-title"),
        getString("duplicate-status-names-description")
      );
      return;
    } else if (tableContainsInvalidInput(window2)) {
      Services.prompt.alert(
        window2,
        getString("invalid-status-names-title"),
        getString("invalid-status-names-description")
      );
      return;
    }
    setPref(STATUS_NAME_AND_ICON_LIST_PREF, listToPrefString(names, icons2));
    resetPrefsMenu(window2);
  }
  function saveTableOpenItem(window2) {
    const tableRows = window2.document.getElementById(OPEN_ITEM_TABLE_BODY)?.children;
    const statusesFrom = [];
    const statusesTo = [];
    for (const row of tableRows ?? []) {
      if (!row.hidden) {
        statusesFrom.push(
          row.children[0].firstChild.value
        );
        statusesTo.push(
          row.children[1].firstChild.value
        );
      }
    }
    setPref(
      STATUS_CHANGE_ON_OPEN_ITEM_LIST_PREF,
      listToPrefString(statusesFrom, statusesTo)
    );
  }
  function createElement(elementName) {
    return document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      elementName
    );
  }
  function moveElementHigher(element) {
    if (element != element.parentElement?.firstChild) {
      element.parentElement?.insertBefore(element, element.previousSibling);
    }
  }
  function moveElementLower(element) {
    if (element.nextSibling) {
      element.parentElement?.insertBefore(
        element,
        element.nextSibling?.nextSibling
      );
    }
  }
  function createTableRowsStatusNames(window2) {
    const [statusNames, statusIcons] = prefStringToList(
      getPref(STATUS_NAME_AND_ICON_LIST_PREF)
    );
    return statusNames.map(
      (statusName, index) => createTableRowStatusNames(window2, statusIcons[index], statusName)
    );
  }
  function createTableRowsOpenItem(window2) {
    const [statusFrom, statusTo] = prefStringToList(
      getPref(STATUS_CHANGE_ON_OPEN_ITEM_LIST_PREF)
    );
    return statusFrom.map(
      (statusName, index) => createTableRowOpenItem(window2, statusName, statusTo[index])
    );
  }
  function createTableRowStatusNames(window2, icon, name) {
    const row = createElement("html:tr");
    const iconCell = createElement("html:td");
    const iconInput = createElement("html:input");
    iconInput.type = "text";
    iconInput.value = icon;
    iconInput.oninput = () => validateTableRows(window2);
    iconCell.append(iconInput);
    const nameCell = createElement("html:td");
    const nameInput = createElement("html:input");
    nameInput.type = "text";
    nameInput.value = name;
    nameInput.oninput = () => validateTableRows(window2);
    nameCell.append(nameInput);
    const settings = createElement("html:td");
    const upButton = createElement("html:button");
    const downButton = createElement("html:button");
    const binButton = createElement("html:button");
    upButton.textContent = "\u2B06";
    downButton.textContent = "\u2B07";
    binButton.textContent = "\u{1F5D1}";
    upButton.onclick = () => {
      moveElementHigher(row);
    };
    downButton.onclick = () => {
      moveElementLower(row);
    };
    binButton.onclick = () => {
      row.remove();
    };
    settings.append(upButton);
    settings.append(downButton);
    settings.append(binButton);
    row.append(iconCell);
    row.append(nameCell);
    row.append(settings);
    return row;
  }
  function createTableRowOpenItem(window2, statusFrom, statusTo) {
    const row = window2.document.getElementById(OPEN_ITEM_HIDDEN_ROW)?.cloneNode(true);
    row.id = "";
    row.hidden = false;
    const fromMenuList = row?.childNodes[0]?.firstChild;
    const toMenuList = row?.childNodes[1]?.firstChild;
    const deleteButton = row?.childNodes[2]?.firstChild;
    const [statusNames, statusIcons] = prefStringToList(
      getPref(STATUS_NAME_AND_ICON_LIST_PREF)
    );
    statusNames.forEach((statusName, index) => {
      const statusString = `${statusIcons[index]} ${statusName}`;
      fromMenuList.appendItem(statusString, statusName);
      toMenuList.appendItem(statusString, statusName);
    });
    fromMenuList.selectedIndex = statusNames.indexOf(statusFrom);
    toMenuList.selectedIndex = statusNames.indexOf(statusTo);
    if (row && deleteButton) {
      deleteButton.onclick = () => {
        row.remove();
      };
    }
    return row;
  }
  function fillAutomaticallyLabelNewItemsMenuList(window2) {
    const menuList = window2.document.getElementById(
      LABEL_NEW_ITEMS_MENU_LIST
    );
    menuList.appendItem(
      getString("autolabelnewitems-disabled"),
      LABEL_NEW_ITEMS_PREF_DISABLED
    );
    const [statusNames, statusIcons] = prefStringToList(
      getPref(STATUS_NAME_AND_ICON_LIST_PREF)
    );
    statusNames.forEach((statusName, index) => {
      const statusString = `${statusIcons[index]} ${statusName}`;
      menuList.appendItem(statusString, statusName);
    });
    menuList.selectedIndex = statusNames.indexOf(
      getPref(LABEL_NEW_ITEMS_PREF)
    );
  }
  function clearAutomaticallyLabelNewItemsMenuList(window2) {
    const listRows = window2.document.getElementById(
      LABEL_NEW_ITEMS_MENU_LIST
    )?.children;
    Array.from(listRows ?? []).map((row) => row.remove());
  }
  var prefs_menu_default = {
    onPrefsLoad,
    addTableRowStatusNames,
    resetTableStatusNames,
    saveTableStatusNames,
    addTableRowOpenItem,
    resetTableOpenItem,
    saveTableOpenItem,
    setTableVisibilityOpenItem
  };

  // src/reading-tasks-view.ts
  var TABLE_BODY = "reading-tasks-table-body";
  var rowsCounter = 0;
  function createInput(dialog, value, listId, long = false) {
    const input = dialog.createElement(dialog.window.document, "input", {
      namespace: "html",
      properties: { type: "text", value: value || "" }
    });
    input.setAttribute("size", long ? "20" : "10");
    if (listId) {
      input.setAttribute("list", listId);
      input.addEventListener("input", () => {
        const list = dialog.window.document.getElementById(
          listId
        );
        if (!list) {
          return;
        }
        const val = input.value.toLowerCase();
        const options = Array.from(list.options);
        const matches = options.filter(
          (o) => o.value.toLowerCase().startsWith(val)
        );
        if (matches.length === 1) {
          const match = matches[0].value;
          if (match.length > val.length) {
            input.value = match;
            input.setSelectionRange(val.length, match.length);
          }
        }
      });
    }
    return input;
  }
  function createTableRow(dialog, task = {}) {
    const doc = dialog.window.document;
    const row = dialog.createElement(doc, "tr", {
      namespace: "html"
    });
    const [statusNames, statusIcons] = prefStringToList(
      getPref(STATUS_NAME_AND_ICON_LIST_PREF)
    );
    const moduleCell = dialog.createElement(doc, "td", {
      namespace: "html"
    });
    moduleCell.append(createInput(dialog, task.module, "module-tags", true));
    const unitCell = dialog.createElement(doc, "td", {
      namespace: "html"
    });
    unitCell.append(createInput(dialog, task.unit, "unit-tags"));
    const chapterCell = dialog.createElement(doc, "td", {
      namespace: "html"
    });
    chapterCell.append(createInput(dialog, task.chapter));
    const pagesCell = dialog.createElement(doc, "td", {
      namespace: "html"
    });
    pagesCell.append(createInput(dialog, task.pages));
    const paragraphCell = dialog.createElement(doc, "td", {
      namespace: "html"
    });
    paragraphCell.append(createInput(dialog, task.paragraph));
    const typeCell = dialog.createElement(doc, "td", {
      namespace: "html"
    });
    const rowIndex = rowsCounter++;
    const typeGroup = dialog.createElement(doc, "div", {
      namespace: "html"
    });
    const typeNames = [
      getString("reading-task-type-required"),
      getString("reading-task-type-additional")
    ];
    typeNames.forEach((t) => {
      const label = dialog.createElement(doc, "label", {
        namespace: "html"
      });
      label.style.marginRight = "8px";
      const radio = dialog.createElement(doc, "input", {
        namespace: "html",
        attributes: { type: "radio", name: `type-${rowIndex}`, value: t }
      });
      if ((task.type || typeNames[0]) === t) {
        radio.checked = true;
      }
      label.append(radio, doc.createTextNode(t));
      typeGroup.append(label);
    });
    typeCell.append(typeGroup);
    const statusCell = dialog.createElement(doc, "td", {
      namespace: "html"
    });
    const group = dialog.createElement(doc, "div", {
      namespace: "html"
    });
    group.classList.add("status-group");
    statusNames.forEach((name, index) => {
      const label = dialog.createElement(doc, "label", {
        namespace: "html"
      });
      label.style.marginRight = "8px";
      const radio = dialog.createElement(doc, "input", {
        namespace: "html",
        attributes: {
          type: "radio",
          name: `status-${rowIndex}`,
          value: name
        }
      });
      if ((task.status || statusNames[0]) === name) {
        radio.checked = true;
      }
      const text = dialog.createElement(doc, "span", {
        namespace: "html",
        properties: { innerHTML: `${statusIcons[index]} ${name}` }
      });
      label.append(radio, text);
      group.append(label);
    });
    statusCell.append(group);
    const removeCell = dialog.createElement(doc, "td", {
      namespace: "html"
    });
    removeCell.style.textAlign = "center";
    const bin = dialog.createElement(doc, "button", {
      namespace: "html",
      properties: { innerHTML: "\u{1F5D1}" }
    });
    bin.style.display = "block";
    bin.style.margin = "0 auto";
    bin.addEventListener("click", () => row.remove());
    removeCell.append(bin);
    row.append(
      moduleCell,
      unitCell,
      chapterCell,
      pagesCell,
      paragraphCell,
      typeCell,
      statusCell,
      removeCell
    );
    return row;
  }
  function addTableRow(dialog) {
    dialog.window.document.getElementById(TABLE_BODY)?.append(createTableRow(dialog));
  }
  function updateItemReadStatus(item, tasks, statuses) {
    let idx = 0;
    for (const t of tasks) {
      const sIdx = statuses.indexOf(t.status);
      if (sIdx > idx) {
        idx = sIdx;
      }
    }
    setItemExtraProperty(item, READ_STATUS_EXTRA_FIELD, statuses[idx]);
    setItemExtraProperty(item, READ_DATE_EXTRA_FIELD, (/* @__PURE__ */ new Date()).toISOString());
    void item.saveTx();
  }
  function save(window2) {
    const args = window2.arguments[0];
    const item = args.item;
    const [statusNames] = prefStringToList(
      getPref(STATUS_NAME_AND_ICON_LIST_PREF)
    );
    const rows = Array.from(
      window2.document.getElementById(TABLE_BODY)?.children || []
    );
    const tasks = [];
    for (const row of rows) {
      const cells = row.children;
      const typeInput = cells[5].querySelector('input[type="radio"]:checked');
      const statusInput = cells[6].querySelector('input[type="radio"]:checked');
      tasks.push({
        module: cells[0].firstChild.value.trim(),
        unit: cells[1].firstChild.value.trim(),
        chapter: cells[2].firstChild.value.trim() || void 0,
        pages: cells[3].firstChild.value.trim() || void 0,
        paragraph: cells[4].firstChild.value.trim() || void 0,
        type: typeInput?.value || void 0,
        status: statusInput?.value || statusNames[0]
      });
    }
    setReadingTasks(item, tasks);
    updateItemReadStatus(item, tasks, statusNames);
    window2.close();
  }
  function onLoad(window2) {
    const args = window2.arguments[0];
    const itemID = args.itemID;
    const item = Zotero.Items.get(itemID);
    args.item = item;
    const tasks = getReadingTasks(item);
    for (const task of tasks) {
      window2.document.getElementById(TABLE_BODY)?.append(createTableRow(addon.data.dialog, task));
    }
  }
  async function open(item) {
    rowsCounter = 0;
    const allTags = (await Zotero.Tags.getAll(item.libraryID)).map(
      (t) => t.tag
    );
    const unitTags = allTags.filter((n) => /^Unit\s/i.test(n));
    const moduleTags = allTags.filter((n) => /ULAW/.test(n));
    const dialog = new DialogHelper(1, 1);
    dialog.addCell(0, 0, {
      tag: "vbox",
      children: [
        {
          tag: "h2",
          namespace: "html",
          properties: { innerHTML: getString("reading-tasks-title") }
        },
        {
          tag: "datalist",
          namespace: "html",
          attributes: { id: "module-tags" },
          children: moduleTags.map((m) => ({
            tag: "option",
            attributes: { value: m }
          }))
        },
        {
          tag: "datalist",
          namespace: "html",
          attributes: { id: "unit-tags" },
          children: unitTags.map((u) => ({
            tag: "option",
            attributes: { value: u }
          }))
        },
        {
          tag: "table",
          namespace: "html",
          children: [
            {
              tag: "thead",
              children: [
                {
                  tag: "tr",
                  children: [
                    {
                      tag: "th",
                      properties: { innerHTML: "Module" }
                    },
                    {
                      tag: "th",
                      properties: { innerHTML: "Unit" }
                    },
                    {
                      tag: "th",
                      properties: { innerHTML: "Chapter" }
                    },
                    {
                      tag: "th",
                      properties: { innerHTML: "Pages" }
                    },
                    {
                      tag: "th",
                      properties: { innerHTML: "Paragraph" }
                    },
                    {
                      tag: "th",
                      properties: { innerHTML: "Type" }
                    },
                    {
                      tag: "th",
                      properties: { innerHTML: "Status" }
                    },
                    {
                      tag: "th",
                      properties: { innerHTML: "Remove" }
                    }
                  ]
                }
              ]
            },
            { tag: "tbody", attributes: { id: TABLE_BODY } }
          ]
        }
      ]
    });
    dialog.addButton(getString("add-reading-task-menu"), "add", {
      noClose: true,
      callback: () => addTableRow(dialog)
    });
    dialog.addButton("Save", "save", { callback: () => save(dialog.window) });
    dialog.setDialogData({
      itemID: item.id,
      loadCallback: () => onLoad(dialog.window),
      l10nFiles: "__addonRef__-addon.ftl"
    });
    addon.data.dialog = dialog;
    dialog.open(getString("manage-reading-tasks-menu"), {
      width: 900,
      height: 600,
      resizable: true
    });
  }
  var reading_tasks_view_default = { open };

  // src/addon.ts
  var Addon = class {
    constructor() {
      this.data = {
        alive: true,
        env: "production",
        ztoolkit: createZToolkit()
      };
      this.hooks = hooks_default;
      this.prefsMenu = prefs_menu_default;
      this.readingTasksView = reading_tasks_view_default;
      this.api = {};
    }
  };
  var addon_default = Addon;

  // src/index.ts
  var basicTool2 = new BasicTool();
  if (!basicTool2.getGlobal("Zotero")[config.addonInstance]) {
    defineGlobal("window");
    defineGlobal("document");
    defineGlobal("ZoteroPane");
    defineGlobal("Zotero_Tabs");
    _globalThis.addon = new addon_default();
    defineGlobal("ztoolkit", () => {
      return _globalThis.addon.data.ztoolkit;
    });
    Zotero[config.addonInstance] = addon;
  }
  function defineGlobal(name, getter) {
    Object.defineProperty(_globalThis, name, {
      get() {
        return getter ? getter() : basicTool2.getGlobal(name);
      }
    });
  }
})();
