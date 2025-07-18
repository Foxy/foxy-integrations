var FC = FC || {};
FC.onLoad = function () {
  FC.client.on('sidecart-detach', function () {
    // Reset variants
    document
      .querySelectorAll("[data-hook='dropdown-base-text']")
      .forEach((el) => (el.innerText = 'Select'));
  });

  FC.client.on('ready.done', function () {
    foxyAddToCart();

    let previousUrl = window.location.pathname;
    const urlObserver = new MutationObserver(function () {
      if (window.location.pathname !== previousUrl) {
        previousUrl = window.location.pathname;
        foxyAddToCart();
      }
    });
    urlObserver.observe(document, { subtree: true, childList: true });

    function foxyAddToCart() {
      const buttonObserver = new MutationObserver(function (mutationsList) {
        if (mutationsList.some((mutation) => mutation.type === 'childList')) {
          // mini cart
          const minicartBtn = document.querySelector(
            "[data-hook='cart-icon-button']"
          );
          if (minicartBtn && !minicartBtn.hasAttribute('foxy-id')) {
            minicartBtn.setAttribute('foxy-id', 'mini-cart-btn');
            minicartBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopImmediatePropagation();
              FC.client.event('sidecart-show').trigger();
            });
          }

          const minicartQty = document.querySelector(
            '[data-hook="items-count"]'
          );
          if (minicartQty && !minicartQty.hasAttribute('data-fc-id')) {
            minicartQty.setAttribute('data-fc-id', 'minicart-quantity');
            FC.client.updateMiniCart();
          }

          const minicartLink = document.querySelector(
            `a[href="https://${FC.settings.storedomain}/cart?cart=view"]`
          );
          if (minicartLink && !minicartLink.hasAttribute('foxy-id')) {
            minicartLink.setAttribute('foxy-id', 'mini-cart-link');
            minicartLink.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopImmediatePropagation();
              FC.client.event('sidecart-show').trigger();
            });
          }

          // add-to-cart button
          const wixAddBtn =
            document.querySelector("[data-hook='add-to-cart']") ||
            document.querySelector('[aria-label="Add to Cart"]') ||
            document.querySelector('[data-hook="subscribe-button"]');
          if (!!wixAddBtn && !wixAddBtn.hasAttribute('foxy-id')) {
            wixAddBtn.setAttribute('foxy-id', 'add-to-cart');
            wixAddBtn.addEventListener('click', (e) => handleAddToCart(e));
          }
        }
      });

      buttonObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    function handleAddToCart(e) {
      e.stopPropagation();

      const name =
        document.querySelector("[data-hook='product-title']")?.innerText ||
        document.querySelector('[aria-label="foxy-product-name"]')?.innerText;
      if (!name) {
        console.error('Foxy: cannot find product name');
        return;
      }

      let price = document
        .querySelector("[data-hook='formatted-primary-price']")
        ?.innerText.replace(/[^\d,.]/g, '');
      if (price.charAt(price.length - 3) === ',') {
        price = price.replace(/[.]/g, '').replace(/[,]/g, '.');
      }
      if (!price) {
        console.error('Foxy: cannot find product price');
        return;
      }

      const slug = window.location.pathname.split('/').slice(-1) || '';
      const quantity =
        document.querySelector(
          '[data-hook="number-input-spinner-input"], [data-hook="product-quantity-container"] input'
        )?.value || 1;
      const quantity_max =
        document.querySelector(
          '[data-hook="number-input-spinner-input"], [data-hook="product-quantity-container"] input'
        )?.max || 0;
      const code =
        document.querySelector("[data-hook='sku']")?.innerText.split(': ')[1] ||
        '';
      const image =
        document.querySelector('[data-hook="main-media-image-wrapper"] img')
          ?.src ||
        document.querySelector("[data-hook='product-image']")?.src ||
        document
          .querySelector('[data-hook="responsive-gallery-media"]')
          ?.style.backgroundImage.slice(4, -1)
          .replace(/"/g, '') ||
        '';
      const weight =
        Array.from(
          document.querySelectorAll('[data-hook="info-section-title"]')
        )
          .map((el) => el.textContent.trim())
          .find((el) => el.toLowerCase().startsWith('weight'))
          ?.match(/[\d.]+/)[0] ||
        document.querySelector('[data-foxy-product="weight"]')?.textContent ||
        0;

      // Subscriptions
      const subContainer = document.querySelector(
        '[data-hook="subscription-plans-container"]'
      );
      const subOption = subContainer?.querySelector(
        '[data-checked="true"] input'
      );
      if (subContainer && !subOption) {
        return;
      }

      let subFrequency;
      let subEndDate;

      if (subOption && subOption.ariaLabel !== 'One-time purchase') {
        const subDetails = subOption
          .closest('[data-hook="plan-item"]')
          .querySelector('[data-hook="plan-details"]').innerText;

        const match = subDetails.match(/every (\d*)\s*(\w+)/);

        const frequency = match[1] ? parseInt(match[1]) : 1;
        const unit = match[2][0];

        subFrequency = `${frequency}${unit}`;

        if (!subDetails.endsWith('until canceled')) {
          const endsIn = subDetails.split('for ')[1].match(/\b\d+\b/)[0];
          subEndDate = `${endsIn}${unit}`;
        }
      }

      const atcLink =
        `https://${FC.settings.storedomain}/cart?name=${encodeURIComponent(
          name
        )}&price=${price}&quantity=${quantity}&quantity_max=${quantity_max}&image=${encodeURIComponent(
          image
        )}&code=${encodeURIComponent(
          code
        )}&Slug=${slug}&url=${encodeURIComponent(window.location.href)}` +
        (weight ? `&weight=${weight}` : '') +
        (subFrequency ? `&sub_frequency=${subFrequency}` : '') +
        (subEndDate ? `&sub_enddate=${subEndDate}` : '');

      // Dropdown options
      const allVariantValues =
        document.querySelectorAll("[data-hook='dropdown-base-text']").length !==
        0
          ? Array.from(
              document.querySelectorAll("[data-hook='dropdown-base-text']")
            ).map((div) => encodeURIComponent(div.innerText))
          : Array.from(
              document.querySelectorAll("[data-hook='native-select']")
            ).map((select) =>
              encodeURIComponent(select.options[select.selectedIndex].text)
            );
      const allVariantName = Array.from(
        document.querySelectorAll(
          "[data-hook='options-dropdown-title'], [data-hook='dropdown-label']"
        )
      ).map((div) => encodeURIComponent(div.innerText.replace(/\*$/, '')));

      // Color option
      const colorOption = document
        .querySelector(
          '[data-hook="product-colors-title"], [data-hook="color-picker-fieldset-label"]'
        )
        ?.innerText.split(': ')
        .map((el) => encodeURIComponent(el));

      if (allVariantValues.length > 0 && !allVariantValues.includes('Select')) {
        // if there are variants and all options are selected
        let variantParams = '';

        // add color option if exists
        if (!!colorOption) {
          if (colorOption.length === 2) {
            variantParams += `&${colorOption[0]}=${colorOption[1].replace(
              '*',
              ''
            )}`;
          } else {
            return;
          }
        }

        allVariantName.forEach(
          (name, index) =>
            (variantParams += `&${name}=${allVariantValues[index]}`)
        );

        FC.client.event('cart-submit').trigger({
          data: { cart: 'add' },
          url: atcLink + variantParams,
        });
      } else if (allVariantValues.length === 0 && colorOption?.length === 2) {
        // only color options
        FC.client.event('cart-submit').trigger({
          data: { cart: 'add' },
          url:
            atcLink + `&${colorOption[0]}=${colorOption[1].replace('*', '')}`,
        });
      } else if (allVariantValues.length === 0 && !colorOption) {
        // if there are no variants or color options
        FC.client.event('cart-submit').trigger({
          data: { cart: 'add' },
          url: atcLink,
        });
      }
    }
  });
};
