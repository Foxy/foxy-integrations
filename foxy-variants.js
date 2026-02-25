var FC = FC || {};
var Weglot = Weglot || {};

var Foxy = (function () {
  // Static properties
  let stylesAdded = false;

  // Instance sequencing for log context
  let __foxyVariantInstanceSeq = 0;

  //one listener set per actual <form> element (prevents duplicates across re-inits/instances)
  const __foxyFormListeners = new WeakMap();

  function setVariantConfig(newConfig) {
    // Constants and variables
    const config = {
      sortBy: "",
      sortOrder: "",
      defaultLocale: "en-US",
      defaultCurrency: "USD",
      priceDisplay: "",
      pricePrecision: 2,
      inventoryDefaultLabel: "Please choose options",
      selectUnavailableLabel: "Unavailable",
      inventoryControl: false,
      multiCurrency: false,
      multilingual: false,
      addonsConfig: null,

      // NEW: debugging
      debug: false,
      debugLevel: "info", // "error" | "warn" | "info" | "debug" | "verbose"
      debugPrefix: "FoxyVariants",
      debugGroupCollapsed: true,
      onLog: null, // (entry) => void

      // NEW: stability / reuse
      container: null, // Element to scope queries
      adapter: null, // ({ container, config, log }) => void
      forceReinit: false, // reinit even if already inited on same form node
      syncOnAnyChange: true,
      persistSelection: false,
      persistSelectionKey: ({ pageKey, productKey }) => `foxyVariants:sel:${pageKey}:${productKey}`,
    };

    const disableClass = "foxy-disable";
    const disableOptionClass = "foxy-disable-option";
    const foxy_variant_group = "foxy-variant-group";
    const foxy_variant_group_order = "foxy-variant-group-order";
    const foxy_variant_item = "[foxy-id='variant-item']";
    const foxy_variant_group_name = "foxy-variant-group-name";
    const foxy_template_switch = "[foxy-id='switch']";

    const INIT_ATTR = "data-foxy-variants-init";
    const TEMPLATE_ATTR = "data-foxy-variant-template";
    const RENDERED_ATTR = "data-foxy-variant-rendered";

    let variantSelectionCompleteProduct = [];
    let variantItems = { serialized: {}, array: [] };
    let variantGroups = [];
    let addonInit = true;

    let switchEventListenerSet = false;
    let syncScheduled = false;

    // Save first config and update internal config for instance
    const firstConfigDefaults = { ...newConfig };
    setConfig(config, newConfig);

    const instanceId = ++__foxyVariantInstanceSeq;
    const log = createLogger(config, { instanceId, scope: "variants" });

    // Check container where the instance will get its data
    let container = setContainer();

    let foxyForm = null;
    let imageElement = null;
    let priceElement = null;
    let inventoryElement = null;
    let quantityElement = null;
    let priceAddToCart = null;
    let addToCartQuantityMax = null;
    let variantGroupElements = null;
    const foxyTemplateSwitch = document.querySelector(foxy_template_switch);

    log.info("instance created", {
      instanceId,
      container: describeEl(container),
      form: describeEl(foxyForm),
    });

    // Insert disabled class styles
    if (!stylesAdded) {
      document.head.insertAdjacentHTML(
        "beforeend",
        `<style>
          .${disableClass} { opacity: 0.5 !important; }
          .${disableOptionClass} { color: #808080 !important; }
        </style>`,
      );
      stylesAdded = true;
    }

    let __persistRestoring = false;

    function getPageKey() {
      // ignore hash on purpose (sidecart hash shouldn't create a new key)
      return `${location.pathname}${location.search}`;
    }

    function getProductKey() {
      // Best: set this yourself in the adapter: form.setAttribute('data-foxy-product-key', 'some-stable-id')
      return (
        foxyForm?.getAttribute("data-foxy-product-key") ||
        foxyForm?.getAttribute("data-product-id") ||
        container?.querySelector("input[name]")?.value?.trim() ||
        variantItems?.array?.[0]?.code ||
        "unknown"
      );
    }

    function getPersistStorage() {
      try {
        return window.sessionStorage; // default: per-tab, avoids long-lived stale restores
      } catch (_) {
        return null;
      }
    }

    function getPersistKey() {
      if (!config.persistSelection) return null;
      const pageKey = getPageKey();
      const productKey = getProductKey();
      try {
        return config.persistSelectionKey({ pageKey, productKey });
      } catch (_) {
        // fallback if user-provided function errors
        return `foxyVariants:sel:${pageKey}:${productKey}`;
      }
    }

    function persistSelectionNow(reason) {
      if (!config.persistSelection) return;
      if (__persistRestoring) return;

      const storage = getPersistStorage();
      const key = getPersistKey();
      if (!storage || !key) return;

      try {
        const selected = getSelectedVariantOptions();
        const payload = {
          v: 1,
          ts: Date.now(),
          selected,
          quantity: quantityElement?.value || null,
          reason: reason || null,
        };
        storage.setItem(key, JSON.stringify(payload));
        log.debug("persistSelection saved", { key, selected });
      } catch (err) {
        log.warn("persistSelection save failed", err);
      }
    }

    function readPersistedSelection() {
      const storage = getPersistStorage();
      const key = getPersistKey();
      if (!storage || !key) return null;

      try {
        const raw = storage.getItem(key);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || typeof data !== "object") return null;
        return data;
      } catch (err) {
        log.warn("persistSelection read failed", err);
        return null;
      }
    }

    function applyPersistedSelectionIfAny() {
      if (!config.persistSelection) return;

      const data = readPersistedSelection();
      const selected = data?.selected;
      if (!selected || typeof selected !== "object") return;

      // Must run AFTER renderVariantGroups() and refreshRefs()
      __persistRestoring = true;
      try {
        // Apply in group order (important for dependent disabling logic)
        variantGroups.forEach(group => {
          const groupName = group.name;
          const desired = selected[groupName];
          if (!desired) return;

          if (group.variantGroupType === "select") {
            const selectEl =
              group.element.querySelector(`select[${RENDERED_ATTR}="1"]`) ||
              group.element.querySelector("select");
            if (!selectEl) return;

            // Only apply if option exists and isn't disabled
            const opt = Array.from(selectEl.options).find(o => o.value === desired);
            if (!opt || opt.disabled) return;

            selectEl.value = desired;
            // Drive your normal logic (disables invalids, updates price/code/image)
            handleVariantSelection({ target: selectEl });
          }

          if (group.variantGroupType === "radio") {
            const radios = Array.from(
              group.element.querySelectorAll(`input[type="radio"][${foxy_variant_group_name}]`),
            );
            const radioEl = radios.find(r => (r.value || "").trim() === String(desired).trim());
            if (!radioEl) return;

            // If it's currently disabled by your rules, skip restoring it
            if (radioEl.disabled || radioEl.parentElement?.classList?.contains(disableClass))
              return;

            radioEl.checked = true;
            handleVariantSelection({ target: radioEl });
          }
        });

        // Re-sync derived fields after restoring (helps when Framer overwrote inputs)
        scheduleDerivedSync("restore selection", foxyForm);

        // Persist the *final* state (in case some restored choices were invalid and got cleared)
        persistSelectionNow("after-restore");
        log.info("persistSelection restored", { selected });
      } finally {
        __persistRestoring = false;
      }
      persistSelectionNow("after-restore");
    }

    function refreshRefs() {
      // after adapter has mapped data-* -> foxy-* these should exist
      foxyForm = container.querySelector('[foxy-id="form"]');
      imageElement = container.querySelector('[foxy-id="image"]');
      priceElement = container.querySelector('[foxy-id="price"]');
      inventoryElement = container.querySelector('[foxy-id="inventory"]');

      quantityElement = foxyForm?.querySelector('input[name="quantity"]') || null;
      priceAddToCart = foxyForm?.querySelector('input[name="price"]') || null;
      addToCartQuantityMax = foxyForm?.querySelector('input[name="quantity_max"]') || null;

      variantGroupElements = foxyForm?.querySelectorAll("[foxy-variant-group]") || null;
    }

    function setConfig(configObj, newCfg) {
      if (newCfg && typeof newCfg === "object") {
        for (const key in newCfg) {
          if (key in configObj) {
            configObj[key] = newCfg[key];
          }
        }
      }
    }

    function setContainer() {
      // Priority: config.container -> currentScript closest container -> document
      if (config.container instanceof Element) return config.container;

      let c = document;
      const foxyInstanceContainer = document?.currentScript?.closest?.("[foxy-id='container']");
      if (foxyInstanceContainer) c = foxyInstanceContainer;
      return c;
    }

    //Attach (or replace) listeners once per form element
    function attachOrReplaceFormListeners() {
      if (!foxyForm) return;

      const prev = __foxyFormListeners.get(foxyForm);
      if (prev) {
        if (prev.abort && typeof prev.abort.abort === "function") {
          prev.abort.abort();
        } else if (prev.handler) {
          foxyForm.removeEventListener("input", prev.handler);
          foxyForm.removeEventListener("change", prev.handler);
          foxyForm.removeEventListener("focusout", prev.handler, true);
          if (prev.onSubmit) foxyForm.removeEventListener("submit", prev.onSubmit);
          if (prev.onClick) foxyForm.removeEventListener("click", prev.onClick);
        }
        __foxyFormListeners.delete(foxyForm);
      }

      let abort = null;
      if (typeof AbortController !== "undefined") abort = new AbortController();

      const handler = handleAnyFormChange;

      // Keeps a fallback for browsers / cases where submitter isn't available
      let lastClickedCartAction = null;

      const onClick = e => {
        const action = getCartActionFromTriggerEl(e.target);
        if (!action) return;

        // Ensure this click belongs to THIS form instance
        const trigger = e.target.closest('[foxy-id="add-to-cart"], [foxy-id="buy-it-now"]');
        if (!trigger) return;
        const form = trigger.form || trigger.closest("form");
        if (form !== foxyForm) return;

        lastClickedCartAction = action;
        applyCartActionToForm(foxyForm, action);
      };

      const onSubmit = e => {
        // Prefer the actual submitter (modern browsers)
        let action = null;

        if (e && e.submitter) {
          action = getCartActionFromTriggerEl(e.submitter);
        }

        // Fallback if submit happened without submitter support
        if (!action) action = lastClickedCartAction;

        if (action) {
          applyCartActionToForm(foxyForm, action);
        }

        persistSelectionNow("submit");
      };

      if (abort) {
        const base = { signal: abort.signal };
        foxyForm.addEventListener("input", handler, base);
        foxyForm.addEventListener("change", handler, base);
        foxyForm.addEventListener("focusout", handler, { ...base, capture: true });
        foxyForm.addEventListener("click", onClick, base);
        foxyForm.addEventListener("submit", onSubmit, base);
      } else {
        foxyForm.addEventListener("input", handler);
        foxyForm.addEventListener("change", handler);
        foxyForm.addEventListener("focusout", handler, true);
        foxyForm.addEventListener("click", onClick);
        foxyForm.addEventListener("submit", onSubmit);
      }

      __foxyFormListeners.set(foxyForm, {
        abort,
        handler,
        onClick,
        onSubmit,
        instanceId,
      });
    }

    // Remove listeners, but only if this instance owns them
    function detachFormListenersIfOwned() {
      if (!foxyForm) return;

      const state = __foxyFormListeners.get(foxyForm);
      if (!state || state.instanceId !== instanceId) return;

      if (state.abort && typeof state.abort.abort === "function") {
        state.abort.abort();
      } else {
        if (state.handler) {
          foxyForm.removeEventListener("input", state.handler);
          foxyForm.removeEventListener("change", state.handler);
          foxyForm.removeEventListener("focusout", state.handler, true);
        }
        if (state.onSubmit) {
          foxyForm.removeEventListener("submit", state.onSubmit);
        }
      }

      __foxyFormListeners.delete(foxyForm);
    }

    function getTemplateSetFromURL(url, cfg) {
      const urlParts = url.split("/");
      const subdomain = urlParts[2]?.split(".")[0] || "";
      const subdirectory = urlParts[3] || "";
      const addons = cfg.addonsConfig;

      if (!addons) return null;

      const isBySubdomain = addons.templateChangeTrigger === "subdomain";
      const isBySubdirectory = addons.templateChangeTrigger === "subdirectory";

      if (isBySubdomain) {
        const matching = addons.templateSets?.[subdomain];
        if (matching) return subdomain;
      }
      if (isBySubdirectory) {
        const matching = addons.templateSets?.[subdirectory];
        if (matching) return subdirectory;
      }
      return null;
    }

    function handleAddons() {
      if (!config.addonsConfig) {
        log.warn("addons enabled but addonsConfig is missing; skipping addons");
        return;
      }

      let templateSet = "DEFAULT";
      const newAddonConfig = {
        defaultCurrency: config.defaultCurrency,
        defaultLocale: config.defaultLocale,
      };

      const templateSetFromURL = getTemplateSetFromURL(window.location.href, config);

      const isTemplateChangeByCountry = config.addonsConfig.templateChangeTrigger === "country";
      const isTemplateChangeByWeglotJS = config.addonsConfig.templateChangeTrigger === "weglotjs";

      const updateNewConfig = templateSetCode => {
        const templateSetConfig = config.addonsConfig.templateSets?.[templateSetCode];
        if (templateSetConfig) {
          const { currency, locale } = templateSetConfig;
          newAddonConfig.defaultCurrency = currency;
          newAddonConfig.defaultLocale = locale;
          templateSet = templateSetCode;

          const translation = config.addonsConfig.translations?.[templateSetCode];
          if (translation) {
            const { selectUnavailableLabel, inventoryDefaultLabel } = translation;
            newAddonConfig.selectUnavailableLabel = selectUnavailableLabel;
            newAddonConfig.inventoryDefaultLabel = inventoryDefaultLabel;
          }
        } else {
          const { defaultCurrency, defaultLocale, selectUnavailableLabel, inventoryDefaultLabel } =
            firstConfigDefaults;
          newAddonConfig.defaultCurrency = defaultCurrency;
          newAddonConfig.defaultLocale = defaultLocale;
          newAddonConfig.selectUnavailableLabel = selectUnavailableLabel;
          newAddonConfig.inventoryDefaultLabel = inventoryDefaultLabel;
          templateSet = "DEFAULT";
        }
      };

      const handleWeglotLanguageChange = newLang => {
        log.info("Weglot language change", { newLang });
        updateNewConfig(newLang);
        removeVariantOptions();
        addonInit = false;
        setConfig(config, newAddonConfig);
        updateTemplateSet(templateSet, true);
      };

      const handleTemplateSwitcher = e => {
        const element = e.target;
        const templateSetCode = element.getAttribute("foxy-template");
        if (templateSetCode) {
          log.info("template switcher click", { templateSetCode });
          addonInit = false;
          removeVariantOptions();
          updateNewConfig(templateSetCode);
          setConfig(config, newAddonConfig);
          updateTemplateSet(templateSet, true);
        }
      };

      if (isTemplateChangeByCountry) {
        try {
          const country = FC.json.shipping_address.country.toLowerCase();
          updateNewConfig(country);
        } catch (_) {
          log.warn("country-based template change requested but FC.json shipping country missing");
        }
      }

      if (isTemplateChangeByWeglotJS && typeof Weglot?.getCurrentLang === "function") {
        updateNewConfig(Weglot.getCurrentLang());
        if (typeof Weglot?.on === "function") {
          Weglot.on("languageChanged", handleWeglotLanguageChange);
        }
      }

      if (templateSetFromURL) updateNewConfig(templateSetFromURL);

      setConfig(config, newAddonConfig);
      updateTemplateSet(templateSet);

      if (!switchEventListenerSet && foxyTemplateSwitch) {
        foxyTemplateSwitch?.addEventListener("click", handleTemplateSwitcher);
        switchEventListenerSet = true;
      }
    }

    function updateTemplateSet(templateSet, initVariantLogic = false) {
      const existingTemplateSet = FC.json?.template_set || "DEFAULT";
      if (existingTemplateSet !== templateSet) {
        log.info("requesting template_set change", { from: existingTemplateSet, to: templateSet });
        FC.client.request(`https://${FC.settings.storedomain}/cart?template_set=${templateSet}`);
      }
      if (initVariantLogic) init();
    }

    function init() {
      log.group("init()");
      try {
        // Adapter hook (builder mapping) - runs before we read the DOM
        if (typeof config.adapter === "function") {
          log.debug("adapter start");
          try {
            config.adapter({ container, config, log });
          } catch (err) {
            log.error("adapter failed", err);
          }
          log.debug("adapter end");
        }

        refreshRefs();

        if (!foxyForm) {
          log.warn("no form found; init aborted", { container: describeEl(container) });
          return;
        }

        // Idempotent init per form node
        const already = foxyForm.getAttribute(INIT_ATTR) === "1";
        if (already && !config.forceReinit) {
          log.info("form already initialized; skipping", { form: describeEl(foxyForm) });
          return;
        }
        if (already && config.forceReinit) {
          log.warn("forceReinit enabled; destroying previous render first");
          destroy();
        }

        // Addons path
        if ((config.multiCurrency || config.multilingual) && addonInit) {
          const existingOnLoad = typeof FC.onLoad == "function" ? FC.onLoad : function () {};
          FC.onLoad = function () {
            existingOnLoad();
            addonInit = false;
            FC.client.on("ready.done", handleAddons).on("ready.done", init);
          };
          log.info("addons mode: deferring init until FC ready.done");
          return;
        }

        buildVariantList();
        log.debug("variantItems built", {
          count: variantItems.array.length,
          sampleKeys: variantItems.array[0] ? Object.keys(variantItems.array[0]) : [],
        });

        buildVariantGroupList();
        log.debug("variantGroups built", {
          count: variantGroups.length,
          names: variantGroups.map(g => g.name),
          types: variantGroups.map(g => g.variantGroupType),
        });

        renderVariantGroups();
        log.info("render complete");

        applyPersistedSelectionIfAny();

        setDefaults();
        addPrice();
        setInventory();

        //attach/replace listeners (prevents duplicates across instances/reinits)
        attachOrReplaceFormListeners();

        // Mark initialized
        foxyForm.setAttribute(INIT_ATTR, "1");
        log.info("init done");
      } catch (err) {
        log.error("init failed", err);
      } finally {
        log.groupEnd();
      }
    }

    function destroy() {
      log.group("destroy()");
      try {
        if (!foxyForm) return;

        //Remove listeners only if this instance owns them
        detachFormListenersIfOwned();

        // Remove rendered clones
        const rendered = foxyForm.querySelectorAll(`[${RENDERED_ATTR}="1"]`);
        rendered.forEach(n => n.remove());

        // Clear init marker
        foxyForm.removeAttribute(INIT_ATTR);

        // Reset internal state (so a future init rebuilds cleanly)
        variantSelectionCompleteProduct = [];
        variantItems = { serialized: {}, array: [] };
        variantGroups = [];

        log.info("destroy complete", { removedRendered: rendered.length });
      } catch (err) {
        log.error("destroy failed", err);
      } finally {
        log.groupEnd();
      }
    }

    function setDefaults() {
      if (quantityElement) {
        quantityElement.setAttribute("min", "1");
        if (!quantityElement.value) quantityElement.value = "1";
      }
    }

    function buildVariantList() {
      const variantList = container.querySelectorAll(foxy_variant_item);
      log.debug("buildVariantList()", { found: variantList.length });

      if (!variantList.length) return;

      variantItems = { serialized: {}, array: [] };

      variantList.forEach((variantItem, idx) => {
        const variant = Object.values(variantItem.attributes).reduce((acc, currAttr) => {
          const { name, value } = currAttr;

          if (name.includes("foxy-variant") && value) {
            const key = sanitize(name.split("foxy-variant-")[1]);
            const currency = sanitize(config.defaultCurrency);

            if (!acc[key]) {
              if (config.multiCurrency && key === `price-${currency}`) {
                acc["price"] = value.trim();
                return acc;
              }

              if (config.multiCurrency && key.includes("price") && key !== `price-${currency}`) {
                return acc;
              }

              acc[key === "sku" ? "code" : key] = value.trim();
            }
          }
          return acc;
        }, {});

        const clean = filterEmpty(variant);
        variantItems.serialized[clean?.code ?? clean.name] = clean;
        variantItems.array.push(clean);

        if (idx === 0) log.verbose("sample variant parsed", clean);
      });
    }

    function buildVariantGroupList() {
      if (!variantGroupElements) return;

      variantGroups = [];

      variantGroupElements.forEach(variantGroupElement => {
        let editorElementGroupName;
        const cmsVariantGroupName = sanitize(variantGroupElement.getAttribute(foxy_variant_group));

        const variantOptionsData = getVariantGroupOptions(cmsVariantGroupName);
        const variantGroupOptions = variantOptionsData.map(o => o.variantOption);

        const variantGroupType = variantGroupElementsType(variantGroupElement);

        let variantOptionDesign;
        let variantOptionDesignParent;

        // Prefer already-marked templates
        if (variantGroupType === "select") {
          const templateSelect =
            variantGroupElement.querySelector(`select[${TEMPLATE_ATTR}="1"]`) ||
            variantGroupElement.querySelector(`select:not([${RENDERED_ATTR}="1"])`);

          if (!templateSelect) return;

          editorElementGroupName =
            templateSelect.getAttribute("data-name") || templateSelect.getAttribute("name");

          variantOptionDesign = templateSelect;
          variantOptionDesignParent = templateSelect.parentElement;

          // Mark + neutralize template
          variantOptionDesign.setAttribute(TEMPLATE_ATTR, "1");
          variantOptionDesign.style.display = "none";
          variantOptionDesign.required = false;
          variantOptionDesign.disabled = true;
        } else if (variantGroupType === "radio") {
          // Find a radio not inside a rendered clone
          const radios = Array.from(variantGroupElement.querySelectorAll("input[type=radio]"));
          const templateRadio =
            variantGroupElement.querySelector(`[${TEMPLATE_ATTR}="1"] input[type=radio]`) ||
            radios.find(r => !r.closest(`[${RENDERED_ATTR}="1"]`));

          if (!templateRadio) return;

          editorElementGroupName =
            templateRadio.getAttribute("data-name") || templateRadio.getAttribute("name");

          variantOptionDesign = templateRadio.closest("label") || templateRadio.parentElement;
          if (!variantOptionDesign) return;

          variantOptionDesignParent = variantOptionDesign.parentElement;

          // Mark + neutralize template wrapper + input
          variantOptionDesign.setAttribute(TEMPLATE_ATTR, "1");
          variantOptionDesign.style.display = "none";
          templateRadio.required = false;
          templateRadio.disabled = true;
        } else {
          return;
        }

        const customSortOrder =
          variantGroupElement
            .getAttribute(foxy_variant_group_order)
            ?.trim()
            .split(/\s*,\s*/) ?? null;

        log.debug("group detected", {
          group: cmsVariantGroupName,
          type: variantGroupType,
          options: variantOptionsData.length,
          element: describeEl(variantGroupElement),
        });

        if (variantGroupOptions.length === 0) {
          variantGroupElement.remove();
          log.info("group removed (no options)", { group: cmsVariantGroupName });
        } else {
          variantGroups.push({
            editorElementGroupName,
            customSortOrder,
            element: variantGroupElement,
            options: variantGroupOptions,
            optionsData: variantOptionsData,
            name: cmsVariantGroupName,
            variantGroupType,
            variantOptionDesign,
            variantOptionDesignParent,
          });

          log.info("group registered", {
            name: cmsVariantGroupName,
            type: variantGroupType,
            options: variantGroupOptions.length,
            customSort: !!customSortOrder,
          });
        }
      });
    }

    function variantGroupElementsType(variantGroupElement) {
      const select = variantGroupElement.querySelector("select");
      const radio = variantGroupElement.querySelector("input[type=radio]");
      if (select) return "select";
      if (radio) return "radio";
      return null;
    }

    function getVariantGroupOptions(groupName) {
      const variantGroupOptions = [];
      variantItems.array.forEach(variantItem => {
        const variantOption = variantItem[groupName]?.trim();

        const variantItemStyles = Object.fromEntries(
          Object.entries(variantItem)
            .filter(([key, value]) => key.includes(`${groupName}-`) && value)
            .map(([key, value]) => [key.replace(`${groupName}-`, ""), value]),
        );

        if (
          variantOption &&
          !variantGroupOptions.some(opt => opt.variantOption === variantOption)
        ) {
          variantGroupOptions.push({
            inventory: variantItem.inventory,
            label: variantItem.label,
            price: variantItem.price,
            variantOption,
            styles: variantItemStyles,
          });
        }
      });

      sortOptions(variantGroupOptions);
      return variantGroupOptions;
    }

    function sortOptions(variantGroupOptions) {
      const { sortBy, sortOrder } = config;

      const compareFn = (a, b) => {
        if (sortBy === "price") {
          const priceA = Number(a.price);
          const priceB = Number(b.price);
          return sortOrder === "descending" ? priceB - priceA : priceA - priceB;
        }
        if (sortBy === "label") {
          const labelA = String(a.label || "");
          const labelB = String(b.label || "");
          return sortOrder === "descending"
            ? labelB.localeCompare(labelA)
            : labelA.localeCompare(labelB);
        }
        return 0;
      };

      if (sortBy) {
        variantGroupOptions.sort(compareFn);
      } else {
        variantGroupOptions.sort((a, b) => {
          const labelA = String(a.variantOption || "");
          const labelB = String(b.variantOption || "");
          if (sortOrder === "descending") return labelB.localeCompare(labelA);
          if (sortOrder === "ascending") return labelA.localeCompare(labelB);
          return 0;
        });
      }

      return variantGroupOptions;
    }

    function getVariantLabelElement(root, radioInput) {
      if (!root) return null;

      const labelCandidates = root.querySelectorAll(["span", "label", ".framer-text"].join(","));

      let labelEl = Array.from(labelCandidates).find(el => el.textContent.trim().length);

      if (!labelEl && radioInput) {
        let sib = radioInput.nextElementSibling;
        while (sib) {
          const textEl =
            sib.querySelector(".framer-text") ||
            sib.querySelector("span") ||
            sib.querySelector("label") ||
            sib;

          if (textEl && textEl.textContent.trim().length) {
            labelEl = textEl;
            break;
          }
          sib = sib.nextElementSibling;
        }
      }

      return labelEl || null;
    }

    function renderVariantGroups() {
      if (!variantGroups.length) return;

      log.group("renderVariantGroups()", { groups: variantGroups.length });

      const style = (node, styles) =>
        Object.keys(styles || {}).forEach(key => (node.style[key] = styles[key]));

      const addRadioOptions = variantGroup => {
        const {
          editorElementGroupName,
          element,
          name,
          options,
          optionsData,
          customSortOrder,
          variantOptionDesign,
          variantOptionDesignParent,
        } = variantGroup;

        const variantOptions = customSortOrder ? customSortOrder : options;

        variantOptions.forEach((option, index) => {
          const variantOptionData = optionsData.find(od => od.variantOption === option);

          const variantOptionClone = variantOptionDesign.cloneNode(true);
          variantOptionClone.style.display = ""; // ensure visible
          variantOptionClone.setAttribute(RENDERED_ATTR, "1");

          const radioInput = variantOptionClone.querySelector("input[type=radio]");
          const labelEl = getVariantLabelElement(variantOptionClone, radioInput);

          if (labelEl) {
            labelEl.textContent = option;
            if ("htmlFor" in labelEl) labelEl.htmlFor = `${option}-${index}`;
            else labelEl.setAttribute("for", `${option}-${index}`);
          }

          radioInput.id = `${option}-${index}`;
          radioInput.name = editorElementGroupName ? editorElementGroupName : name;
          radioInput.value = option;
          radioInput.setAttribute(foxy_variant_group_name, name);
          radioInput.required = true;
          radioInput.disabled = false;

          if (
            config.inventoryControl &&
            variantGroups.length === 1 &&
            !Number(variantOptionData?.inventory)
          ) {
            radioInput.disabled = true;
            radioInput.parentElement.classList.add(disableClass);
          }

          // Apply custom styles to which element: webflow, framer or parent so far
          const customInput =
            variantOptionClone.querySelector("div.w-radio-input") ||
            radioInput ||
            variantOptionClone;
          if (customInput) style(customInput, variantOptionData?.styles);

          if (variantOptionDesignParent?.getAttribute(foxy_variant_group)) {
            element.append(variantOptionClone);
          } else {
            variantOptionDesignParent.append(variantOptionClone);
          }
        });

        log.debug("rendered group", { name, type: "radio", rendered: variantOptions.length });
      };

      const addSelectOptions = variantGroup => {
        const {
          editorElementGroupName,
          element,
          name,
          options,
          optionsData,
          customSortOrder,
          variantOptionDesign,
          variantOptionDesignParent,
        } = variantGroup;

        const variantOptions = customSortOrder ? customSortOrder : options;

        let variantSelect = variantOptionDesign.cloneNode(true);
        variantSelect.style.display = ""; // ensure visible
        variantSelect.setAttribute(RENDERED_ATTR, "1");

        variantSelect.required = true;
        variantSelect.disabled = false;
        variantSelect.name = editorElementGroupName ? editorElementGroupName : name;
        variantSelect.setAttribute(foxy_variant_group_name, name);

        // reset options (clone includes whatever builder had)
        while (variantSelect.options.length) variantSelect.remove(0);

        // default option
        variantSelect.add(new Option("Select…", ""));
        variantSelect.options[0].disabled = true;
        variantSelect.options[0].selected = true;

        variantOptions.forEach(option => {
          const variantOptionData = optionsData.find(od => od.variantOption === option);
          let selectOption = new Option(option, option);

          if (
            config.inventoryControl &&
            variantGroups.length === 1 &&
            !Number(variantOptionData?.inventory)
          ) {
            const unavailableText = config.selectUnavailableLabel
              ? ` (${config.selectUnavailableLabel})`
              : "";
            selectOption = new Option(`${option}${unavailableText}`, option);
            selectOption.disabled = true;
          }

          variantSelect.add(selectOption);
        });

        if (variantOptionDesignParent.getAttribute(foxy_variant_group)) {
          element.append(variantSelect);
        } else {
          variantOptionDesignParent.append(variantSelect);
        }

        log.debug("rendered group", { name, type: "select", rendered: variantOptions.length });
      };

      try {
        variantGroups.forEach(variantGroup => {
          if (variantGroup.variantGroupType === "select") addSelectOptions(variantGroup);
          else addRadioOptions(variantGroup);
        });
      } finally {
        log.groupEnd();
      }
    }

    function removeVariantOptions() {
      if (!foxyForm) return;

      // Remove clones we added
      const rendered = foxyForm.querySelectorAll(`[${RENDERED_ATTR}="1"]`);
      rendered.forEach(n => n.remove());

      // Reset internal state
      variantSelectionCompleteProduct = [];
      variantItems = { serialized: {}, array: [] };
      variantGroups = [];

      log.info("removed rendered variant options", { removed: rendered.length });
    }

    function addPrice() {
      if (!priceElement || !priceAddToCart) {
        log.verbose("addPrice skipped (missing priceElement or price input)");
      }

      if (variantItems.array.length === 1) {
        const variantPrice = variantItems.array[0].price;
        if (priceElement) {
          priceElement.textContent = moneyFormat(
            config.defaultLocale,
            config.defaultCurrency,
            variantPrice,
          );
          priceElement.classList.remove("w-dyn-bind-empty");
        }
        if (priceAddToCart) priceAddToCart.value = parseFloat(variantPrice);
        return;
      }

      if (!variantItems.array.length) {
        if (priceElement && priceElement.textContent) {
          const numericPrice = Number(priceElement.textContent);
          if (!isNaN(numericPrice)) {
            priceElement.textContent = moneyFormat(
              config.defaultLocale,
              config.defaultCurrency,
              numericPrice,
            );
            priceElement.classList.remove("w-dyn-bind-empty");
          } else {
            priceElement.textContent = "";
            priceElement.classList.add("w-dyn-bind-empty");
          }
        }
        return;
      }

      // multiple variants
      const sortedPrices = variantItems.array
        .map(v => Number(v.price))
        .filter(n => !Number.isNaN(n))
        .sort((a, b) => a - b);

      if (!sortedPrices.length) return;

      const low = sortedPrices[0];
      const high = sortedPrices[sortedPrices.length - 1];

      if (low !== high) {
        if (config.priceDisplay === "low") {
          if (priceElement)
            priceElement.textContent = moneyFormat(
              config.defaultLocale,
              config.defaultCurrency,
              low,
            );
          priceElement?.classList.remove("w-dyn-bind-empty");
          return;
        }
        if (config.priceDisplay === "high") {
          if (priceElement)
            priceElement.textContent = moneyFormat(
              config.defaultLocale,
              config.defaultCurrency,
              high,
            );
          priceElement?.classList.remove("w-dyn-bind-empty");
          return;
        }

        const priceText = `${moneyFormat(
          config.defaultLocale,
          config.defaultCurrency,
          low,
        )}–${moneyFormat(config.defaultLocale, config.defaultCurrency, high)}`;

        if (priceElement) priceElement.textContent = priceText;
        priceElement?.classList.remove("w-dyn-bind-empty");
      } else {
        const price = moneyFormat(config.defaultLocale, config.defaultCurrency, low);
        priceElement?.classList.remove("w-dyn-bind-empty");
        if (priceElement) priceElement.textContent = price;
        if (priceAddToCart) priceAddToCart.value = parseFloat(low);
      }
    }

    function setInventory(isVariantsSelectionDone) {
      if (!foxyForm) return;

      if (isVariantsSelectionDone) {
        if (!config.inventoryControl) return;

        const quantity = quantityElement?.value ?? 1;
        const submitButton = foxyForm.querySelector("input[type=submit], button[type=submit]");
        const inventory =
          variantItems.array.length === 1
            ? variantItems.array[0]?.inventory
            : variantSelectionCompleteProduct?.inventory;

        if (Number(quantity) > Number(inventory)) {
          if (quantityElement) quantityElement.value = 1;
        }

        if (inventoryElement) {
          if (inventory === undefined) {
            inventoryElement.textContent = "0";
            if (submitButton) {
              submitButton.disabled = true;
              submitButton.classList.add(disableClass);
            }
            return;
          }

          if (Number(quantity) <= Number(inventory)) {
            inventoryElement.textContent = inventory;
            if (submitButton) {
              submitButton.disabled = false;
              submitButton.classList.remove(disableClass);
            }
            return;
          }
        }
        return;
      }

      if (variantItems.array.length === 1) {
        if (config.inventoryControl && addToCartQuantityMax) {
          addToCartQuantityMax.value = variantItems.array[0]?.inventory ?? 0;
        }
        return;
      }

      if (variantItems.array.length > 1) {
        if (inventoryElement) {
          inventoryElement.textContent = config.inventoryDefaultLabel;
          inventoryElement.classList.remove("w-dyn-bind-empty");
        }
      }
    }

    function scheduleDerivedSync(reason, sourceEl) {
      if (!config.syncOnAnyChange) return;
      if (syncScheduled) return;

      syncScheduled = true;
      const milliseconds = 30;
      setTimeout(() => {
        syncScheduled = false;

        // Re-acquire refs in case Framer replaced inputs
        refreshRefs();
        if (!foxyForm) return;

        log.verbose("derived sync run", { reason, source: describeEl(sourceEl) });

        // Only re-apply derived fields based on current selection
        const selected = getSelectedVariantOptions();
        const available = getAvailableProductsPerVariantSelection(selected);
        updateProductInfo(available, selected);
      }, milliseconds);
    }

    function handleVariantSelection(e) {
      const targetElement = e.target;
      const currentVariantSelection = targetElement.value;
      if (!currentVariantSelection) return;

      if (!targetElement.closest(`div[foxy-variant-group]`)) return;

      const variantSelectionGroup = sanitize(targetElement.getAttribute("foxy-variant-group-name"));

      removeDisabledStyleVariantGroupOptions(targetElement, false);

      updateVariantOptions(variantSelectionGroup, currentVariantSelection, targetElement);

      const selectedProductVariants = getSelectedVariantOptions();
      const finalAvailable = getAvailableProductsPerVariantSelection(selectedProductVariants);
      updateProductInfo(finalAvailable, selectedProductVariants);
    }

    function handleAnyFormChange(e) {
      const t = e.target;
      if (!t) return;

      log.debug("form event", { type: e.type, target: describeEl(e.target) });

      const isVariantRadio =
        t.matches && t.matches(`input[type="radio"][${foxy_variant_group_name}]`);
      const isVariantSelect = t.matches && t.matches(`select[${foxy_variant_group_name}]`);

      // Keep your existing behavior for variant controls (disabling invalid options etc.)
      if (isVariantRadio || isVariantSelect) {
        handleVariantSelection(e);

        persistSelectionNow("variant change");

        return;
      }

      // Non-variant field changes (quantity, add-ons, other inputs)
      persistSelectionNow("non-variant change");
      // Don’t run disable/availability logic; just re-apply derived fields if selection is complete.
      scheduleDerivedSync("non-variant change", t);
    }

    function removeDisabledStyleVariantGroupOptions(currentVariantSelectionElement, resetChoices) {
      const { nodeName } = currentVariantSelectionElement;

      if (nodeName === "INPUT") {
        currentVariantSelectionElement.parentElement.classList.remove(disableClass);

        if (resetChoices) {
          const variantGroupContainer = currentVariantSelectionElement.closest(
            `[${foxy_variant_group}]`,
          );
          variantGroupContainer
            .querySelectorAll(`.${disableClass}`)
            .forEach(input => input.classList.remove(disableClass));
        }
      } else if (nodeName === "SELECT") {
        currentVariantSelectionElement
          .querySelectorAll(`option.${disableOptionClass}`)
          .forEach(option => {
            option.classList.remove(disableOptionClass);
            const unavailableText = ` (${config.selectUnavailableLabel})`;
            const optionText = option.textContent.split(unavailableText)[0];
            option.textContent = optionText;
          });
      }
    }

    function getSelectedVariantOptions() {
      const selectedProductVariants = {};

      foxyForm
        .querySelectorAll(
          `div[${foxy_variant_group}] input[type="radio"][${foxy_variant_group_name}]:checked,
           div[${foxy_variant_group}] select[${foxy_variant_group_name}]:valid`,
        )
        .forEach(el => {
          if (!el.value) return;
          selectedProductVariants[sanitize(el.getAttribute(foxy_variant_group_name))] = el.value;
        });

      return selectedProductVariants;
    }

    function getAvailableProductsPerVariantSelection(
      selectedProductVariants,
      restrictedMatch = false,
    ) {
      const ifIsInventoryControlEnabled = inventory =>
        config.inventoryControl ? Number(inventory) > 0 : true;

      const userHasChosenAllGroups = isVariantsSelectionComplete();

      const chosenKeys = Object.keys(selectedProductVariants).filter(key => {
        const val = selectedProductVariants[key];
        return val !== undefined && val !== "";
      });

      if (userHasChosenAllGroups && !restrictedMatch) {
        return variantItems.array.filter(variant => ifIsInventoryControlEnabled(variant.inventory));
      }

      return variantItems.array.filter(variant => {
        if (!ifIsInventoryControlEnabled(variant.inventory)) return false;
        for (const key of chosenKeys) {
          if (variant[key] !== selectedProductVariants[key]) return false;
        }
        return true;
      });
    }

    function updateVariantOptions(
      variantSelectionGroup,
      currentVariantSelection,
      currentVariantSelectionElement,
    ) {
      const selectedProductVariants = getSelectedVariantOptions();
      const availableProducts = getAvailableProductsPerVariantSelection(selectedProductVariants);
      let variantGroupsStateChange = false;

      variantGroups.forEach(group => {
        const { name, variantGroupType, element } = group;
        const currentValue = selectedProductVariants[name] || "";

        if (!currentValue || name === variantSelectionGroup) return;

        const availableRestricted = getAvailableProductsPerVariantSelection(
          selectedProductVariants,
          true,
        );
        const stillValid = availableRestricted.some(prod => prod[name] === currentValue);

        if (!stillValid) {
          selectedProductVariants[name] = "";
          variantGroupsStateChange = true;

          if (variantGroupType === "select") {
            const selectEl =
              element.querySelector(`select[${RENDERED_ATTR}="1"]`) ||
              element.querySelector("select");
            if (selectEl) selectEl.selectedIndex = 0;
          } else if (variantGroupType === "radio") {
            const radios = element.querySelectorAll(
              `input[type='radio'][${foxy_variant_group_name}]`,
            );
            radios.forEach(radio => {
              if (radio.checked) {
                radio.checked = false;
                if (radio.parentElement.classList.contains(disableClass)) {
                  radio.parentElement.classList.remove(disableClass);
                }
                if (radio.previousElementSibling) {
                  radio.previousElementSibling.classList.remove("w--redirected-checked");
                }
              }
            });
          }
        }
      });

      let finalSelected = selectedProductVariants;
      let finalAvailable = availableProducts;

      if (variantGroupsStateChange) {
        finalSelected = getSelectedVariantOptions();
        finalAvailable = getAvailableProductsPerVariantSelection(finalSelected);
      }

      disableInvalidOptionsAcrossAllGroups(
        finalSelected,
        finalAvailable,
        variantSelectionGroup,
        currentVariantSelection,
      );

      if (variantGroupsStateChange && currentVariantSelectionElement) {
        removeDisabledStyleVariantGroupOptions(currentVariantSelectionElement, true);
      }
    }

    function disableInvalidOptionsAcrossAllGroups(
      selectedProductVariants,
      _finalAvailable,
      lastChangedGroup,
      lastChangedValue,
    ) {
      variantGroups.forEach(group => {
        const { name, variantGroupType, element } = group;
        const isChangedGroup = name === lastChangedGroup;
        const lastChangedValueTrim =
          typeof lastChangedValue === "string" ? lastChangedValue.trim() : lastChangedValue;

        if (variantGroupType === "select") {
          const selectEl =
            element.querySelector(`select[${RENDERED_ATTR}="1"]`) ||
            element.querySelector("select");
          if (!selectEl) return;

          const options = Array.from(selectEl.options);
          const unavailableText = config.selectUnavailableLabel
            ? ` (${config.selectUnavailableLabel})`
            : "";

          options.forEach(opt => {
            if (!opt.value) return;

            const optValue = typeof opt.value === "string" ? opt.value.trim() : opt.value;
            const candidate = { ...selectedProductVariants, [name]: optValue };

            const matchingVariants = getAvailableProductsPerVariantSelection(candidate);
            const canExist = Array.isArray(matchingVariants) && matchingVariants.length > 0;

            const isLastSelected = isChangedGroup && optValue === lastChangedValueTrim;

            if (!canExist && !isLastSelected) {
              opt.classList.add(disableOptionClass);
              if (unavailableText && !opt.textContent.includes(unavailableText)) {
                opt.textContent += unavailableText;
              }
            } else {
              opt.classList.remove(disableOptionClass);
              if (unavailableText && opt.textContent.includes(unavailableText)) {
                opt.textContent = opt.textContent.replace(unavailableText, "");
              }
            }
          });
        } else if (variantGroupType === "radio") {
          const radios = element.querySelectorAll(
            `input[type='radio'][${foxy_variant_group_name}]`,
          );
          radios.forEach(radio => {
            if (!radio.value) return;

            const radioValue = typeof radio.value === "string" ? radio.value.trim() : radio.value;
            const candidate = { ...selectedProductVariants, [name]: radioValue };

            const matchingVariants = getAvailableProductsPerVariantSelection(candidate);
            const canExist = Array.isArray(matchingVariants) && matchingVariants.length > 0;

            const isLastSelected = isChangedGroup && radioValue === lastChangedValueTrim;

            if (!canExist && !isLastSelected) {
              radio.parentElement.classList.add(disableClass);
            } else {
              radio.parentElement.classList.remove(disableClass);
            }
          });
        }
      });
    }

    function updateProductInfo(availableProductsPerVariant, selectedProductVariants) {
      const isVariantsSelectionDone = isVariantsSelectionComplete();

      log.debug("updateProductInfo()", {
        selectionComplete: isVariantsSelectionDone,
        selected: selectedProductVariants,
        availableCount: Array.isArray(availableProductsPerVariant)
          ? availableProductsPerVariant.length
          : 0,
      });

      if (isVariantsSelectionDone) {
        variantSelectionCompleteProduct = availableProductsPerVariant.find(product => {
          return Object.keys(selectedProductVariants).every(
            key => product[key] === selectedProductVariants[key],
          );
        });

        if (!variantSelectionCompleteProduct) {
          log.warn("selection complete but no matching variant found", {
            selected: selectedProductVariants,
          });
          return;
        }

        log.info("final variant matched", {
          code: variantSelectionCompleteProduct.code,
          price: variantSelectionCompleteProduct.price,
          inventory: variantSelectionCompleteProduct.inventory,
        });

        Object.keys(variantSelectionCompleteProduct).forEach(key => {
          const inputToUpdate = foxyForm.querySelector(`input[type='hidden'][name="${key}"]`);
          if (inputToUpdate) {
            inputToUpdate.value = variantSelectionCompleteProduct[key];
            log.verbose("hidden input updated", {
              key,
              value: variantSelectionCompleteProduct[key],
            });
          }

          const foxyElement = container.querySelector(`[foxy-id="${key}"]`);
          const restrictedMatch = ["inventory", "price", "image"].includes(key);

          if (foxyElement && !restrictedMatch) {
            foxyElement.textContent = variantSelectionCompleteProduct[key];
          }

          switch (key) {
            case "inventory":
              if (!config.inventoryControl) break;

              const qMax = foxyForm.querySelector(`input[name="quantity_max"]`);
              if (qMax) qMax.value = variantSelectionCompleteProduct[key];

              quantityElement?.setAttribute("max", variantSelectionCompleteProduct[key]);
              setInventory(isVariantsSelectionDone);
              break;

            case "price": {
              if (priceElement) {
                priceElement.textContent = moneyFormat(
                  config.defaultLocale,
                  config.defaultCurrency,
                  variantSelectionCompleteProduct[key],
                );
              }

              if (priceAddToCart) {
                const numericValue = parseFloat(variantSelectionCompleteProduct[key]);
                let decimalPlaces = String(numericValue).includes(".")
                  ? String(numericValue).split(".")[1].length
                  : 0;

                if (config.pricePrecision && config.pricePrecision > decimalPlaces) {
                  decimalPlaces = config.pricePrecision;
                }

                priceAddToCart.value = parseFloat(variantSelectionCompleteProduct[key]).toFixed(
                  decimalPlaces,
                );
              }
              break;
            }

            case "image":
              if (imageElement) {
                const currentSrc = imageElement.getAttribute("src");
                const newSrc = variantSelectionCompleteProduct[key];
                if (currentSrc !== newSrc) {
                  imageElement.setAttribute("srcset", "");
                  imageElement.setAttribute("src", newSrc);
                }
              }
              break;
          }
        });

        return;
      }

      // Not complete
      addPrice();
      setInventory();
    }

    function isVariantsSelectionComplete() {
      // Only consider rendered controls (ignore hidden templates we disabled)
      const invalid = foxyForm.querySelectorAll(
        `div[${foxy_variant_group}] [${RENDERED_ATTR}="1"][required]:invalid,
         div[${foxy_variant_group}] select[${RENDERED_ATTR}="1"][required]:invalid,
         div[${foxy_variant_group}] input[type="radio"][${foxy_variant_group_name}][required]:invalid`,
      );

      return invalid.length === 0;
    }

    function moneyFormat(locale, currency, number) {
      const numericValue = parseFloat(number);
      let decimalPlaces = String(numericValue).includes(".")
        ? String(numericValue).split(".")[1].length
        : 0;

      if (config.pricePrecision && config.pricePrecision > decimalPlaces) {
        decimalPlaces = config.pricePrecision;
      }

      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(numericValue);
    }

    function sanitize(string) {
      if (typeof string !== "string") return string;
      return string.trim().toLowerCase();
    }

    function filterEmpty(obj) {
      return Object.entries(obj).reduce((a, [k, v]) => (v ? ((a[k] = v), a) : a), {});
    }

    // Access to methods
    return {
      init,
      destroy,
      setConfig: cfg => setConfig(config, cfg),
      getConfig: () => ({ ...config }),
      _log: log, // optional: expose logger for debugging
    };
  }

  function getCartActionFromTriggerEl(el) {
    if (!(el instanceof Element)) return null;

    const trigger = el.closest?.(
      'input[foxy-id="add-to-cart"], input[foxy-id="buy-it-now"], button[foxy-id="add-to-cart"], button[foxy-id="buy-it-now"]',
    );
    if (!trigger) return null;

    const foxyId = trigger.getAttribute("foxy-id");
    if (foxyId === "add-to-cart") return "add";
    if (foxyId === "buy-it-now") return "checkout";
    return null;
  }

  function applyCartActionToForm(form, action) {
    if (!form || !action) return;

    const cartInput = form.querySelector('input[name="cart"]');
    if (!cartInput) return;

    cartInput.value = action;
    log.debug("cart action set", { action, form: describeEl(form) });
  }

  //init for regular sites
  function init(cfg) {
    const instance = setVariantConfig(cfg);
    instance.init();
    return instance;
  }

  // ---------- SPA / builder auto-init ----------
  // Scans for forms and initializes them. Useful when routing doesn't reload the page.
  function variantsAutoInit(cfg) {
    const controllerId = ++__foxyVariantInstanceSeq;
    const tmpCfg = {
      debug: false,
      debugLevel: "info",
      debugPrefix: "FoxyVariants",
      debugGroupCollapsed: true,
      syncOnAnyChange: true, // schedule sync on any form change
      persistSelection: true,
      persistSelectionKey: ({ pageKey, productKey }) => `foxyVariants:sel:${pageKey}:${productKey}`,
      ...cfg,
    };

    const log = createLogger(tmpCfg, { instanceId: controllerId, scope: "auto" });

    const initializedForms = new WeakSet();
    const instancesByForm = new WeakMap();

    // Per-form observer
    const variantGroupObserverByForm = new WeakMap();

    let scanScheduled = false;
    let stopped = false;

    // If true, next scan will re-init even if already initialized.
    let forceNextScan = false;

    // Find forms to init. Prefer [data-foxy-product="form"], but also allow [foxy-id="form"].
    const getForms = () => {
      const forms = new Set();
      document.querySelectorAll('[data-foxy-product="form"]').forEach(f => forms.add(f));
      document.querySelectorAll('[foxy-id="form"]').forEach(f => forms.add(f));
      return Array.from(forms).filter(n => n instanceof Element);
    };

    const attachVariantGroupObserver = form => {
      if (!(form instanceof Element)) return;
      if (variantGroupObserverByForm.has(form)) return;

      const observer = new MutationObserver(mutations => {
        // Re-init if a node with data-foxy-variant-group is removed (or contains one)
        const isVariantGroupRemoved = mutations.some(mutation =>
          Array.from(mutation.removedNodes).some(
            node =>
              node instanceof HTMLElement &&
              (node.hasAttribute("data-foxy-variant-group") ||
                node.querySelector?.("[data-foxy-variant-group]")),
          ),
        );

        if (isVariantGroupRemoved) {
          log.debug("variant group removed -> force rescan");
          scheduleScan({ force: true });
        }
      });

      observer.observe(form, { subtree: true, childList: true });
      variantGroupObserverByForm.set(form, observer);
    };

    const scan = () => {
      if (stopped) return;
      scanScheduled = false;

      const forms = getForms();
      log.debug("scan()", { forms: forms.length, forceNextScan });

      forms.forEach(form => {
        attachVariantGroupObserver(form);

        const shouldSkip = initializedForms.has(form) && !tmpCfg.forceReinit && !forceNextScan;

        if (shouldSkip) return;

        const container = form.closest?.('[foxy-id="container"]') || document;

        const instance = setVariantConfig({
          ...tmpCfg,
          container,
        });

        // Ensure we init the specific form we found
        const found = container.querySelector('[data-foxy-product="form"], [foxy-id="form"]');
        if (found !== form) {
          instance.setConfig({ container: form.parentElement || container });
        }

        instance.init();
        initializedForms.add(form);
        instancesByForm.set(form, instance);
      });

      forceNextScan = false;
    };

    const scheduleScan = ({ force = false } = {}) => {
      if (stopped) return;
      if (force) forceNextScan = true;
      if (scanScheduled) return;

      scanScheduled = true;
      setTimeout(scan, 0);
    };

    // Global observer: kicks scans when a form appears/re-renders in the DOM
    const mo = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (!(n instanceof Element)) continue;

          // If a form (or something containing it) is added, rescan
          if (
            n.matches?.('[data-foxy-product="form"], [foxy-id="form"]') ||
            n.querySelector?.('[data-foxy-product="form"], [foxy-id="form"]')
          ) {
            log.debug("form added -> force scan");
            scheduleScan({ force: true });
            return;
          }
        }

        // Optional: if a form is removed, force scan as well (helps in some SPAs)
        for (const n of m.removedNodes) {
          if (!(n instanceof Element)) continue;
          if (
            n.matches?.('[data-foxy-product="form"], [foxy-id="form"]') ||
            n.querySelector?.('[data-foxy-product="form"], [foxy-id="form"]')
          ) {
            log.debug("form removed -> force scan");
            scheduleScan({ force: true });
            return;
          }
        }
      }
    });

    // URL observer: re-init on SPA pathname change
    let previousUrl = location.pathname;
    const urlObserver = new MutationObserver(() => {
      if (location.pathname !== previousUrl) {
        previousUrl = location.pathname;
        log.debug("pathname changed -> force scan", { pathname: previousUrl });
        scheduleScan({ force: true });
      }
    });
    urlObserver.observe(document.body, { subtree: true, childList: true });

    mo.observe(document.documentElement, { subtree: true, childList: true });

    // initial scan
    scheduleScan({ force: true });

    return {
      rescan: () => scheduleScan({ force: true }),
      stop: () => {
        stopped = true;

        try {
          mo.disconnect();
        } catch (_) {}
        try {
          urlObserver.disconnect();
        } catch (_) {}

        // Disconnect per-form observers
        try {
          getForms().forEach(form => {
            const o = variantGroupObserverByForm.get(form);
            if (o) o.disconnect();
          });
        } catch (_) {}

        log.info("auto-init stopped");
      },
      getInstanceForForm: formEl => instancesByForm.get(formEl),
    };
  }

   // ---------- Logging helpers ----------
  function describeEl(el) {
    try {
      if (!(el instanceof Element)) return null;
      const id = el.id ? `#${el.id}` : "";
      const cls =
        el.classList && el.classList.length
          ? `.${Array.from(el.classList).slice(0, 3).join(".")}`
          : "";
      const foxyId = el.getAttribute("foxy-id");
      const attr = foxyId ? `[foxy-id="${foxyId}"]` : "";
      return `<${el.tagName.toLowerCase()}${id}${cls}>${attr}`;
    } catch (_) {
      return null;
    }
  }

  function createLogger(cfg, ctx) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3, verbose: 4 };
    const levelName = String(cfg.debugLevel || "info").toLowerCase();
    const threshold = cfg.debug ? (levels[levelName] ?? 2) : 1; // debug=false => warn+error only

    const prefix = cfg.debugPrefix || "FoxyVariants";
    const instance = ctx && ctx.instanceId != null ? `#${ctx.instanceId}` : "";
    const scope = ctx && ctx.scope ? ` ${ctx.scope}` : "";
    const head = `[${prefix}${instance}${scope}]`;

    const emit = (lvl, msg, data) => {
      const n = levels[lvl];
      if (n == null || n > threshold) return;

      const entry = { level: lvl, msg, data, ctx, ts: Date.now() };
      if (typeof cfg.onLog === "function") {
        try {
          cfg.onLog(entry);
        } catch (_) {}
      }

      const fn =
        lvl === "error"
          ? console.error
          : lvl === "warn"
            ? console.warn
            : lvl === "info"
              ? console.info
              : console.log;

      if (data !== undefined) fn(head, msg, data);
      else fn(head, msg);
    };

    const group = (title, data) => {
      if (!cfg.debug) return;
      if ((levels.debug ?? 3) > threshold) return;

      const g = cfg.debugGroupCollapsed ? console.groupCollapsed : console.group;
      if (data !== undefined) g(`${head} ${title}`, data);
      else g(`${head} ${title}`);
    };

    const groupEnd = () => {
      if (!cfg.debug) return;
      if ((levels.debug ?? 3) > threshold) return;
      console.groupEnd();
    };

    return {
      error: (m, d) => emit("error", m, d),
      warn: (m, d) => emit("warn", m, d),
      info: (m, d) => emit("info", m, d),
      debug: (m, d) => emit("debug", m, d),
      verbose: (m, d) => emit("verbose", m, d),
      group,
      groupEnd,
    };
  }
  
  // Function factory to handle several instances
  return {
    setVariantConfig,
    init,
    variantsAutoInit,
  };
})(FC, Weglot);
