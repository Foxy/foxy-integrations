var foxySubdomain = '';
document.addEventListener('DOMContentLoaded', () => {
  const forms = document.querySelectorAll('form[action*="https://www.asecurecart.net"]');

  // Map legacy input names to FoxyCart product option names
  const inputNameMap = {
    'ID': 'code',
    'Describe': 'name',
    'Price': 'price',
    'Weight': 'weight',
    'Qty': 'quantity',
    'QtyMax': 'quantity_max',
    'QtyMin': 'quantity_min',
  };

  /**
   * Converts a value from AsecureCart (which is in the form "DisplayText^Modifier")
   * into FoxyCart summing syntax.
   * For fixed modifiers (e.g. 2.00), it returns "DisplayText{p+2.00}".
   *
   * If the modifier ends with "%" (percentage based), this function does not
   * immediately convert it but returns an object marking it as percentage.
   *
   * @param {string} value - The original option value.
   * @returns {object} - An object with:
   *    display: the display text,
   *    modifier: the original modifier string, 
   *    isPercentage: true if modifier ends with '%'
   */
  function parseModifier(value) {
    if (!value.includes('^')) {
      return { display: value, modifier: null, isPercentage: false };
    }
    const [displayText, modifierValue] = value.split('^').map(s => s.trim());
    const isPercentage = modifierValue.endsWith('%');
    return { display: displayText, modifier: modifierValue, isPercentage };
  }
 
  /**
   * Given a fixed numeric modifier string, returns the FoxyCart syntax using summing notation.
   * For example: "2.00" becomes "{p+2.00}"
   *
   * @param {string} mod - The fixed modifier string.
   * @returns {string} - The FoxyCart modifier syntax.
   */
  function fixedModifierToFoxy(mod) {
    return `{p+${mod}}`;
  }

  /**
   * For percentage-based modifiers, update the FoxyCart syntax based on runningTotal.
   * For example, if runningTotal is 100 and percentage is 15, fixed amount is 15.00.
   *
   * @param {number} runningTotal - The current running total.
   * @param {number} percentage - The percentage value.
   * @returns {string} - FoxyCart syntax: {p+fixedAmount}
   */
  function percentageToFixedModifier(runningTotal, percentage) {
    const fixedAmount = (runningTotal * percentage / 100).toFixed(2);
    return `{p+${fixedAmount}}`;
  }

  /**
   * Extracts a fixed modifier amount from a FoxyCart-formatted string.
   * For example, from "Some Item{p+15.00}" it extracts 15.00.
   *
   * @param {string} value - The field value.
   * @returns {number} - The modifier amount, or 0 if not found.
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
   * Calculates the running total for the form.
   * It starts with the base price (from the hidden "price" input) and adds
   * all fixed modifiers from selected inputs, checkboxes, and select options.
   * Now, it also checks for FoxyCart-formatted modifiers.
   *
   * @param {HTMLFormElement} form - The form to process.
   * @returns {number} - The running total.
   */
function calculateRunningTotal(form) {
  // Get the base price from the hidden "price" input.
  const priceInput = form.querySelector('input[name="price"]');
  let basePrice = priceInput ? parseFloat(priceInput.value) : 0;
  if (isNaN(basePrice)) basePrice = 0;
  let total = basePrice;

  // Process all elements that might contribute a fixed modifier.
  const elements = form.querySelectorAll('input, select');
  for (let el of elements) {
    let valueStr = '';

    // For select elements, get the selected option's value.
    if (el.tagName.toLowerCase() === 'select') {
      const selected = el.options[el.selectedIndex];
      if (!selected || selected.hasAttribute('data-is-percentage')) continue;
      valueStr = selected.value;
    }
    // For input elements, check type and if it's marked as percentage.
    else if (el.tagName.toLowerCase() === 'input') {
      if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) continue;
      if (el.hasAttribute('data-is-percentage')) continue;
      valueStr = el.value;
    }

    if (!valueStr) continue;

    // If the value is already in Foxy format, extract and add the fixed modifier.
    let foxyMatch = valueStr.match(/\{p\+([0-9.]+)\}/);
    if (foxyMatch) {
      total += parseFloat(foxyMatch[1]) || 0;
      continue;
    }

    // Otherwise, if the value is in the legacy AsecureCart format:
    if (valueStr.includes('^')) {
      let parts = valueStr.split('^').map(s => s.trim());
      if (parts.length < 2) continue;
      let modifier = parts[1];
      // Skip percentage-based modifiers.
      if (modifier.endsWith('%')) continue;
      let fixed = parseFloat(modifier);
      if (!isNaN(fixed)) total += fixed;
    }
  }
  return total;
}

  /**
   * Update all elements that were originally percentage-based, converting them
   * into FoxyCart fixed modifiers based on the current running total.
   *
   * @param {HTMLFormElement} form - The form to update.
   */
  function updatePercentageModifiers(form) {
    const runningTotal =  (form);
    form.querySelectorAll('[data-is-percentage="true"]').forEach(el => {
      const percentage = parseFloat(el.dataset.percent);
      if (isNaN(percentage)) return;
      const displayText = el.dataset.display;
      const newModifier = percentageToFixedModifier(runningTotal, percentage);
      el.value = `${displayText}${newModifier}`;
    });
  }

/**
 * Transforms a Returnlink value from AsecureCart into a FoxyCart-compatible URL.
 *
 * The AsecureCart Returnlink value is expected to be in the format:
 *   baseURL{p+imageURL}
 * For example:
 *   "https://www.showroom450.com/gallery3.htm#zone3{p+https://www.asecurecart.net/server/images/9409/ascfi1-366.jpg}"
 *
 * This function extracts the base URL and the image URL from the modifier,
 * then returns a new URL combining them (in this example, by appending
 * the image URL as a query parameter). You can customize the output as needed.
 *
 * @param {string} value - The original Returnlink value.
 * @returns {string} - The transformed Returnlink value.
 */
function transformReturnlink(input) {
  const value = input.value;
  // Check if the value contains the FoxyCart modifier syntax.
  const marker = '{p+';
  const markerIndex = value.indexOf(marker);
  if (markerIndex === -1) {
    // No modifier found; return the original value.
    return value;
  }
  // Find the closing brace.
  const endIndex = value.indexOf('}', markerIndex);
  if (endIndex === -1) {
    // Malformed modifier; return the original value.
    return value;
  }
  // Extract the base URL and the image URL.
  const baseURL = value.substring(0, markerIndex);
  const imageURL = value.substring(markerIndex + marker.length, endIndex);
  // Example transformation:
  // Append the image URL as a query parameter "img" to the base URL.
  input.value = baseURL;
    
  // create hidden input for product image 
  const productImageInput = document.createElement('input');
  productImageInput.type = 'hidden';
  productImageInput.name = 'image';
  productImageInput.value = imageURL;
  form.appendChild(productImageInput);
}



  /**
 * Transforms an AsecureCart Recur value to a FoxyCart sub_frequency value.
 *
 * If the value contains a caret (^) then only the part before the caret is used.
 * If no caret is found, the entire value is used.
 *
 * The transformation works as follows:
 *  - The first character is assumed to be a period indicator (M, D, W, Q, Y).
 *  - The remaining characters are interpreted as the increment.
 *  - If the period is "Q" (quarter), the increment is multiplied by 3 and the unit is converted to months.
 *  - Otherwise, the period is converted to lower-case and used directly.
 *
 * For example:
 *   "M1"         → "1m"  (once per month)
 *   "W2"         → "2w"  (every 2 weeks)
 *   "Q1"         → "3m"  (quarterly → 3 months)
 *
 * @param {string} value - The original AsecureCart Recur value (e.g., "M1", "M1^75.00", etc.).
 * @returns {string} - The transformed value in FoxyCart sub_frequency format (e.g., "1m", "2w", "3m").
 */
function transformRecurToSubFrequency(value) {
  // Split on caret – if there's no caret, parts[0] is the entire value.
  const parts = value.split('^');
  let recurPart = parts[0].trim();
  if (!recurPart) {
    // Default to "M1" if no value is provided.
    recurPart = 'M1';
  }
  // If the value is too short, assume an increment of 1.
  if (recurPart.length < 2) {
    recurPart += '1';
  }
  // Extract the period letter and increment.
  let period = recurPart.charAt(0).toUpperCase();
  let increment = recurPart.slice(1);
  let num = parseFloat(increment);
  if (isNaN(num)) {
    num = 1;
  }
  // Convert "Q" (quarter) to months.
  if (period === 'Q') {
    num = num * 3;
    period = 'm';
  } else {
    period = period.toLowerCase();
  }
  return `${num}${period}`;
}


  // Process each form.
  forms.forEach(form => {
    form.action = `${foxySubdomain}/cart`;

    // Process inputs.
    form.querySelectorAll('input').forEach(input => {
      if (input.type === 'submit') return;

      if(input.name === 'Qty') {
        input.setAttribute("value", "1");
        input.setAttribute("min", "1");
      }

      if (input.name === 'ReturnLink') {
        input.name = 'url';

        if(input.value.includes('^')){
          const splitReturnLink = input.value.split('^');
          const productLink = splitReturnLink[0];
          const productImageURL = splitReturnLink[1];

          input.value = productLink;
          
          // create hidden input for product image 
          const productImageInput = document.createElement('input');
          productImageInput.type = 'hidden';
          productImageInput.name = 'image';
          productImageInput.value = productImageURL;
          form.appendChild(productImageInput);
          return;
        }
      }

      if (input.name === 'Returnlink') {
      // Remap the name if needed:
      input.name = 'url';  // or however you're mapping it for FoxyCart.
      // Transform the value using our helper function.
      transformReturnlink(input);
    }

      if(input.name.includes("AddOn")) input.name = "AddOn";

       if (input.name === 'Recur') {
        // Remap field name.
        input.name = 'sub_frequency';
        // Transform its value.
        input.value = transformRecurToSubFrequency(input.value);
      }

      // Map legacy input names to FoxyCart product option names
      if (inputNameMap.hasOwnProperty(input.name)) {
        input.name = inputNameMap[input.name];
      }

    // Only process caret-based modifiers for allowed product options.
    // Allowed options are Size, Color, AddOn (with optional digits), and NAddOn (with optional digits).
    const allowedOptionsRegex = /^(Size|Color|AddOn\d*|NAddOn\d*)/i;
    if (input.value && input.value.includes('^') && allowedOptionsRegex.test(input.name)) {
        const { display, modifier, isPercentage } = parseModifier(input.value);
        if (!isPercentage && modifier) {
           input.value = `${display}${fixedModifierToFoxy(modifier)}`;
        } else if (isPercentage) {
          input.dataset.isPercentage = "true";
          input.dataset.percent = modifier.replace('%', '');
          input.dataset.display = display;
          input.value = display;
        }
      }
    });

    // Process selects.
    form.querySelectorAll('select').forEach(select => {
       if (select.name === 'Recur') {
        select.name = 'sub_frequency';
        // Process each option.
        select.querySelectorAll('option').forEach(option => {
          option.value = transformRecurToSubFrequency(option.value);
        });
      }

      select.querySelectorAll('option').forEach(option => {
        const allowedOptionsRegex = /^(Size|Color|AddOn\d*|NAddOn\d*)/i;
        if (option.value && option.value.includes('^') && allowedOptionsRegex.test(select.name)) {
          const { display, modifier, isPercentage } = parseModifier(option.value);
          if (!isPercentage && modifier) {
            option.value = `${display}${fixedModifierToFoxy(modifier)}`;
          } else if (isPercentage) {
            option.dataset.isPercentage = "true";
            option.dataset.percent = modifier.replace('%', '');
            option.dataset.display = display;
            option.value = display;
          }
        }
      });
    });

    // Default to using the code as the name if no name is present.
    if (!form.querySelector('input[name="name"]')) {
    const codeInput = form.querySelector('input[name="code"]');
    if (codeInput) {
      const hiddenName = document.createElement('input');
      hiddenName.type = 'hidden';
      hiddenName.name = 'name';
      hiddenName.value = codeInput.value;
      form.appendChild(hiddenName);
    }
  }

    form.addEventListener('change', () => {
      updatePercentageModifiers(form);
    });

    updatePercentageModifiers(form);
  });
});

