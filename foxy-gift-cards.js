/**
 * FoxyGiftCard.js
 * A configurable gift card form component for Foxy Cart stores.
 *
 * Usage:
 *   <div id="gift-card-form"></div>
 *   <script src="foxy-giftcard.js"></script>
 *   <script>
 *     FoxyGiftCard.init({
 *       el: '#gift-card-form',
 *       store: 'foxythreads-webstudio',
 *     });
 *   </script>
 */
(function (root, factory) {
  if (typeof define === "function" && define.amd) define([], factory);
  else if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FoxyGiftCard = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ────────────────────────────────────────────────────────
  // DEFAULT CONFIG
  // ────────────────────────────────────────────────────────
  var DEFAULTS = {
    // Mount point (CSS selector or DOM element)
    el: "#foxy-giftcard",

    // Foxy Cart store subdomain (e.g. 'mystore' → mystore.foxycart.com/cart)
    store: "",

    // Full cart URL override — takes priority over `store` if set
    cartUrl: "",

    // Product hidden fields sent to Foxy
    productName: "Gift Card",
    codePrefix: "gift_card",
    category: "gift_card",

    // Currency symbol shown in buttons and custom input
    currency: "$",

    // Predefined amounts shown as selectable buttons
    amounts: [50, 100, 150, 200, 300, 500],

    // Which amount gets a "Popular" badge (null to disable)
    popularAmount: 100,

    // Pre-selected amount on load
    defaultAmount: 50,

    // Allow a freeform custom amount input
    allowCustomAmount: true,
    customAmountMin: 1,
    customAmountMax: 10000,

    // Show the Myself / Someone else toggle
    showRecipientToggle: true,
    recipientOptions: ["Myself", "Someone else"],

    // Show the optional message textarea for "someone else"
    showMessageField: true,

    // Submit button label
    submitText: "Add to Cart",

    // Visual theme — every property is optional to override
    theme: {
      accent: "#3c9c9e",
      accentDark: "#2d7a7c",
      accentSubtle: "rgb(60 156 158 / 0.09)",
      text: "#1a1a1a",
      textMedium: "#4a4a4a",
      textLight: "#888",
      border: "#e5e2dd",
      highlight: "#c8956c",
      surface: "#ffffff",
      radius: "16px",
      radiusSmall: "10px",
      fontFamily:
        "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    },

    // Callbacks
    onBeforeSubmit: null, // function(formData) → return false to cancel
    onAmountChange: null, // function(amount, isCustom)
    onRecipientChange: null, // function('myself' | 'someone-else')
  };

  // ────────────────────────────────────────────────────────
  // HELPERS
  // ────────────────────────────────────────────────────────
  function merge(target, source) {
    var out = {};
    for (var k in target) if (target.hasOwnProperty(k)) out[k] = target[k];
    for (var k in source)
      if (source.hasOwnProperty(k)) {
        if (
          source[k] &&
          typeof source[k] === "object" &&
          !Array.isArray(source[k]) &&
          target[k] &&
          typeof target[k] === "object" &&
          !Array.isArray(target[k])
        ) {
          out[k] = merge(target[k], source[k]);
        } else {
          out[k] = source[k];
        }
      }
    return out;
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }
  function $$(sel, ctx) {
    return [].slice.call((ctx || document).querySelectorAll(sel));
  }

  // ────────────────────────────────────────────────────────
  // ICONS
  // ────────────────────────────────────────────────────────
  var ICON_PERSON =
    '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6" r="3.5" stroke="currentColor" stroke-width="1.5"/><path d="M3 17.5c0-3.5 3-6 7-6s7 2.5 7 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  var ICON_PEOPLE =
    '<svg viewBox="0 0 20 20" fill="none"><path d="M14.5 17.5c0-2.5-2-4.5-5-4.5s-5 2-5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="9.5" cy="7.5" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M13 9a2.5 2.5 0 100-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M15 13c1.5.5 2.5 1.8 2.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  // ────────────────────────────────────────────────────────
  // STYLESHEET
  // ────────────────────────────────────────────────────────
  function buildStyles(cfg, scope) {
    var t = cfg.theme;
    var s = "." + scope;

    return [
      // ── Base reset & font ──
      s + " *, " + s + " *::before, " + s + " *::after {",
      "  margin:0; padding:0; box-sizing:border-box;",
      "}",
      s + " {",
      "  font-family: " + t.fontFamily + ";",
      "  color: " + t.text + ";",
      "  line-height: 1.6;",
      "  -webkit-font-smoothing: antialiased;",
      "}",

      // ── Card wrapper — outer border, padding, and entrance animation ──
      s + " .gc-form-card {",
      "  max-width: 560px;",
      "  margin: 0 auto;",
      "  background: " + t.surface + ";",
      "  border: 2px solid " + t.border + ";",
      "  border-radius: " + t.radius + ";",
      "  padding: 40px 36px 36px;",
      "  position: relative;",
      "  animation: gcSlideIn .5s ease forwards;",
      "  opacity: 0;",
      "  transition: border-color .3s, box-shadow .3s;",
      "}",
      s + " .gc-form-card:hover {",
      "  border-color: #ccc;",
      "  box-shadow: 0 8px 32px rgba(0,0,0,.06);",
      "}",

      // ── Amount buttons grid — 3-column layout for preset prices ──
      s + " .gc-amount-grid {",
      "  display: grid;",
      "  grid-template-columns: repeat(3, 1fr);",
      "  gap: 10px;",
      "  margin-bottom: 8px;",
      "}",

      // ── Individual amount button — border highlight on hover/select ──
      s + " .gc-amount-button {",
      "  position: relative;",
      "  padding: 14px 8px;",
      "  border: 2px solid " + t.border + ";",
      "  border-radius: " + t.radiusSmall + ";",
      "  background: " + t.surface + ";",
      "  font-family: " + t.fontFamily + ";",
      "  font-size: 16px;",
      "  font-weight: 600;",
      "  color: " + t.text + ";",
      "  cursor: pointer;",
      "  transition: all .2s;",
      "  text-align: center;",
      "}",
      s + " .gc-amount-button:hover {",
      "  border-color: " + t.accent + ";",
      "  background: " + t.accentSubtle + ";",
      "}",

      // ── Selected state for amount button — accent border + ring ──
      s + " .gc-amount-button--selected {",
      "  border-color: " + t.accent + ";",
      "  background: " + t.accentSubtle + ";",
      "  color: " + t.accentDark + ";",
      "  box-shadow: 0 0 0 1px " + t.accent + ";",
      "}",

      // ── "Popular" badge floating above an amount button ──
      s + " .gc-amount-popular-tag {",
      "  position: absolute;",
      "  top: -9px;",
      "  right: 10px;",
      "  font-size: 9px;",
      "  font-weight: 700;",
      "  letter-spacing: .06em;",
      "  text-transform: uppercase;",
      "  background: " + t.highlight + ";",
      "  color: " + t.surface + ";",
      "  padding: 2px 8px;",
      "  border-radius: 100px;",
      "}",

      // ── Custom amount toggle — dashed border, turns solid when active ──
      s + " .gc-custom-toggle {",
      "  width: 100%;",
      "  padding: 14px 8px;",
      "  border: 2px dashed " + t.border + ";",
      "  border-radius: " + t.radiusSmall + ";",
      "  background: " + t.surface + ";",
      "  font-family: " + t.fontFamily + ";",
      "  font-size: 14px;",
      "  font-weight: 600;",
      "  color: " + t.textLight + ";",
      "  cursor: pointer;",
      "  transition: all .2s;",
      "  text-align: center;",
      "  margin-bottom: 8px;",
      "}",
      s + " .gc-custom-toggle:hover {",
      "  border-color: " + t.accent + ";",
      "  color: " + t.accent + ";",
      "}",
      s + " .gc-custom-toggle--selected {",
      "  border-style: solid;",
      "  border-color: " + t.accent + ";",
      "  background: " + t.accentSubtle + ";",
      "  color: " + t.accentDark + ";",
      "  box-shadow: 0 0 0 1px " + t.accent + ";",
      "}",

      // ── Custom amount input wrapper — hidden by default, shown on toggle ──
      s + " .gc-custom-input-wrapper {",
      "  position: relative;",
      "  display: none;",
      "}",
      s + " .gc-custom-input-wrapper--visible {",
      "  display: block;",
      "}",

      // ── Currency symbol inside the custom input ──
      s + " .gc-custom-currency-symbol {",
      "  position: absolute;",
      "  left: 16px;",
      "  top: 50%;",
      "  transform: translateY(-50%);",
      "  font-size: 15px;",
      "  font-weight: 600;",
      "  color: " + t.textLight + ";",
      "  pointer-events: none;",
      "}",
      s + " .gc-custom-input-wrapper .gc-text-input {",
      "  padding-left: 32px;",
      "}",

      // ── Horizontal divider between form sections ──
      s + " .gc-section-divider {",
      "  height: 1px;",
      "  background: " + t.border + ";",
      "  margin: 24px 0;",
      "}",

      // ── Form field group — label + input pair, collapsible ──
      s + " .gc-form-field {",
      "  margin-bottom: 18px;",
      "}",
      s + " .gc-form-field--hidden {",
      "  display: none;",
      "}",

      // ── Field label — small uppercase heading above each input ──
      s + " .gc-field-label {",
      "  display: block;",
      "  font-size: 13px;",
      "  font-weight: 700;",
      "  letter-spacing: .04em;",
      "  text-transform: uppercase;",
      "  color: " + t.textLight + ";",
      "  margin-bottom: 8px;",
      "}",

      // ── Inline lighter label text (e.g. "optional") ──
      s + " .gc-field-label-note {",
      "  font-weight: 400;",
      "  text-transform: none;",
      "  letter-spacing: 0;",
      "}",

      // ── Text input — single-line fields with focus ring ──
      s + " .gc-text-input {",
      "  width: 100%;",
      "  padding: 13px 16px;",
      "  font-family: " + t.fontFamily + ";",
      "  font-size: 15px;",
      "  color: " + t.text + ";",
      "  background: " + t.surface + ";",
      "  border: 2px solid " + t.border + ";",
      "  border-radius: " + t.radiusSmall + ";",
      "  transition: border-color .2s, box-shadow .2s;",
      "  outline: none;",
      "  -webkit-appearance: none;",
      "}",
      s + " .gc-text-input:focus {",
      "  border-color: " + t.accent + ";",
      "  box-shadow: 0 0 0 3px " + t.accentSubtle + ";",
      "}",
      s + " .gc-text-input::placeholder { color: #bbb; }",

      // ── Textarea — multi-line input for gift message ──
      s + " .gc-textarea {",
      "  width: 100%;",
      "  padding: 13px 16px;",
      "  font-family: " + t.fontFamily + ";",
      "  font-size: 15px;",
      "  color: " + t.text + ";",
      "  background: " + t.surface + ";",
      "  border: 2px solid " + t.border + ";",
      "  border-radius: " + t.radiusSmall + ";",
      "  transition: border-color .2s, box-shadow .2s;",
      "  outline: none;",
      "  min-height: 90px;",
      "  resize: vertical;",
      "}",
      s + " .gc-textarea:focus {",
      "  border-color: " + t.accent + ";",
      "  box-shadow: 0 0 0 3px " + t.accentSubtle + ";",
      "}",
      s + " .gc-textarea::placeholder { color: #bbb; }",

      // ── Recipient toggle row — flex container for pill buttons ──
      s + " .gc-recipient-toggle {",
      "  display: flex;",
      "  gap: 10px;",
      "}",

      // ── Recipient pill button — selectable option with icon ──
      s + " .gc-recipient-pill {",
      "  flex: 1;",
      "  padding: 12px 8px;",
      "  border: 2px solid " + t.border + ";",
      "  border-radius: " + t.radiusSmall + ";",
      "  background: " + t.surface + ";",
      "  font-family: " + t.fontFamily + ";",
      "  font-size: 14px;",
      "  font-weight: 600;",
      "  color: " + t.textMedium + ";",
      "  cursor: pointer;",
      "  transition: all .2s;",
      "  text-align: center;",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  gap: 8px;",
      "}",
      s + " .gc-recipient-pill:hover { border-color: #ccc; }",
      s + " .gc-recipient-pill svg { width:18px; height:18px; flex-shrink:0; }",

      // ── Selected state for recipient pill ──
      s + " .gc-recipient-pill--selected {",
      "  border-color: " + t.accent + ";",
      "  background: " + t.accentSubtle + ";",
      "  color: " + t.accentDark + ";",
      "  box-shadow: 0 0 0 1px " + t.accent + ";",
      "}",

      // ── Submit button — full-width accent CTA ──
      s + " .gc-submit-button {",
      "  display: block;",
      "  width: 100%;",
      "  padding: 16px 24px;",
      "  font-family: " + t.fontFamily + ";",
      "  font-size: 15px;",
      "  font-weight: 700;",
      "  letter-spacing: .02em;",
      "  text-transform: uppercase;",
      "  border: 2px solid " + t.accent + ";",
      "  border-radius: " + t.radiusSmall + ";",
      "  cursor: pointer;",
      "  transition: all .25s;",
      "  text-align: center;",
      "  background: " + t.accent + ";",
      "  color: " + t.surface + ";",
      "  margin-top: 8px;",
      "}",
      s + " .gc-submit-button:hover {",
      "  background: " + t.accentDark + ";",
      "  border-color: " + t.accentDark + ";",
      "  box-shadow: 0 4px 16px rgba(60,156,158,.3);",
      "}",

      // ── Entrance animation ──
      "@keyframes gcSlideIn {",
      "  from { opacity:0; transform:translateY(24px); }",
      "  to   { opacity:1; transform:translateY(0); }",
      "}",

      // ── Mobile: 2-column amount grid, tighter card padding ──
      "@media (max-width:480px) {",
      "  " + s + " .gc-amount-grid { grid-template-columns: repeat(2,1fr); }",
      "  " + s + " .gc-form-card { padding: 28px 20px 24px; }",
      "}",
    ].join("\n");
  }

  // ────────────────────────────────────────────────────────
  // HTML BUILDER
  // ────────────────────────────────────────────────────────
  function buildHTML(cfg, uid) {
    var action = cfg.cartUrl || "https://" + cfg.store + ".foxycart.com/cart";
    var h = "";

    h +=
      '<form class="gc-form-card" id="gc-form-' +
      uid +
      '" action="' +
      esc(action) +
      '" method="post" accept-charset="utf-8">';

    // Hidden Foxy fields
    h += '<input type="hidden" name="name" value="' + esc(cfg.productName) + '">';
    h +=
      '<input type="hidden" name="code" class="gc-hidden-code" value="' +
      esc(cfg.codePrefix + "_" + cfg.defaultAmount) +
      '">';
    h += '<input type="hidden" name="category" value="' + esc(cfg.category) + '">';
    h +=
      '<input type="hidden" name="price" class="gc-hidden-price" value="' +
      cfg.defaultAmount +
      '">';

    // ── Amount selection
    h += '<div class="gc-form-field">';
    h += '<label class="gc-field-label">Choose an amount</label>';
    h += '<div class="gc-amount-grid">';
    cfg.amounts.forEach(function (amt) {
      var sel = amt === cfg.defaultAmount ? " gc-amount-button--selected" : "";
      var pop =
        amt === cfg.popularAmount ? '<span class="gc-amount-popular-tag">Popular</span>' : "";
      h +=
        '<button type="button" class="gc-amount-button' +
        sel +
        '" data-amount="' +
        amt +
        '">' +
        pop +
        esc(cfg.currency) +
        amt +
        "</button>";
    });
    h += "</div>";

    if (cfg.allowCustomAmount) {
      h += '<button type="button" class="gc-custom-toggle">Enter a custom amount</button>';
      h += '<div class="gc-custom-input-wrapper">';
      h += '<span class="gc-custom-currency-symbol">' + esc(cfg.currency) + "</span>";
      h +=
        '<input type="number" class="gc-text-input gc-custom-amount-input" placeholder="Enter amount" min="' +
        cfg.customAmountMin +
        '" max="' +
        cfg.customAmountMax +
        '" step="1">';
      h += "</div>";
    }
    h += "</div>";

    h += '<div class="gc-section-divider"></div>';

    // ── Recipient toggle
    if (cfg.showRecipientToggle && cfg.recipientOptions.length === 2) {
      h += '<div class="gc-form-field">';
      h += '<label class="gc-field-label">Who is this for?</label>';
      h += '<div class="gc-recipient-toggle">';
      h +=
        '<button type="button" class="gc-recipient-pill gc-recipient-pill--selected" data-who="myself">' +
        ICON_PERSON +
        " " +
        esc(cfg.recipientOptions[0]) +
        "</button>";
      h +=
        '<button type="button" class="gc-recipient-pill" data-who="someone-else">' +
        ICON_PEOPLE +
        " " +
        esc(cfg.recipientOptions[1]) +
        "</button>";
      h += "</div></div>";
    }

    // ── Email
      h += '<div class="gc-form-field" data-field="email">';
      h += '<label class="gc-field-label" for="gc-email-' + uid + '">Recipient email</label>';
      h +=
        '<input type="email" class="gc-text-input" id="gc-email-' +
        uid +
        '" name="gift_recipient_email" placeholder="Where should we send the voucher?" required>';
      h += "</div>";

    // ── Someone-else fields
    h += '<div class="gc-form-field gc-form-field--hidden" data-field="shipto">';
    h += '<label class="gc-field-label">Recipient\'s name</label>';
    h +=
      '<input type="text" class="gc-text-input" name="shipto" placeholder="Who is receiving this gift?">';
    h += "</div>";

    h += '<div class="gc-form-field gc-form-field--hidden" data-field="from">';
    h += '<label class="gc-field-label">Your name</label>';
    h +=
      '<input type="text" class="gc-text-input" name="from" placeholder="Who is sending this gift?">';
    h += "</div>";

    if (cfg.showMessageField) {
      h += '<div class="gc-form-field gc-form-field--hidden" data-field="message">';
      h +=
        '<label class="gc-field-label">Message <span class="gc-field-label-note">(optional)</span></label>';
      h +=
        '<textarea class="gc-textarea" name="gift_recipient_message" placeholder="Add a personal note..."></textarea>';
      h += "</div>";
    }

    // ── Submit
    h += '<button type="submit" class="gc-submit-button">' + esc(cfg.submitText) + "</button>";
    h += "</form>";

    return h;
  }

  // ────────────────────────────────────────────────────────
  // EVENT BINDING
  // ────────────────────────────────────────────────────────
  function bindEvents(cfg, uid, root) {
    var form = $("#gc-form-" + uid, root);
    if (!form) return;

    var priceInput = $(".gc-hidden-price", form);
    var codeInput = $(".gc-hidden-code", form);
    var amountBtns = $$(".gc-amount-button", form);
    var custBtn = $(".gc-custom-toggle", form);
    var custWrap = $(".gc-custom-input-wrapper", form);
    var custInput = $(".gc-custom-amount-input", form);
    var pills = $$(".gc-recipient-pill", form);

    // ── Amount selection ──
    function selectAmount(amount) {
      if (custBtn) custBtn.classList.remove("gc-custom-toggle--selected");
      if (custWrap) custWrap.classList.remove("gc-custom-input-wrapper--visible");
      if (custInput) {
        custInput.removeAttribute("required");
        custInput.value = "";
      }

      amountBtns.forEach(function (b) {
        b.classList.remove("gc-amount-button--selected");
      });
      var match = amountBtns.filter(function (b) {
        return b.dataset.amount === String(amount);
      })[0];
      if (match) match.classList.add("gc-amount-button--selected");

      priceInput.value = amount;
      codeInput.value = cfg.codePrefix + "_" + amount;

      if (typeof cfg.onAmountChange === "function") cfg.onAmountChange(Number(amount), false);
    }

    amountBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectAmount(btn.dataset.amount);
      });
    });

    // ── Custom amount ──
    if (custBtn && custWrap && custInput) {
      custBtn.addEventListener("click", function () {
        amountBtns.forEach(function (b) {
          b.classList.remove("gc-amount-button--selected");
        });
        custBtn.classList.add("gc-custom-toggle--selected");
        custWrap.classList.add("gc-custom-input-wrapper--visible");
        custInput.setAttribute("required", "");
        custInput.focus();
        codeInput.value = cfg.codePrefix + "_custom";
      });

      custInput.addEventListener("input", function () {
        if (custInput.value && Number(custInput.value) > 0) {
          priceInput.value = custInput.value;
          if (typeof cfg.onAmountChange === "function")
            cfg.onAmountChange(Number(custInput.value), true);
        }
      });
    }

    // ── Recipient toggle ──
    var fieldShipto = $('[data-field="shipto"]', form);
    var fieldFrom = $('[data-field="from"]', form);
    var fieldMessage = $('[data-field="message"]', form);

    function setWho(who) {
      pills.forEach(function (p) {
        p.classList.remove("gc-recipient-pill--selected");
      });
      var match = pills.filter(function (p) {
        return p.dataset.who === who;
      })[0];
      if (match) match.classList.add("gc-recipient-pill--selected");

      var isSomeone = who === "someone-else";

      [fieldShipto, fieldFrom, fieldMessage].forEach(function (f) {
        if (f) f.classList.toggle("gc-form-field--hidden", !isSomeone);
      });

      [fieldShipto, fieldFrom].forEach(function (f) {
        if (!f) return;
        var inp = $("input", f);
        if (isSomeone) inp.setAttribute("required", "");
        else {
          inp.removeAttribute("required");
          inp.value = "";
        }
      });

      if (fieldMessage && !isSomeone) {
        var ta = $("textarea", fieldMessage);
        if (ta) ta.value = "";
      }

      if (typeof cfg.onRecipientChange === "function") cfg.onRecipientChange(who);
    }

    pills.forEach(function (pill) {
      pill.addEventListener("click", function () {
        setWho(pill.dataset.who);
      });
    });

    // ── Submit hook ──
    if (typeof cfg.onBeforeSubmit === "function") {
      form.addEventListener("submit", function (e) {
        var fd = new FormData(form);
        var data = {};
        fd.forEach(function (v, k) {
          data[k] = v;
        });
        if (cfg.onBeforeSubmit(data) === false) e.preventDefault();
      });
    }
  }

  // ────────────────────────────────────────────────────────
  // PUBLIC API
  // ────────────────────────────────────────────────────────
  var n = 0;

  return {
    /**
     * Mount a gift card form into the page.
     * @param  {Object} options  Config overrides.
     * @return {{ el: HTMLElement, destroy: Function }}
     */
    init: function (options) {
      var cfg = merge(DEFAULTS, options || {});
      var uid = "gc" + ++n;
      var scope = "fxgc-" + uid;

      var mountEl = typeof cfg.el === "string" ? document.querySelector(cfg.el) : cfg.el;
      if (!mountEl) {
        console.error("[FoxyGiftCard] Mount element not found:", cfg.el);
        return null;
      }

      // Inject scoped styles
      var style = document.createElement("style");
      style.id = "fxgc-css-" + uid;
      style.textContent = buildStyles(cfg, scope);
      document.head.appendChild(style);

      // Render
      mountEl.classList.add(scope);
      mountEl.innerHTML = buildHTML(cfg, uid);
      bindEvents(cfg, uid, mountEl);

      return {
        el: mountEl,
        destroy: function () {
          mountEl.innerHTML = "";
          mountEl.classList.remove(scope);
          var s = document.getElementById("fxgc-css-" + uid);
          if (s) s.remove();
        },
      };
    },
  };
});
