var FC = FC || {};
var foxySubdomain = foxySubdomain || "";
const existingOnLoadAuctionInc = typeof FC.onLoad == "function" ? FC.onLoad : function () {};

FC.onLoad = function () {
  existingOnLoadAuctionInc();

  FC.client.on("ready.done", () => {
    const cartUrl = foxySubdomain
      ? `${foxySubdomain}/cart`
      : `https://${FC?.settings?.storedomain}/cart`;

    /**
     * Logs debug info to console if ?debugai2f=1 is in the URL or global flag is set
     * @param {string} msg - Message to log
     * @param {...any} args - Additional arguments
     */
    function debugLog(msg, ...args) {
      const urlDebug = new URLSearchParams(window.location.search).get("debugai2f") === "1";
      const isEnabled = window.__DEBUG_AUCTIONINC_TO_FOXY__ || urlDebug;
      if (isEnabled) console.log("[AI2F]", msg, ...args);
    }

    // AuctionInc input name -> Foxy product param name. Fields not listed
    // here have no Foxy equivalent and are preserved/passed through as-is.
    const inputNameMap = {
      item_name: "name",
      item_number: "code",
      amount: "price",
      quantity: "quantity",
    };

    /**
     * Combine AuctionInc weight_lbs + weight_oz into a single Foxy decimal weight (lbs).
     * Empty/NaN treated as 0. e.g. (3, 6) -> 3.38
     */
    function lbsOzToWeight(lbs, oz) {
      const l = parseFloat(lbs);
      const o = parseFloat(oz);
      const total = (isNaN(l) ? 0 : l) + (isNaN(o) ? 0 : o) / 16;
      return Math.round(total * 100) / 100;
    }

    /**
     * Convert an AuctionInc option label into a safe Foxy option field name.
     * "Make, Model & Year." -> "Make_Model_Year"
     */
    function sanitizeOptionName(raw) {
      return String(raw || "")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_") || "option";
    }

    function processAddToCartForm(form, cartUrl) {
      // 1. Translate weight_lbs + weight_oz into Foxy's `weight` field (their
      //    Foxy match), then remove the source fields since they've been mapped.
      const lbsInput = form.querySelector('input[name="weight_lbs"]');
      const ozInput = form.querySelector('input[name="weight_oz"]');
      const weight = lbsOzToWeight(lbsInput?.value, ozInput?.value);
      if (lbsInput) lbsInput.remove();
      if (ozInput) ozInput.remove();

      // 2. Convert on{N}/os{N} option pairs into Foxy custom options
      form.querySelectorAll('input[name^="on"]').forEach((onInput) => {
        const idx = onInput.name.slice(2);
        if (!/^\d+$/.test(idx)) return;
        const osInput = form.querySelector(`[name="os${idx}"]`);
        if (!osInput) {
          onInput.remove(); // drop orphan label with no matching value field
          return;
        }
        osInput.name = sanitizeOptionName(onInput.value);
        onInput.remove();
        debugLog("Converted option", `on${idx}/os${idx}`, "->", osInput.name);
      });

      // Drop any orphan os{N} value fields that had no matching on{N} label
      form
        .querySelectorAll('input[name^="os"]')
        .forEach((el) => { if (/^os\d+$/.test(el.name)) el.remove(); });

      // 3. Map fields that have a Foxy equivalent; preserve everything else
      //    (all other AuctionInc fields are passed through to Foxy unchanged).
      form.querySelectorAll("input, select, textarea").forEach((el) => {
        if (!el.name) return;
        if (inputNameMap.hasOwnProperty(el.name)) el.name = inputNameMap[el.name];
      });

      // 4. Inject combined weight
      if (weight > 0 && !form.querySelector('input[name="weight"]')) {
        const w = document.createElement("input");
        w.type = "hidden"; w.name = "weight"; w.value = weight;
        form.appendChild(w);
      }

      // 5. Guarantee a name (Foxy requires it); fall back to code
      if (!form.querySelector('input[name="name"]')) {
        const code = form.querySelector('input[name="code"]');
        if (code) {
          const n = document.createElement("input");
          n.type = "hidden"; n.name = "name"; n.value = code.value;
          form.appendChild(n);
        }
      }

      // 6. Point the form at Foxy
      form.action = cartUrl;
      debugLog("Rewrote add-to-cart form", form);
    }

    function processViewCartForm(form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        debugLog("View-cart intercepted -> opening sidecart");
        FC.client.event("cart-toggle").trigger();
      });
    }

    const forms = document.querySelectorAll('form[action*="auctioninc.com"]');

    forms.forEach((form) => {
      const isAddToCart =
        form.querySelector('input[name="amount"], input[name="item_name"]') !== null;
      const isViewCart = form.querySelector('input[name="viewcart_btn"]') !== null;

      if (isAddToCart) {
        processAddToCartForm(form, cartUrl);
      } else if (isViewCart) {
        processViewCartForm(form);
      } else {
        debugLog("Skipping unrecognized AuctionInc form", form);
      }
    });
  });
};
