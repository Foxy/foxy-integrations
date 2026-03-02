var FC = FC || {};
FC.onLoad = function () {
  FC.client.on('ready.done', function () {
    const foxyConfig = window.foxyConfig || {};

    // modify mini-cart links
    document
      .querySelectorAll('.sqs-custom-cart')
      .forEach(
        (link) =>
          (link.href = `https://${FC.settings.storedomain}/cart?cart=view`)
      );

    // modify mini-cart quantity
    document
      .querySelectorAll('.sqs-cart-quantity')
      .forEach((qty) => qty.setAttribute('data-fc-id', 'minicart-quantity'));

    FC.client.updateMiniCart();

    document.querySelectorAll('.sqs-add-to-cart-button').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        // get product info from elements
        const name =
          document.querySelector('.ProductItem-details-title, .product-title')
            ?.textContent || Static.SQUARESPACE_CONTEXT.item.title;
        if (!name) {
          console.error('Foxy: cannot find product name');
          return;
        }

        const quantity =
          document.querySelector('.product-quantity-input input')?.value ||
          document.querySelector('input.product-quantity-input')?.value ||
          1;
        const image =
          document.querySelector(
            '.ProductItem-gallery-slides-item-image, .product-gallery-slides-item-image, .pdp-gallery-slides-image'
          )?.src || '';
        const category =
          document.querySelector('input[name="foxy-category"]')?.value || '';

        const cartUrl = `https://${
          FC.settings.storedomain
        }/cart?name=${encodeURIComponent(
          name
        )}&quantity=${quantity}&image=${encodeURIComponent(
          image
        )}&category=${encodeURIComponent(category)}&url=${encodeURIComponent(
          window.location.href
        )}`;

        // get variant info from static Squarespace context
        const variantData = Static.SQUARESPACE_CONTEXT.product.variants;

        const optionEls = document.querySelectorAll(
          '#main-product-variants .variant-option'
        );

        const options = {};
        for (const optionEl of optionEls) {
          const selectEl = optionEl.querySelector('.variant-select');
          const optionName =
            optionEl.dataset.variantOptionName ||
            selectEl.dataset.variantOptionName;
          const optionValue = selectEl.value;

          if (!optionName || !optionValue) {
            console.error('Foxy: invalid option name or value');
            return;
          }

          options[optionName] = optionValue;
        }

        const selectedVariant =
          variantData.length === 1
            ? variantData[0]
            : variantData.find((variant) =>
                Object.entries(options).every(
                  ([key, value]) => variant.attributes[key] === value
                )
              );

        if (!selectedVariant) {
          console.error('Foxy: cannot find a matching selected variant');
          return;
        }

        const price = selectedVariant.onSale
          ? selectedVariant.salePrice.decimalValue
          : selectedVariant.price.decimalValue;
        const stock = selectedVariant.stock.quantity || '';
        const { sku, id: variantId } = selectedVariant;
        const weight = selectedVariant.shippingWeight?.value ?? '';
        const {
          height = '',
          len = '',
          width = '',
        } = selectedVariant.shippingSize ?? {};

        if (stock !== 0) {
          FC.client.event('cart-submit').trigger({
            data: { cart: 'add' },
            url:
              `${cartUrl}&price=${price}&quantity_max=${stock}&code=${encodeURIComponent(
                sku
              )}&weight=${weight}&height=${height}&length=${len}&width=${width}&variant_id=${variantId}&${new URLSearchParams(Object.entries(options)).toString()}` +
              (Object.hasOwn(foxyConfig, 'params')
                ? Object.entries(foxyConfig.params)
                    .map(
                      ([key, value]) =>
                        `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`
                    )
                    .join('')
                : ''),
          });
        } else {
          console.error('Foxy: no stock available');
          return;
        }
      });
    });
  });
};
