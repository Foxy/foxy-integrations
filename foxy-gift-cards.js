/**
 * FoxyGiftCard.js
 * A configurable gift card form component for Foxy Cart stores.
 *
 * Usage:
 *   <div id="gift-card-form"></div>
 *   <script src="foxy-giftcard.js"></script>
 *   <script>
 *     FoxyGiftCard.init({
 *       element: '#gift-card-form',
 *       subdomain: 'foxythreads-webstudio.foxycart.com',
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
  const DEFAULTS = {
    // Mount point (CSS selector or DOM element)
    element: "#foxy-giftcard",

    // Store domain — your Foxy subdomain or custom domain.
    // Examples: 'mystore.foxycart.com', 'shop.mybrand.com'
    // The library appends /cart automatically.
    subdomain: "",

    // Product hidden fields sent to Foxy
    productName: "Gift Card",
    codePrefix: "gift_card",
    category: "gift_card",

    // Main gift card SKU from the Foxy admin.
    // When set, the default product code becomes: {codePrefix}_{giftCardCode}
    // Individual amount overrides (see `amounts`) take priority.
    giftCardCode: "",

    // Template set code — if set, adds a hidden `template_set` input to the form.
    templateSet: "",

    // Currency symbol shown in buttons and custom input
    currency: "€",

    // Predefined amounts shown as selectable buttons.
    // Each entry can be:
    //   - A plain number:  100
    //   - A string with a code override:  '50{c:gift_card_50}'
    //     The number before the brace is the display amount,
    //     and the value inside {c:...} is the exact product code sent to Foxy.
    amounts: [50, 100, 150, 200, 300, 500],

    // Which amount gets a highlighted badge (null to disable)
    highlightedAmount: 100,

    // Pre-selected amount on load
    defaultAmount: 50,

    // Allow a freeform custom amount input
    allowCustomAmount: true,
    customAmountMin: 1,
    customAmountMax: 10000,

    // Show the Myself / Someone else toggle
    showRecipientToggle: true,

    // Show the optional message textarea for "someone else"
    showMessageField: true,

    // All user-facing strings — override any to localise or customise.
    labels: {
      // Amount section
      amountHeading: "Choose an amount",
      customAmountButton: "Enter a custom amount",
      customAmountPlaceholder: "Enter amount",
      highlightedBadge: "Popular",

      // Recipient section
      recipientHeading: "Who is this for?",
      recipientMyself: "Myself",
      recipientSomeoneElse: "Someone else",

      // Email
      emailLabel: "Recipient email",
      emailPlaceholder: "Where should we send the voucher?",

      // Someone-else fields
      shiptoLabel: "Recipient's name",
      shiptoPlaceholder: "Who is receiving this gift?",
      fromLabel: "Your name",
      fromPlaceholder: "Who is sending this gift?",
      messageLabel: "Message",
      messageLabelNote: "(optional)",
      messagePlaceholder: "Add a personal note...",

      // Submit
      submitText: "Add to Cart",
    },

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
    const out = {};
    for (const k in target) if (target.hasOwnProperty(k)) out[k] = target[k];
    for (const k in source)
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
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }
  function $$(sel, ctx) {
    return [...(ctx || document).querySelectorAll(sel)];
  }

  /**
   * Build a cart URL from the subdomain config.
   * Uses the URL Web API for safe, standards-based URL construction.
   * Accepts 'mystore.foxycart.com' or 'https://mystore.foxycart.com'.
   */
  function buildCartUrl(subdomain) {
    const raw = subdomain.replace(/\/+$/, "");
    const base = raw.startsWith("http") ? raw : "https://" + raw;
    const url = new URL("/cart", base);
    return url.href;
  }

  /**
   * Parse an amount entry.
   * Input can be a plain number (100) or a string with code override ('50{c:gift_card_50}').
   * Returns { amount: Number, codeOverride: String|null }
   */
  function parseAmount(entry) {
    if (typeof entry === "number") {
      return { amount: entry, codeOverride: null };
    }
    const str = String(entry);
    const match = str.match(/^(\d+(?:\.\d+)?)\{c:([^}]+)\}$/);
    if (match) {
      return { amount: parseFloat(match[1]), codeOverride: match[2] };
    }
    return { amount: parseFloat(str), codeOverride: null };
  }

  /**
   * Build the product code for a given amount.
   * Priority: amount codeOverride > codePrefix + giftCardCode > codePrefix + amount
   */
  function buildCode(cfg, amount, codeOverride) {
    if (codeOverride) return codeOverride;
    if (cfg.giftCardCode) return cfg.codePrefix + "_" + cfg.giftCardCode;
    return cfg.codePrefix + "_" + amount;
  }

  // ────────────────────────────────────────────────────────
  // ICONS
  // ────────────────────────────────────────────────────────
  const ICON_PERSON =
    '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6" r="3.5" stroke="currentColor" stroke-width="1.5"/><path d="M3 17.5c0-3.5 3-6 7-6s7 2.5 7 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const ICON_GIFT =
    '<svg viewBox="0 0 20 20" fill="none"><rect x="2" y="9" width="16" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="5" width="18" height="4" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M10 5v13" stroke="currentColor" stroke-width="1.5"/><path d="M10 5c0 0-1.5-1-3-2s-3.5-.5-3 1 2.5 2 6 1z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 5c0 0 1.5-1 3-2s3.5-.5 3 1-2.5 2-6 1z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ────────────────────────────────────────────────────────
  // STYLESHEET
  // ────────────────────────────────────────────────────────
  function buildStyles(cfg, scope) {
    const t = cfg.theme;
    const s = "." + scope;

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
      s + " .foxy-gc-form-card {",
      "  max-width: 560px;",
      "  margin: 0 auto;",
      "  background: " + t.surface + ";",
      "  border: 2px solid " + t.border + ";",
      "  border-radius: " + t.radius + ";",
      "  padding: 40px 36px 36px;",
      "  position: relative;",
      "  animation: foxyGcSlideIn .5s ease forwards;",
      "  opacity: 0;",
      "  transition: border-color .3s, box-shadow .3s;",
      "}",
      s + " .foxy-gc-form-card:hover {",
      "  border-color: #ccc;",
      "  box-shadow: 0 8px 32px rgba(0,0,0,.06);",
      "}",

      // ── Amount buttons grid — 3-column layout for preset prices ──
      s + " .foxy-gc-amount-grid {",
      "  display: grid;",
      "  grid-template-columns: repeat(3, 1fr);",
      "  gap: 10px;",
      "  margin-bottom: 8px;",
      "}",

      // ── Individual amount button — border highlight on hover/select ──
      s + " .foxy-gc-amount-button {",
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
      s + " .foxy-gc-amount-button:hover {",
      "  border-color: " + t.accent + ";",
      "  background: " + t.accentSubtle + ";",
      "}",

      // ── Selected state for amount button — accent border + ring ──
      s + " .foxy-gc-amount-button--selected {",
      "  border-color: " + t.accent + ";",
      "  background: " + t.accentSubtle + ";",
      "  color: " + t.accentDark + ";",
      "  box-shadow: 0 0 0 1px " + t.accent + ";",
      "}",

      // ── Highlighted badge floating above an amount button ──
      s + " .foxy-gc-amount-highlighted-tag {",
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
      s + " .foxy-gc-custom-toggle {",
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
      s + " .foxy-gc-custom-toggle:hover {",
      "  border-color: " + t.accent + ";",
      "  color: " + t.accent + ";",
      "}",
      s + " .foxy-gc-custom-toggle--selected {",
      "  border-style: solid;",
      "  border-color: " + t.accent + ";",
      "  background: " + t.accentSubtle + ";",
      "  color: " + t.accentDark + ";",
      "  box-shadow: 0 0 0 1px " + t.accent + ";",
      "}",

      // ── Custom amount input wrapper — hidden by default, shown on toggle ──
      s + " .foxy-gc-custom-input-wrapper {",
      "  position: relative;",
      "  display: none;",
      "}",
      s + " .foxy-gc-custom-input-wrapper--visible {",
      "  display: block;",
      "}",

      // ── Currency symbol inside the custom input ──
      s + " .foxy-gc-custom-currency-symbol {",
      "  position: absolute;",
      "  left: 16px;",
      "  top: 50%;",
      "  transform: translateY(-50%);",
      "  font-size: 15px;",
      "  font-weight: 600;",
      "  color: " + t.textLight + ";",
      "  pointer-events: none;",
      "}",
      s + " .foxy-gc-custom-input-wrapper .foxy-gc-text-input {",
      "  padding-left: 32px;",
      "}",

      // ── Horizontal divider between form sections ──
      s + " .foxy-gc-section-divider {",
      "  height: 1px;",
      "  background: " + t.border + ";",
      "  margin: 24px 0;",
      "}",

      // ── Form field group — label + input pair, collapsible ──
      s + " .foxy-gc-form-field {",
      "  margin-bottom: 18px;",
      "}",
      s + " .foxy-gc-form-field--hidden {",
      "  display: none;",
      "}",

      // ── Field label — small uppercase heading above each input ──
      s + " .foxy-gc-field-label {",
      "  display: block;",
      "  font-size: 13px;",
      "  font-weight: 700;",
      "  letter-spacing: .04em;",
      "  text-transform: uppercase;",
      "  color: " + t.textLight + ";",
      "  margin-bottom: 8px;",
      "}",

      // ── Inline lighter label text (e.g. "optional") ──
      s + " .foxy-gc-field-label-note {",
      "  font-weight: 400;",
      "  text-transform: none;",
      "  letter-spacing: 0;",
      "}",

      // ── Text input — single-line fields with focus ring ──
      s + " .foxy-gc-text-input {",
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
      s + " .foxy-gc-text-input:focus {",
      "  border-color: " + t.accent + ";",
      "  box-shadow: 0 0 0 3px " + t.accentSubtle + ";",
      "}",
      s + " .foxy-gc-text-input::placeholder { color: #bbb; }",

      // ── Textarea — multi-line input for gift message ──
      s + " .foxy-gc-textarea {",
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
      s + " .foxy-gc-textarea:focus {",
      "  border-color: " + t.accent + ";",
      "  box-shadow: 0 0 0 3px " + t.accentSubtle + ";",
      "}",
      s + " .foxy-gc-textarea::placeholder { color: #bbb; }",

      // ── Recipient toggle row — flex container for pill buttons ──
      s + " .foxy-gc-recipient-toggle {",
      "  display: flex;",
      "  gap: 10px;",
      "}",

      // ── Recipient pill button — selectable option with icon ──
      s + " .foxy-gc-recipient-pill {",
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
      s + " .foxy-gc-recipient-pill:hover { border-color: #ccc; }",
      s + " .foxy-gc-recipient-pill svg { width:18px; height:18px; flex-shrink:0; }",

      // ── Selected state for recipient pill ──
      s + " .foxy-gc-recipient-pill--selected {",
      "  border-color: " + t.accent + ";",
      "  background: " + t.accentSubtle + ";",
      "  color: " + t.accentDark + ";",
      "  box-shadow: 0 0 0 1px " + t.accent + ";",
      "}",

      // ── Submit button — full-width accent CTA ──
      s + " .foxy-gc-submit-button {",
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
      s + " .foxy-gc-submit-button:hover {",
      "  background: " + t.accentDark + ";",
      "  border-color: " + t.accentDark + ";",
      "  box-shadow: 0 4px 16px rgba(60,156,158,.3);",
      "}",

      // ── Entrance animation ──
      "@keyframes foxyGcSlideIn {",
      "  from { opacity:0; transform:translateY(24px); }",
      "  to   { opacity:1; transform:translateY(0); }",
      "}",

      // ── Mobile: 2-column amount grid, tighter card padding ──
      "@media (max-width:480px) {",
      "  " + s + " .foxy-gc-amount-grid { grid-template-columns: repeat(2,1fr); }",
      "  " + s + " .foxy-gc-form-card { padding: 28px 20px 24px; }",
      "}",
    ].join("\n");
  }

  // ────────────────────────────────────────────────────────
  // HTML BUILDER
  // ────────────────────────────────────────────────────────
  function buildHTML(cfg, uid) {
    const action = buildCartUrl(cfg.subdomain);
    const l = cfg.labels;
    let h = "";

    // Resolve the default amount's code
    let defaultCode = buildCode(cfg, cfg.defaultAmount, null);
    for (const entry of cfg.amounts) {
      const p = parseAmount(entry);
      if (p.amount === cfg.defaultAmount) {
        defaultCode = buildCode(cfg, p.amount, p.codeOverride);
        break;
      }
    }

    h +=
      '<form class="foxy-gc-form-card" id="foxy-gc-form-' +
      uid +
      '" action="' +
      esc(action) +
      '" method="post" accept-charset="utf-8">';

    // Hidden Foxy fields
    h += '<input type="hidden" name="name" value="' + esc(cfg.productName) + '">';
    h +=
      '<input type="hidden" name="code" class="foxy-gc-hidden-code" value="' +
      esc(defaultCode) +
      '">';
    h += '<input type="hidden" name="category" value="' + esc(cfg.category) + '">';
    h +=
      '<input type="hidden" name="price" class="foxy-gc-hidden-price" value="' +
      cfg.defaultAmount +
      '">';

    // Template set (optional)
    if (cfg.templateSet) {
      h += '<input type="hidden" name="template_set" value="' + esc(cfg.templateSet) + '">';
    }

    // ── Amount selection
    h += '<div class="foxy-gc-form-field">';
    h += '<label class="foxy-gc-field-label">' + esc(l.amountHeading) + "</label>";
    h += '<div class="foxy-gc-amount-grid">';
    for (const entry of cfg.amounts) {
      const parsed = parseAmount(entry);
      const amt = parsed.amount;
      const code = buildCode(cfg, amt, parsed.codeOverride);
      const sel = amt === cfg.defaultAmount ? " foxy-gc-amount-button--selected" : "";
      const badge =
        amt === cfg.highlightedAmount
          ? '<span class="foxy-gc-amount-highlighted-tag">' + esc(l.highlightedBadge) + "</span>"
          : "";
      h +=
        '<button type="button" class="foxy-gc-amount-button' +
        sel +
        '" data-amount="' +
        amt +
        '" data-code="' +
        esc(code) +
        '">' +
        badge +
        esc(cfg.currency) +
        amt +
        "</button>";
    }
    h += "</div>";

    if (cfg.allowCustomAmount) {
      h +=
        '<button type="button" class="foxy-gc-custom-toggle">' +
        esc(l.customAmountButton) +
        "</button>";
      h += '<div class="foxy-gc-custom-input-wrapper">';
      h += '<span class="foxy-gc-custom-currency-symbol">' + esc(cfg.currency) + "</span>";
      h +=
        '<input type="number" class="foxy-gc-text-input foxy-gc-custom-amount-input" placeholder="' +
        esc(l.customAmountPlaceholder) +
        '" min="' +
        cfg.customAmountMin +
        '" max="' +
        cfg.customAmountMax +
        '" step="1">';
      h += "</div>";
    }
    h += "</div>";

    h += '<div class="foxy-gc-section-divider"></div>';

    // ── Recipient toggle
    if (cfg.showRecipientToggle) {
      h += '<div class="foxy-gc-form-field">';
      h += '<label class="foxy-gc-field-label">' + esc(l.recipientHeading) + "</label>";
      h += '<div class="foxy-gc-recipient-toggle">';
      h +=
        '<button type="button" class="foxy-gc-recipient-pill foxy-gc-recipient-pill--selected" data-who="myself">' +
        ICON_PERSON +
        " " +
        esc(l.recipientMyself) +
        "</button>";
      h +=
        '<button type="button" class="foxy-gc-recipient-pill" data-who="someone-else">' +
        ICON_GIFT +
        " " +
        esc(l.recipientSomeoneElse) +
        "</button>";
      h += "</div></div>";
    }

    // ── Email (always present)
    h += '<div class="foxy-gc-form-field" data-field="email">';
    h +=
      '<label class="foxy-gc-field-label" for="foxy-gc-email-' +
      uid +
      '">' +
      esc(l.emailLabel) +
      "</label>";
    h +=
      '<input type="email" class="foxy-gc-text-input" id="foxy-gc-email-' +
      uid +
      '" name="gift_recipient_email" placeholder="' +
      esc(l.emailPlaceholder) +
      '" required>';
    h += "</div>";

    // ── Someone-else fields
    h += '<div class="foxy-gc-form-field foxy-gc-form-field--hidden" data-field="ship_to">';
    h += '<label class="foxy-gc-field-label">' + esc(l.shiptoLabel) + "</label>";
    h +=
      '<input type="text" class="foxy-gc-text-input" name="ship_to" placeholder="' +
      esc(l.shiptoPlaceholder) +
      '">';
    h += "</div>";

    h += '<div class="foxy-gc-form-field foxy-gc-form-field--hidden" data-field="from">';
    h += '<label class="foxy-gc-field-label">' + esc(l.fromLabel) + "</label>";
    h +=
      '<input type="text" class="foxy-gc-text-input" name="from" placeholder="' +
      esc(l.fromPlaceholder) +
      '">';
    h += "</div>";

    if (cfg.showMessageField) {
      h += '<div class="foxy-gc-form-field foxy-gc-form-field--hidden" data-field="message">';
      h +=
        '<label class="foxy-gc-field-label">' +
        esc(l.messageLabel) +
        ' <span class="foxy-gc-field-label-note">' +
        esc(l.messageLabelNote) +
        "</span></label>";
      h +=
        '<textarea class="foxy-gc-textarea" name="gift_recipient_message" placeholder="' +
        esc(l.messagePlaceholder) +
        '"></textarea>';
      h += "</div>";
    }

    // ── Submit
    h += '<button type="submit" class="foxy-gc-submit-button">' + esc(l.submitText) + "</button>";
    h += "</form>";

    return h;
  }

  // ────────────────────────────────────────────────────────
  // EVENT BINDING
  // ────────────────────────────────────────────────────────
  function bindEvents(cfg, uid, root) {
    const form = $("#foxy-gc-form-" + uid, root);
    if (!form) return;

    const priceInput = $(".foxy-gc-hidden-price", form);
    const codeInput = $(".foxy-gc-hidden-code", form);
    const amountBtns = $$(".foxy-gc-amount-button", form);
    const custBtn = $(".foxy-gc-custom-toggle", form);
    const custWrap = $(".foxy-gc-custom-input-wrapper", form);
    const custInput = $(".foxy-gc-custom-amount-input", form);
    const pills = $$(".foxy-gc-recipient-pill", form);

    // ── Amount selection ──
    function selectAmount(btn) {
      if (custBtn) custBtn.classList.remove("foxy-gc-custom-toggle--selected");
      if (custWrap) custWrap.classList.remove("foxy-gc-custom-input-wrapper--visible");
      if (custInput) {
        custInput.removeAttribute("required");
        custInput.value = "";
      }

      amountBtns.forEach(b => b.classList.remove("foxy-gc-amount-button--selected"));
      btn.classList.add("foxy-gc-amount-button--selected");

      priceInput.value = btn.dataset.amount;
      codeInput.value = btn.dataset.code;

      if (typeof cfg.onAmountChange === "function")
        cfg.onAmountChange(Number(btn.dataset.amount), false);
    }

    amountBtns.forEach(btn => {
      btn.addEventListener("click", () => selectAmount(btn));
    });

    // ── Custom amount ──
    if (custBtn && custWrap && custInput) {
      custBtn.addEventListener("click", () => {
        amountBtns.forEach(b => b.classList.remove("foxy-gc-amount-button--selected"));
        custBtn.classList.add("foxy-gc-custom-toggle--selected");
        custWrap.classList.add("foxy-gc-custom-input-wrapper--visible");
        custInput.setAttribute("required", "");
        custInput.focus();
        codeInput.value = buildCode(cfg, "custom", null);
      });

      custInput.addEventListener("input", () => {
        if (custInput.value && Number(custInput.value) > 0) {
          priceInput.value = custInput.value;
          if (typeof cfg.onAmountChange === "function")
            cfg.onAmountChange(Number(custInput.value), true);
        }
      });
    }

    // ── Recipient toggle ──
    const fieldShipto = $('[data-field="ship_to"]', form);
    const fieldFrom = $('[data-field="from"]', form);
    const fieldMessage = $('[data-field="message"]', form);

    function setWho(who) {
      pills.forEach(p => p.classList.remove("foxy-gc-recipient-pill--selected"));
      const match = pills.find(p => p.dataset.who === who);
      if (match) match.classList.add("foxy-gc-recipient-pill--selected");

      const isSomeone = who === "someone-else";

      [fieldShipto, fieldFrom, fieldMessage].forEach(f => {
        if (f) f.classList.toggle("foxy-gc-form-field--hidden", !isSomeone);
      });

      [fieldShipto, fieldFrom].forEach(f => {
        if (!f) return;
        const inp = $("input", f);
        if (isSomeone) inp.setAttribute("required", "");
        else {
          inp.removeAttribute("required");
          inp.value = "";
        }
      });

      if (fieldMessage && !isSomeone) {
        const ta = $("textarea", fieldMessage);
        if (ta) ta.value = "";
      }

      if (typeof cfg.onRecipientChange === "function") cfg.onRecipientChange(who);
    }

    pills.forEach(pill => {
      pill.addEventListener("click", () => setWho(pill.dataset.who));
    });

    // ── Submit hook ──
    if (typeof cfg.onBeforeSubmit === "function") {
      form.addEventListener("submit", e => {
        const fd = new FormData(form);
        const data = {};
        fd.forEach((v, k) => {
          data[k] = v;
        });
        if (cfg.onBeforeSubmit(data) === false) e.preventDefault();
      });
    }
  }

  // ────────────────────────────────────────────────────────
  // PUBLIC API
  // ────────────────────────────────────────────────────────
  let n = 0;

  return {
    /**
     * Mount a gift card form into the page.
     * @param  {Object} options  Config overrides.
     * @return {{ el: HTMLElement, destroy: Function }}
     */
    init(options) {
      const cfg = merge(DEFAULTS, options || {});
      const uid = "gc" + ++n;
      const scope = "fxgc-" + uid;

      const mountEl =
        typeof cfg.element === "string" ? document.querySelector(cfg.element) : cfg.element;
      if (!mountEl) {
        console.error("[FoxyGiftCard] Mount element not found:", cfg.element);
        return null;
      }

      // Inject scoped styles
      const style = document.createElement("style");
      style.id = "fxgc-css-" + uid;
      style.textContent = buildStyles(cfg, scope);
      document.head.appendChild(style);

      // Render
      mountEl.classList.add(scope);
      mountEl.innerHTML = buildHTML(cfg, uid);
      bindEvents(cfg, uid, mountEl);

      return {
        el: mountEl,
        destroy() {
          mountEl.innerHTML = "";
          mountEl.classList.remove(scope);
          const s = document.getElementById("fxgc-css-" + uid);
          if (s) s.remove();
        },
      };
    },
  };
});
