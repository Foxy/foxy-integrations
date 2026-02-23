(function () {
  function initFoxyDefaults() {
    // Set quantity input defaults
    const quantityInputs = document.querySelectorAll('input[name="quantity"]');
    if (quantityInputs) {
      quantityInputs.forEach(input => {
        input.min = "1";
        input.value = "1";
      });
    }
  }

  function initBuyItNow() {
    document.addEventListener("click", function (event) {
      const submitInput = event.target.closest("input[foxy-id]");
      if (!submitInput) return;

      const form = submitInput.form;
      const cartInput = form ? form.querySelector('input[name="cart"]') : null;

      if (cartInput) {
        const action = submitInput.getAttribute("foxy-id");
        if (action === "add-to-cart") {
          cartInput.value = "add";
        } else if (action === "buy-it-now") {
          cartInput.value = "checkout";
        }
      }
    });
  }

  function removeInvisibleConditions() {
    document.querySelectorAll("form .w-condition-invisible").forEach(function (el) {
      el.remove();
    });
  }

  function init() {
    initFoxyDefaults();
    initBuyItNow();
    removeInvisibleConditions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
