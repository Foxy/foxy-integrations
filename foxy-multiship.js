/**
 * FoxyCart Multiship 
 *
 * HTML requirements:
 * 
 *   <div class="shipto_select" style="display:none">
 *     <select name="x:shipto_name_select"></select>
 *   </div>
 *   <div class="shipto_name">
 *     <input type="text" name="shipto" value="" />
 *   </div>
 *
 * Include this file AFTER foxycart.loader.js.
 */
(function () {
  "use strict";

  // ── Storage helpers ──────────────────────────────────────────────
  const STORAGE_KEY_NAMES = "shipto_names";
  const STORAGE_KEY_RECENT = "shipto_name_recent";

  function getShiptoArray() {
    const raw = localStorage.getItem(STORAGE_KEY_NAMES);
    if (!raw) return [];
    // Split on the same delimiter the original used, deduplicate, sort
    const arr = [...new Set(raw.split("||").filter(Boolean))];
    arr.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    return arr;
  }

  function saveShiptoArray(arr) {
    localStorage.setItem(STORAGE_KEY_NAMES, arr.join("||"));
  }

  function getRecentShipto() {
    return localStorage.getItem(STORAGE_KEY_RECENT) || "";
  }

  function saveRecentShipto(name) {
    localStorage.setItem(STORAGE_KEY_RECENT, name);
  }

  // ── Core functions ───────────────────────────────────────────────

  /**
   * Show the select dropdown containers, hide the "new name" text inputs,
   * and clear their values so we start fresh.
   */
  function shiptoInitialize() {
    document.querySelectorAll("div.shipto_select").forEach(el => {
      el.style.display = "";
    });
    document.querySelectorAll("div.shipto_name").forEach(el => {
      el.style.display = "none";
      const input = el.querySelector("input");
      if (input) input.value = "";
    });
  }

  /**
   * Build the <option> list inside every div.shipto_select <select>,
   * wire up the change handler, and restore the last-used selection.
   */
  function shiptoSelect() {
    const names = getShiptoArray();

    document.querySelectorAll("div.shipto_select select").forEach(sel => {
      // Clear existing options
      sel.innerHTML = "";

      // "Me" is always first
      sel.appendChild(makeOption("Me", "Me"));

      // Previously stored recipients
      names.forEach(name => {
        if (name && name !== "Me") {
          sel.appendChild(makeOption(name, name));
        }
      });

      // "Add a new recipient…" sentinel
      sel.appendChild(makeOption("Add a new recipient\u2026", ""));

      // ── Change handler ────────────────────────────────────────
      sel.addEventListener("change", () => {
        const form = sel.closest("form");
        if (!form) return;

        const shiptoNameDiv = form.querySelector("div.shipto_name");
        const shiptoInput = form.querySelector("div.shipto_name input");

        if (sel.value === "") {
          // "Add a new recipient…" selected → show the text input
          if (shiptoNameDiv) shiptoNameDiv.style.display = "";
          if (shiptoInput) {
            shiptoInput.value = "";
            shiptoInput.focus();
          }
        } else {
          // Known recipient selected → hide text input, push value
          if (shiptoNameDiv) shiptoNameDiv.style.display = "none";
          if (shiptoInput) shiptoInput.value = sel.value;

          // Sync every shipto input inside this form
          // (handles multi-product forms)
          form.querySelectorAll('input[name*="shipto"]').forEach(inp => {
            inp.value = sel.value;
          });
        }
      });
    });

    // Restore last-used selection across all selects
    const recent = getRecentShipto();
    document.querySelectorAll("div.shipto_select select").forEach(sel => {
      const target = recent || "Me";
      // Only set if the value exists in the options
      if (sel.querySelector('option[value="' + CSS.escape(target) + '"]')) {
        sel.value = target;
      } else {
        sel.value = "Me";
      }
      // Trigger the handler so hidden inputs get synced
      sel.dispatchEvent(new Event("change"));
    });
  }

  /**
   * Keep all shipto inputs within a single form in sync when any of
   * them change (covers forms with multiple product rows).
   */
  function shiptoMultiples() {
    document.querySelectorAll('input[name*="shipto"]').forEach(input => {
      input.addEventListener("change", () => {
        const form = input.closest("form");
        if (!form) return;
        form.querySelectorAll('input[name*="shipto"]').forEach(sib => {
          sib.value = input.value;
        });
      });
    });
  }

  /**
   * Persist the chosen shipto name into localStorage.
   * Called on every successful cart-submit via FC events.
   */
  function persistShipto(shiptoValue) {
    if (!shiptoValue) return;

    // Save as most-recent
    saveRecentShipto(shiptoValue);

    // Append to the stored array (if new)
    const arr = getShiptoArray();
    if (!arr.includes(shiptoValue)) {
      arr.push(shiptoValue);
      saveShiptoArray(arr);
    }
  }

  // ── Tiny helper ──────────────────────────────────────────────────
  function makeOption(text, value) {
    const opt = document.createElement("option");
    opt.textContent = text;
    opt.value = value;
    return opt;
  }

  // ── Bootstrap ────────────────────────────────────────────────────

  function init() {
    shiptoInitialize();
    shiptoSelect();
    shiptoMultiples();
  }

  // ── SPA-aware MutationObserver ───────────────────────────────────
  // Watches for shipto containers being added to the DOM (e.g. after
  // a framework re-render) and re-runs init with a debounce so rapid
  // sequential mutations don't fire it dozens of times.

  let debounceTimer = null;
  const DEBOUNCE_MS = 150;

  /**
   * Returns true when at least one div.shipto_select exists in the DOM
   * but has NOT yet been populated with <option> elements by this script.
   */
  function needsInit() {
    const selects = document.querySelectorAll("div.shipto_select select");
    if (selects.length === 0) return false;
    // If any select is empty it means a re-render wiped our options
    return [...selects].some(sel => sel.options.length === 0);
  }

  function startObserver() {
    const observer = new MutationObserver(() => {
      if (!needsInit()) return;
      // Debounce: wait for the framework to finish flushing DOM changes
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        init();
      }, DEBOUNCE_MS);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // ── FC 2.0 async bootstrap ──────────────────────────────────────
  // FC may not exist yet when this file loads
  const FC = (window.FC = window.FC || {});

  FC.onLoad = function () {
    FC.client.on("ready.done", () => {
      init();
      startObserver();
    });

    // Persist the shipto value on every cart add
    FC.client.on("cart-submit.done", params => {
      const shipto = params?.data?.shipto || "";
      if (shipto) {
        persistShipto(shipto);
      }
    });
  };

  // Fallback: if FC never fires (e.g. testing outside Foxy),
  // still init on DOMContentLoaded so the UI isn't stuck hidden.
  document.addEventListener("DOMContentLoaded", () => {
    // Give FC.onLoad a moment to run first
    setTimeout(() => {
      if (!document.querySelector("div.shipto_select select option")) {
        init();
        startObserver();
      }
    }, 1500);
  });
})();
