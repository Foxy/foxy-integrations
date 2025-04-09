var FC = FC || {};
const existingOnLoadASecureCart = typeof FC.onLoad == "function" ? FC.onLoad : function () {};
FC.onLoad = function () {
existingOnLoadASecureCart();

FC.client.on("ready.done", () => {
  const forms = document.querySelectorAll('form[action*="https://www.asecurecart.net"]');

  // Map legacy input names to FoxyCart product option names
  const inputNameMap = {
    ID: "code",
    Describe: "name",
    Price: "price",
    Weight: "weight",
    Qty: "quantity",
    QtyMax: "quantity_max",
    QtyMin: "quantity_min",
  };

  /**
   * Logs debug info to console if ?debuga2f=1 is in the URL or global flag is set
   * @param {string} msg - Message to log
   * @param {...any} args - Additional arguments
   */
  function debugLog(msg, ...args) {
    const urlDebug = new URLSearchParams(window.location.search).get("debuga2f") === "1";
    const isEnabled = window.__DEBUG_ASECURECART_TO_FOXY__ || urlDebug;
    if (isEnabled) {
      console.log("[A2F]", msg, ...args);
    }
  }

  /**
   * Parses a legacy AsecureCart value like "Option^Modifier" into parts
   * @param {string} value - Raw value from input/select
   * @returns {{display: string, modifier: string|null, isPercentage: boolean}}
   */
  function parseModifier(value) {
    const firstCaret = value.indexOf("^");
    if (firstCaret === -1) return { display: value, modifier: null, isPercentage: false };

    const displayText = value.substring(0, firstCaret).trim();
    const rest = value.substring(firstCaret + 1).trim();
    const modifierValue = rest.split("^")[0];
    const isPercentage = modifierValue.endsWith("%");
    debugLog("Parsed modifier", { displayText, modifierValue, isPercentage });
    return { display: displayText, modifier: modifierValue, isPercentage };
  }

  /**
   * Converts a numeric string into FoxyCart summing modifier syntax
   * @param {string} mod - e.g. "2.00"
   * @returns {string} - e.g. "{p+2.00}"
   */
  function fixedModifierToFoxy(mod) {
    return `{p+${mod}}`;
  }

  /**
   * Converts a % modifier to fixed amount based on total
   * @param {number} runningTotal - Current calculated product total
   * @param {number} percentage - e.g. 15 for 15%
   * @returns {string} - FoxyCart fixed modifier
   */
  function percentageToFixedModifier(runningTotal, percentage) {
    const fixedAmount = ((runningTotal * percentage) / 100).toFixed(2);
    return `{p+${fixedAmount}}`;
  }

  /**
   * Extracts number from a Foxy-style modifier, e.g. "{p+2.00}"
   * @param {string} value
   * @returns {number}
   */
  function extractFixedModifier(value) {
    // Look for a pattern like {p+NUMBER}
    const match = value.match(/\{p\+([0-9.]+)\}/);
    if (match && match[1]) {
      return parseFloat(match[1]) || 0;
    }
    return 0;
  }

  /**
   * Computes the total of all price-affecting inputs in the form
   * @param {HTMLFormElement} form
   * @returns {number}
   */
  function calculateRunningTotal(form) {
    const priceInput = form.querySelector('input[name="price"]');
    let basePrice = priceInput ? parseFloat(priceInput.value) : 0;
    if (isNaN(basePrice)) basePrice = 0;
    let total = basePrice;

    const elements = form.querySelectorAll("input, select");
    for (let el of elements) {
      let valueStr = "";

      if (el.tagName.toLowerCase() === "select") {
        const selected = el.options[el.selectedIndex];
        if (!selected || selected.hasAttribute("data-is-percentage")) continue;
        valueStr = selected.value;
      } else if (el.tagName.toLowerCase() === "input") {
        if ((el.type === "radio" || el.type === "checkbox") && !el.checked) continue;
        if (el.hasAttribute("data-is-percentage")) continue;
        valueStr = el.value;
      }

      if (!valueStr) continue;

      const foxyMatch = valueStr.match(/\{p\+([0-9.]+)\}/);
      if (foxyMatch) {
        total += parseFloat(foxyMatch[1]) || 0;
        continue;
      }

      if (valueStr.includes("^")) {
        let parts = valueStr.split("^").map(s => s.trim());
        if (parts.length < 2) continue;
        let modifier = parts[1];
        if (modifier.endsWith("%")) continue;
        let fixed = parseFloat(modifier);
        if (!isNaN(fixed)) total += fixed;
      }
    }
    debugLog("Calculated running total:", total);
    return total;
  }

  /**
   * Updates percentage-based modifiers to fixed values based on total
   * @param {HTMLFormElement} form
   */
  function updatePercentageModifiers(form) {
    const runningTotal = calculateRunningTotal(form);
    form.querySelectorAll('[data-is-percentage="true"]').forEach(el => {
      const percentage = parseFloat(el.dataset.percent);
      if (isNaN(percentage)) return;
      const displayText = el.dataset.display;
      const newModifier = percentageToFixedModifier(runningTotal, percentage);
      el.value = `${displayText}${newModifier}`;
      debugLog("Updated percentage modifier", el.name, el.value);
    });
  }

  /**
   * Converts an AsecureCart-style "Recur" value to FoxyCart "sub_frequency"
   * @param {string} value
   * @returns {string}
   */
  function transformRecurToSubFrequency(value) {
    const parts = value.split("^");
    let recurPart = parts[0].trim();
    if (!recurPart) recurPart = "M1";
    if (recurPart.length < 2) recurPart += "1";
    let period = recurPart.charAt(0).toUpperCase();
    let increment = recurPart.slice(1);
    let num = parseFloat(increment);
    if (isNaN(num)) num = 1;
    if (period === "Q") {
      num = num * 3;
      period = "m";
    } else {
      period = period.toLowerCase();
    }
    return `${num}${period}`;
  }

function processInputs(form) {
  // Process all inputs and selects in the form
  form.querySelectorAll("input").forEach(input => {
    if (input.type === "submit") return;

    if (input.name === "Qty") {
      input.setAttribute("value", "1");
      input.setAttribute("min", "1");
    }

    if (input.name === "ReturnLink" || input.name === "Returnlink") {
      input.name = "url";

      if (input.value.includes("^")) {
        const splitReturnLink = input.value.split("^");
        const productLink = splitReturnLink[0];
        const productImageURL = splitReturnLink[1];

        input.value = productLink;

        const productImageInput = document.createElement("input");
        productImageInput.type = "hidden";
        productImageInput.name = "image";
        productImageInput.value = productImageURL;
        form.appendChild(productImageInput);
        debugLog("Processed returnlink + image", productLink, productImageURL);
        return;
      }
    }

    if (input.name === "Recur") {
      input.name = "sub_frequency";
      input.value = transformRecurToSubFrequency(input.value);
      debugLog("Transformed Recur field to sub_frequency", input.value);
    }

    if (inputNameMap.hasOwnProperty(input.name)) {
      input.name = inputNameMap[input.name];
    }

    const allowedOptionsRegex = /^(Size|Color|AddOn\d*|NAddOn\d*)/i;
    if (input.value && input.value.includes("^") && allowedOptionsRegex.test(input.name)) {
      const { display, modifier, isPercentage } = parseModifier(input.value);
      if (!isPercentage && modifier) {
        input.value = `${display}${fixedModifierToFoxy(modifier)}`;
        debugLog("Applied fixed modifier to input", input.name, input.value);
      } else if (isPercentage) {
        input.dataset.isPercentage = "true";
        input.dataset.percent = modifier.replace("%", "");
        input.dataset.display = display;
        input.value = display;
        debugLog("Registered percentage modifier input", input.name, modifier);
      }
    }
  });
}

function processSelects(form) {
  // Process all selects in the form
  form.querySelectorAll("select").forEach(select => {
    if (select.name === "Recur") {
      select.name = "sub_frequency";
      select.querySelectorAll("option").forEach(option => {
        option.value = transformRecurToSubFrequency(option.value);
      });
    }

    select.querySelectorAll("option").forEach(option => {
      const allowedOptionsRegex = /^(Size|Color|AddOn\d*|NAddOn\d*)/i;
      if (
        option.value &&
        option.value.includes("^") &&
        allowedOptionsRegex.test(select.name)
      ) {
        const { display, modifier, isPercentage } = parseModifier(option.value);
        if (!isPercentage && modifier) {
          option.value = `${display}${fixedModifierToFoxy(modifier)}`;
          debugLog("Applied fixed modifier to select option", select.name, option.value);
        } else if (isPercentage) {
          option.dataset.isPercentage = "true";
          option.dataset.percent = modifier.replace("%", "");
          option.dataset.display = display;
          option.value = display;
          debugLog("Registered percentage modifier select", select.name, modifier);
        }
      }
    });
  });
}

forms.forEach(form => {
    
    form.action = `https://${FC.settings.storedomain}/cart`;

    processInputs(form);
    processSelects(form)

    if (!form.querySelector('input[name="name"]')) {
      const codeInput = form.querySelector('input[name="code"]');
      if (codeInput) {
        const hiddenName = document.createElement("input");
        hiddenName.type = "hidden";
        hiddenName.name = "name";
        hiddenName.value = codeInput.value;
        form.appendChild(hiddenName);
        debugLog("Added missing name input using code", codeInput.value);
      }
    }

    if (!form.querySelector('input[name="price"]')) {
      const hiddenPrice = document.createElement("input");
      hiddenPrice.type = "hidden";
      hiddenPrice.name = "price";
      hiddenPrice.value = 0;
      form.appendChild(hiddenPrice);
      debugLog("Added missing price input with default value", hiddenPrice.value);
    }

    form.addEventListener("change", (e) => {
      updatePercentageModifiers(form);
      processInputs(form);
      processSelects(form);
      debugLog("Form changed", e.target.name, e.target.value);
    });

    updatePercentageModifiers(form);
  });
});
}

