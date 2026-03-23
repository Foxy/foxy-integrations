document.addEventListener('DOMContentLoaded', () => {
  // Disable add-to-cart buttons temporarily
  document
    .querySelectorAll('button.sqs-add-to-cart-button')
    .forEach((sqsBtn) => (sqsBtn.disabled = true));
});

var FC = FC || {};
FC.onLoad = function () {
  FC.client.on('ready.done', async function () {
    const foxyConfig = window.foxyConfig || {};

    // Modify mini-cart links
    document
      .querySelectorAll('.sqs-custom-cart')
      .forEach(
        (link) =>
          (link.href = `https://${FC.settings.storedomain}/cart?cart=view`)
      );

    // Add Foxy data attribute to mini-cart quantity elements
    document
      .querySelectorAll('.sqs-cart-quantity')
      .forEach((qty) => qty.setAttribute('data-fc-id', 'minicart-quantity'));

    FC.client.updateMiniCart();

    // Squarespace add-to-cart buttons
    const sqsBtns = document.querySelectorAll('button.sqs-add-to-cart-button');

    if (sqsBtns.length === 0) {
      return;
    }

    // Fetch Squarespace product page JSON
    let sqsPageJson;
    if (foxyConfig.useSquarespaceCategory) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('format', 'json');
        const response = await fetch(url.href);
        sqsPageJson = await response.json();

        if (!sqsPageJson) {
          throw new Error('Foxy: Invalid Squarespace product page JSON');
        }
      } catch (error) {
        console.error(error);
        alert(
          'Something went wrong. Please refresh the page and try again. If the issue persists, please contact the store.'
        );
      }
    }

    sqsBtns.forEach((sqsBtn) => {
      // Clone and replace Squarespace add-to-cart button
      const btn = sqsBtn.cloneNode(true);
      sqsBtn.parentNode.replaceChild(btn, sqsBtn);

      // Re-enable button
      btn.disabled = false;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        // Check add-to-cart button location
        const btnLocation = btn.closest('.product-add-to-cart')
          ? 'main' // Main button on product page
          : btn.closest('.product-block')
            ? 'product-block' // One of the buttons inside of a product block
            : '';

        // Retrieve product info from page elements by button location
        let cartUrl;

        switch (btnLocation) {
          // Main button on product page
          case 'main': {
            const name =
              document.querySelector(
                '.ProductItem-details-title, .product-title'
              )?.textContent || Static.SQUARESPACE_CONTEXT.item.title;
            const variantData = Static.SQUARESPACE_CONTEXT.product.variants;

            if (!name || !variantData) {
              console.error('Foxy: Missing product name or variant data');
              alert('Unable to add this product to cart');
              return;
            }

            const quantity =
              document.querySelector(
                '.product-quantity-input input, input.product-quantity-input'
              )?.value || 1;
            const image =
              document.querySelector(
                '.product-gallery-slides-item.selected img'
              )?.dataset.src ||
              document.querySelector(
                '.ProductItem-gallery-slides-item-image, .product-gallery-slides-item-image, .pdp-gallery-slides-image'
              )?.src ||
              '';
            const category =
              document.querySelector('input[name="foxy-category"]')?.value ||
              (foxyConfig.useSquarespaceCategory
                ? sqsPageJson.nestedCategories?.itemCategories[0]?.shortSlug
                : '') ||
              '';
            const productUrl = window.location.href;

            const productOptions = {};
            const productOptionEls = document.querySelectorAll(
              '#main-product-variants .variant-option'
            );
            for (const productOptionEl of productOptionEls) {
              const selectEl = productOptionEl.querySelector('.variant-select');
              const optionName =
                productOptionEl.dataset.variantOptionName ||
                selectEl.dataset.variantOptionName;
              const optionValue = selectEl.value;

              if (!optionName || !optionValue) {
                console.error('Foxy: Invalid product option name or value');
                alert('Please choose an option for all fields');
                return;
              }

              productOptions[optionName] = optionValue;
            }

            const selectedVariant = getSelectedVariant(
              variantData,
              productOptions
            );
            if (!selectedVariant) {
              console.error('Foxy: Cannot find a matching selected variant');
              alert('Unable to add this product to cart');
              return;
            }

            const stock = selectedVariant.stock.unlimited
              ? ''
              : selectedVariant.stock.quantity;
            if (stock === 0) {
              console.error('Foxy: No stock available');
              alert('This product is out of stock');
              return;
            }

            const price = selectedVariant.onSale
              ? selectedVariant.salePrice.decimalValue
              : selectedVariant.price.decimalValue;
            const { sku, id: variantId } = selectedVariant;
            const weight = selectedVariant.shippingWeight?.value ?? '';
            const {
              height = '',
              len = '',
              width = '',
            } = selectedVariant.shippingSize ?? {};
            const subParams = getSubParams(
              Static.SQUARESPACE_CONTEXT.product.subscriptionPlan
            );

            cartUrl = `https://${FC.settings.storedomain}/cart?name=${encodeURIComponent(
              name
            )}&quantity=${quantity}&image=${encodeURIComponent(
              image
            )}&category=${encodeURIComponent(category)}&url=${encodeURIComponent(
              productUrl
            )}&price=${price}&quantity_max=${stock}&code=${encodeURIComponent(
              sku
            )}&weight=${weight}&height=${height}&length=${len}&width=${width}&variant_id=${variantId}&${new URLSearchParams(Object.entries(productOptions)).toString()}${subParams}`;

            break;
          }

          // One of the buttons inside of a product block
          // Limitations: weight, height, length, width and category are not supported
          case 'product-block': {
            const productBlock = btn.closest('.product-block');
            const productData = JSON.parse(productBlock.dataset.product);

            const name = productData.title;
            const variantData = productData.variants;

            if (!name || !variantData) {
              console.error('Foxy: Missing product name or variant data');
              alert('Unable to add this product to cart');
              return;
            }

            const quantity =
              productBlock.querySelector('.product-quantity-input input')
                ?.value || 1;
            const image =
              productBlock.querySelector(
                '.sqs-product-block-variant-image.shown'
              )?.src ||
              productData.images[0]?.assetUrl ||
              '';
            const productUrl = `${window.location.origin}${productData.fullUrl}`;

            const productOptions = {};
            const productOptionEls =
              productBlock.querySelectorAll('.variant-option');
            for (const productOptionEl of productOptionEls) {
              const selectEl = productOptionEl.querySelector('select');
              const optionName = selectEl.name;
              const optionValue = selectEl.value;

              if (!optionName || !optionValue) {
                console.error('Foxy: Invalid product option name or value');
                alert('Please choose an option for all fields');
                return;
              }

              productOptions[optionName] = optionValue;
            }

            const selectedVariant = getSelectedVariant(
              variantData,
              productOptions
            );
            if (!selectedVariant) {
              console.error('Foxy: Cannot find a matching selected variant');
              alert('Unable to add this product to cart');
              return;
            }

            const stock = selectedVariant.unlimited
              ? ''
              : selectedVariant.qtyInStock;
            if (selectedVariant.soldOut || stock === 0) {
              console.error('Foxy: No stock available');
              alert('This product is out of stock');
              return;
            }

            const price = productData.onSale
              ? selectedVariant.salePrice.value
              : selectedVariant.price.value;
            const { sku, id: variantId } = selectedVariant;
            const subParams = getSubParams(productData.subscriptionPlan);

            cartUrl = `https://${FC.settings.storedomain}/cart?name=${encodeURIComponent(
              name
            )}&quantity=${quantity}&image=${encodeURIComponent(
              image
            )}&url=${encodeURIComponent(
              productUrl
            )}&price=${price}&quantity_max=${stock}&code=${encodeURIComponent(
              sku
            )}&variant_id=${variantId}&${new URLSearchParams(Object.entries(productOptions)).toString()}${subParams}`;

            break;
          }

          default:
            console.error('Foxy: Unknown button location');
            alert('Unable to add this product to cart');
            return;
        }

        FC.client.event('cart-submit').trigger({
          data: { cart: 'add' },
          url:
            cartUrl +
            // Pass along values in `foxyConfig.params`
            (Object.hasOwn(foxyConfig, 'params')
              ? Object.entries(foxyConfig.params)
                  .map(
                    ([key, value]) =>
                      `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`
                  )
                  .join('')
              : ''),
        });
      });
    });

    function getSelectedVariant(variantData, productOptions) {
      return variantData.length === 1
        ? variantData[0]
        : variantData.find((variant) =>
            Object.entries(productOptions).every(
              ([key, value]) => variant.attributes[key] === value
            )
          );
    }

    function getSubParams(subscriptionPlan) {
      if (!subscriptionPlan) {
        return '';
      }

      const subFrequencyNum = subscriptionPlan.billingPeriod.value;
      const subFrequencyUnit =
        subscriptionPlan.billingPeriod.unit[0].toLowerCase();

      return (
        `&sub_frequency=${subFrequencyNum}${subFrequencyUnit}` +
        (subscriptionPlan.numBillingCycles > 0
          ? `&sub_enddate=${subscriptionPlan.numBillingCycles * subFrequencyNum}${subFrequencyUnit}`
          : '')
      );
    }
  });
};
