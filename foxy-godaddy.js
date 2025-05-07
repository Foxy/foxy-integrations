export default function init(foxyConfig) {
  const buttonObserver = new MutationObserver(function (mutationsList) {
    if (mutationsList.some((mutation) => mutation.type === 'childList')) {
      const gdAddBtn = parent.document.querySelector(
        '[data-aid="ADD_TO_CART"]'
      );
      const gdBuyNowBtn = parent.document.querySelector('[data-aid="BUY_NOW"]');

      foxyAddToCart(gdAddBtn);
      foxyAddToCart(gdBuyNowBtn, true);
    }
  });

  buttonObserver.observe(parent.document.body, {
    childList: true,
    subtree: true,
  });

  function foxyAddToCart(btn, checkout = false) {
    if (btn && !btn.dataset.listenerAttached) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        const name = parent.document.querySelector(
          '[data-aid="PRODUCT_NAME_RENDERED"]'
        )?.textContent;
        if (!name) {
          console.error("Foxy: Cannot find product name");
          return;
        }

        const price = parent.document
          .querySelector('[data-aid="PRODUCT_PRICE_RENDERED"]')
          ?.textContent.replace(/[^0-9.]/g, "");
        if (!price) {
          console.error("Foxy: Cannot find product price");
          return;
        }

        const quantity = parent.document.querySelector('[data-aid="PRODUCT_QUANTITY"]')?.value || 1;
        const image = parent.document.querySelector("#ols-image-wrapper img")?.src || "";

        const selects = parent.document.querySelectorAll('select[data-ux="InputSelectElement"]');
        const optionParams = [];
        const missingLabels = [];                          

        selects.forEach((sel, i) => {
          const labelText =
            parent.document.querySelector(`label[for="${sel.id}"]`)?.textContent.trim() ||
            `Option${i + 1}`;                               // fallback name

          const selected = sel.options[sel.selectedIndex];

          if (!selected || !selected.value || selected.value === 'select') {
            missingLabels.push(labelText);
            return;
         }

          const key = encodeURIComponent(labelText.replace(/\s+/g, "_"));

          let rawValue = selected.textContent.trim(); // e.g. "7 (+$10)"
          let optionSlug = rawValue; // default if no modifier

          // Look for “value (+$1.50)”  or  “value - $1.50”
          const priceModRx = /^(.+?)\s*[\(\-]\s*([+-])?\$?([\d.,]+)\s*\)?$/i;
              /* Groups:
              1 = base label (“7”)
              2 = explicit +/‑ sign   (optional when using minus sign before parenthesis)
              3 = amount (“10”, “1.50”, “3,50”)    */

          const match = rawValue.match(priceModRx);

          if (match) {
            const baseLabel = match[1].trim();
            const signChar =
              match[2] || (rawValue.includes("‑") || rawValue.includes("-") ? "-" : "+");
            const amount = match[3].replace(",", "."); // “3,50” → “3.50”

            /* Assemble “7{p+10}” or  “Small{p-3.50}”  */
            optionSlug = `${baseLabel}{p${signChar}${amount}}`;
          }

          // URL‑encode, but keep the curly braces readable for Foxy
          const encodedValue = encodeURIComponent(optionSlug)
            .replace(/%7B/gi, "{")
            .replace(/%7D/gi, "}");

          optionParams.push(`${key}=${encodedValue}`);
        });

        if (missingLabels.length) {
          alert(
            `Please select a valid value for: ${missingLabels.join(', ')}`
          );
          return;
        }

        const baseParams = [
          `name=${encodeURIComponent(name)}`,
          `price=${price}`,
          `quantity=${quantity}`,
          `image=${encodeURIComponent(image)}`,
          ...optionParams,
          checkout ? "cart=checkout" : "",
        ].filter(Boolean) // remove empty strings
        .join("&");
 
        const url = `https://${foxyConfig.storeDomain}/cart?${baseParams}`;
        parent.window.location.href = url;
      });

      btn.dataset.listenerAttached = 'true';
    }
  }
}
