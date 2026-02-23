(function (userConfig) {
  const config = {
    injectSidecartStyles: true, // default
    ...userConfig,
  };

  // =================================================================
  //  1. SIDECART STYLES
  // =================================================================

  function injectSidecartStyles() {
    if (!config.injectSidecartStyles) return;

    const STYLE_ID = "fc-sidecart-custom-styles";
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        white-space: unset;
        white-space-collapse: unset;
      }
      [data-fc-with-sidecart].cart-visible [data-fc-ui-block] {
        position: fixed !important;
        inset: 0;
        height: 100vh;
        opacity: .2;
        cursor: pointer;
      }
      [data-fc-sidecart] {
        position: fixed;
        top: 0;
        right: 0;
        height: 100vh;
        max-height: 100vh;
        overflow-y: auto;
      }
    `.trim();

    (document.head || document.documentElement).appendChild(style);
  }

  if (config.injectSidecartStyles) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", injectSidecartStyles);
    } else {
      injectSidecartStyles();
    }
  }

  // =================================================================
  //  2. URL CHANGE OBSERVER — detects SPA navigation via DOM mutations
  // =================================================================

  let previousUrl = location.href;
  let urlChangeTimer = null;

  const urlObserver = new MutationObserver(() => {
    if (location.href !== previousUrl) {
      previousUrl = location.href;
      clearTimeout(urlChangeTimer);
      urlChangeTimer = setTimeout(onPageReady, 350);
    }
  });

  urlObserver.observe(document, { subtree: true, childList: true });

  // =================================================================
  //  3. SIDECART REBIND
  // =================================================================

  function rebindFoxySidecart() {
    if (!window.FC?.sidecart || !window.jQuery) return;

    const { sidecart } = window.FC;
    const $ = window.jQuery;

    if (!sidecart.$cart?.length) {
      sidecart.init();
    }

    sidecart.$container = $("[data-fc-with-sidecart]");

    if (!sidecart.$container.length) {
      sidecart.$container = $("body").attr("data-fc-with-sidecart", sidecart.transition_style);
    }

    // Drop stale UI-block reference so a fresh one can be created
    if (sidecart.$uiblock && !$.contains(document, sidecart.$uiblock[0])) {
      sidecart.$uiblock = undefined;
    }
  }

  // =================================================================
  //  4. FORM ACTION UPDATE
  // =================================================================

  function updateFoxyFormActions() {
    if (!window.FC?.settings?.storedomain) {
      setTimeout(updateFoxyFormActions, 500);
      return;
    }

    const cartAction = `https://${window.FC.settings.storedomain}/cart`;
    const forms = document.querySelectorAll("form");

    if (!forms.length) {
      setTimeout(updateFoxyFormActions, 500);
      return;
    }

    forms.forEach(form => {
      if (form.querySelector('input[name="price"]')) {
        form.action = cartAction;
      }
    });
  }

  // =================================================================
  //  5. CUSTOMER PORTAL BYPASS
  // =================================================================

  function bypassCustomerPortal() {
    const portal = document.querySelector("foxy-customer-portal");
    if (portal) {
      document.body.classList.add("fc-sidecart--bypass");
      document.body.setAttribute("data-fc-sidecart-bypass", "true");
    } else {
      setTimeout(bypassCustomerPortal, 500);
    }
  }

  // =================================================================
  //  6. MINICART QUANTITY
  // =================================================================

  function updateMinicartQuantity() {
    if (!window.FC?.client) {
      setTimeout(updateMinicartQuantity, 500);
      return;
    }

    const minicartEl = document.querySelector('[data-fc-id="minicart-quantity"]');

    if (!minicartEl) {
      setTimeout(updateMinicartQuantity, 300);
      return;
    }

    window.FC.client.updateMiniCart();
  }

  // =================================================================
  //  7. PAGE INIT — runs on first load + every SPA navigation
  // =================================================================

  function onPageReady() {
    rebindFoxySidecart();
    updateFoxyFormActions();
    updateMinicartQuantity();
    bypassCustomerPortal();
  }

  // =================================================================
  //  8. FC.onLoad HOOK
  // =================================================================

  window.FC = window.FC || {};
  const previousOnLoad = typeof window.FC.onLoad === "function" ? window.FC.onLoad : null;

  window.FC.onLoad = function () {
    if (previousOnLoad) previousOnLoad();

    window.FC.client.on("ready.done", onPageReady);
  };
})(window.foxyWebstudio || {});
