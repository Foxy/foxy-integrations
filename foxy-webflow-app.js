(function () {
  'use strict';

  // Attribute prefix for all product data
  const PREFIX = 'foxy-product-';

  // Matches an element carrying a product
  const PRODUCT = '[' + PREFIX + 'name][' + PREFIX + 'price]';

  // Matches a Variant read by Foxy's variants helper
  const VARIANT_ITEM = '[foxy-id="variant-item"]';

  // Standard Foxy cart params
  const CART_PARAMS = [
    'name',
    'price',
    'code',
    'image',
    'quantity',
    'quantity_min',
    'quantity_max',
    'category',
    'coupon',
    'template_set',
    'weight',
    'length',
    'width',
    'height',
    'sub_frequency',
    'sub_startdate',
    'sub_enddate',
    'empty',
    'cart',
    'redirect',
  ];

  // Normalize price to number ("$1.234,56" / "$1,234.56" / "1234.56 USD" → "1234.56")
  function normalizePrice(raw) {
    const price = String(raw).replace(/[^\d,.]/g, '');
    if (price.charAt(price.length - 3) === ',') {
      return price.replace(/\./g, '').replace(/,/g, '.');
    }
    return price.replace(/,/g, '');
  }

  // Read an element's `foxy-product-*` attributes into ordered cart params
  function collectParams(el) {
    const params = [];
    CART_PARAMS.forEach(function (param) {
      const raw = el.getAttribute(PREFIX + param);
      if (raw === null || raw.trim() === '') return;
      const value = raw.trim();
      params.push({
        name: param,
        value: param === 'price' ? normalizePrice(value) : value,
      });
    });
    return params;
  }

  // Compose the cart URL into a link's `href`
  function hydrateLink(el, store) {
    const params = collectParams(el);
    if (params.length === 0) return;
    const query = params
      .map(function (p) {
        return encodeURIComponent(p.name) + '=' + encodeURIComponent(p.value);
      })
      .join('&');
    el.setAttribute('href', 'https://' + store + '/cart?' + query);
  }

  // Read custom options (`foxy-product-option-<i>-name` / `-value`) into name/value pairs
  function collectOptions(el) {
    const options = [];
    for (let i = 0; ; i++) {
      const rawName = el.getAttribute(PREFIX + 'option-' + i + '-name');
      if (rawName === null) break;
      const name = rawName.trim();
      if (!name) continue;
      const value = el.getAttribute(PREFIX + 'option-' + i + '-value') || '';
      options.push({ name: name, value: value.trim() });
    }
    return options;
  }

  // Whether the form already has a control with this name
  function hasNamedControl(formEl, name) {
    const controls = formEl.querySelectorAll('[name]');
    for (let i = 0; i < controls.length; i++) {
      if (controls[i].getAttribute('name') === name) return true;
    }
    return false;
  }

  //  Add a hidden input, unless a control with that name already exists
  function addHiddenInput(formEl, name, value) {
    if (hasNamedControl(formEl, name)) return;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    formEl.insertAdjacentElement('afterbegin', input);
  }

  // Prefill an empty visible quantity field
  function seedQuantity(source, formEl) {
    const configured = source.getAttribute(PREFIX + 'quantity');
    const value = configured && configured.trim() ? configured.trim() : '1';
    const controls = formEl.querySelectorAll('[name]');
    for (let i = 0; i < controls.length; i++) {
      const control = controls[i];
      if (control.getAttribute('name') !== 'quantity') continue;
      if (control.tagName.toLowerCase() !== 'input') continue;
      // A hidden input was added by this script and already has its value.
      if (control.type === 'hidden') continue;
      if (control.value !== '') continue;
      control.value = value;
    }
  }

  // The current page URL to fill the `url` cart param
  function pageUrl() {
    return window.location.href.split('#')[0];
  }

  // Attributes for variants
  const VARIANT_INPUTS = [
    { attr: 'foxy-variant-sku', param: 'code' },
    { attr: 'foxy-variant-weight', param: 'weight' },
    { attr: 'foxy-variant-image', param: 'image' },
    { attr: 'foxy-variant-inventory', param: 'quantity_max' },
  ];

  // Add an empty input for each param in variants form
  function addVariantInputs(formEl) {
    if (formEl.getAttribute('foxy-id') !== 'form') return;
    const scope = formEl.closest('[foxy-id="container"]') || document;
    const items = scope.querySelectorAll(VARIANT_ITEM);
    VARIANT_INPUTS.forEach(function (input) {
      for (let i = 0; i < items.length; i++) {
        const value = items[i].getAttribute(input.attr);
        if (value !== null && value.trim() !== '') {
          addHiddenInput(formEl, input.param, '');
          return;
        }
      }
    });
  }

  // Add hidden inputs for the product data and custom options to `formEl`
  function hydrateForm(source, formEl) {
    collectParams(source).forEach(function (p) {
      addHiddenInput(formEl, p.name, p.value);
    });
    collectOptions(source).forEach(function (o) {
      addHiddenInput(formEl, o.name, o.value);
    });
    // After the product's own inputs, so those keep their values.
    addVariantInputs(formEl);
    addHiddenInput(formEl, 'url', pageUrl());
    seedQuantity(source, formEl);
  }

  // Compose every product link and form on the page
  function hydrateAll() {
    const store =
      (window.FC && window.FC.settings && window.FC.settings.storedomain) || '';

    const els = document.querySelectorAll(PRODUCT);

    Array.prototype.forEach.call(els, function (el) {
      const tag = el.tagName.toLowerCase();

      if (tag === 'form') {
        hydrateForm(el, el);
        return;
      }

      if (tag === 'a') {
        if (!store) {
          console.warn(
            '[foxy-webflow] No FC.settings.storedomain; cannot compose link',
            el
          );
          return;
        }
        hydrateLink(el, store);
        return;
      }

      // Webflow wraps forms in a `.w-form` div, and the attributes may be on the wrapper. Read them there and write inputs into the inner form.
      const innerForm = el.querySelector('form');
      if (innerForm) {
        hydrateForm(el, innerForm);
      } else {
        console.warn(
          '[foxy-webflow] foxy-product-* on unsupported element <' + tag + '>',
          el
        );
      }
    });
  }

  // Marker on an Image element whose source should be copied onto an attribute
  const IMAGE_BRIDGE_MARKER = 'data-foxy-webflow-image';

  const BRIDGE_TARGETS = {
    [PREFIX + 'image']: PRODUCT,
    'foxy-variant-image': VARIANT_ITEM,
  };

  // Attribute for background image in radio buttons
  const SWATCH_IMAGE_ATTR = /^foxy-variant-[a-z0-9_]+-background-image$/;

  // `src` as a quoted CSS `url()`, with `"` and `\` escaped
  function cssUrl(src) {
    return 'url("' + src.replace(/["\\]/g, '\\$&') + '")';
  }

  // Where attribute `attr` is filled and how its value is formatted, or null if a marked Image may not fill it
  function bridgeRule(attr) {
    if (Object.prototype.hasOwnProperty.call(BRIDGE_TARGETS, attr)) {
      return { selector: BRIDGE_TARGETS[attr], format: String };
    }
    if (SWATCH_IMAGE_ATTR.test(attr)) {
      return { selector: VARIANT_ITEM, format: cssUrl };
    }
    return null;
  }

  // Copy each marked Image's source onto the attribute its marker names
  function bridgeImages() {
    const images = document.querySelectorAll(
      'img[' + IMAGE_BRIDGE_MARKER + ']'
    );
    Array.prototype.forEach.call(images, function (img) {
      const attr = img.getAttribute(IMAGE_BRIDGE_MARKER);
      const rule = bridgeRule(attr);
      if (!rule) {
        console.warn(
          '[foxy-webflow] ' +
            IMAGE_BRIDGE_MARKER +
            ' names an attribute it cannot fill: ' +
            attr,
          img
        );
        return;
      }
      const target =
        img.parentElement && img.parentElement.closest(rule.selector);
      if (!target) return;
      const existing = target.getAttribute(attr);
      if (existing !== null && existing.trim() !== '') return;
      if (img.classList.contains('w-dyn-bind-empty')) return;
      const authoredSrc = img.getAttribute('src');
      if (authoredSrc === null || authoredSrc.trim() === '') return;
      const resolvedSrc = img.src;
      if (!/^https?:\/\//i.test(resolvedSrc)) return;
      target.setAttribute(attr, rule.format(resolvedSrc));
    });
  }

  // ID of the stylesheet added by styleSwatches, so it's added only once
  const SWATCH_STYLE_ID = 'foxy-webflow-swatches';

  // A variant-group radio the variants helper has given a swatch background
  const SWATCH_RADIO =
    '[foxy-id="form"] div[foxy-variant-group] ' +
    'input[type="radio"][style*="background"]';

  // Make native swatch radios show their background
  function styleSwatches() {
    if (document.getElementById(SWATCH_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = SWATCH_STYLE_ID;
    style.textContent =
      ':where(' +
      SWATCH_RADIO +
      '){-webkit-appearance:none;appearance:none;width:16px;height:16px;' +
      'border:1px solid rgba(0,0,0,.25);border-radius:50%;' +
      'background-position:center;background-size:cover;cursor:pointer}' +
      ':where(' +
      SWATCH_RADIO +
      ':checked){outline:2px solid currentColor;outline-offset:2px}';
    (document.head || document.documentElement).appendChild(style);
  }

  // Manual re-run hooks, for debugging and pages that add products later.
  window.FoxyWebflow = { hydrate: hydrateAll, bridgeImages: bridgeImages };

  bridgeImages();
  styleSwatches();

  window.FC = window.FC || {};
  const priorOnLoad = window.FC.onLoad;
  window.FC.onLoad = function () {
    if (typeof priorOnLoad === 'function') priorOnLoad.call(this);
    window.FC.client.on('ready.done', hydrateAll);
  };
})();
