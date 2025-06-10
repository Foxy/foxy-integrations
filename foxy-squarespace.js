var FC = FC || {};

FC.onLoad = function () {
  FC.client.on('ready.done', function () {
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
      btn.addEventListener('click', () => {
        // get product info from elements
        const name =
          document.querySelector('.ProductItem-details-title')?.innerText ||
          Static.SQUARESPACE_CONTEXT.item.title;
        if (!name) console.error('Foxy: cannot find product name');

        const quantity =
          document.querySelector('.product-quantity-input')?.lastElementChild
            .value || 1;
        const image =
          document.querySelector('.ProductItem-gallery-slides-item-image')
            ?.src || '';
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

        // select elements for variants
        const variantSelect = document.querySelectorAll(
          'select[data-variant-option-name]'
        );

        if (variantSelect.length > 0) {
          // product has variants
          // get selected variant name and value from elements
          const allVariantName = Array.from(variantSelect).map(
            (variant) => variant.dataset.variantOptionName
          );
          const allVariantValue = Array.from(variantSelect).map(
            (variant) => variant.value
          );

          // if all variants have valid selected values
          if (!allVariantValue.includes('')) {
            // concat variant name and value
            let variantParam = '';

            allVariantName.forEach(
              (name, index) =>
                (variantParam += `&${encodeURIComponent(
                  name
                )}=${encodeURIComponent(allVariantValue[index])}`)
            );

            // find the selected variant info from variant data
            let selectedVariant;

            if (allVariantName.length === 1) {
              selectedVariant = variantData.find(
                (variant) =>
                  variant.attributes[allVariantName[0]] === allVariantValue[0]
              );
            } else if (allVariantName.length === 2) {
              selectedVariant = variantData.find(
                (variant) =>
                  variant.attributes[allVariantName[0]] ===
                    allVariantValue[0] &&
                  variant.attributes[allVariantName[1]] === allVariantValue[1]
              );
            } else if (allVariantName.length === 3) {
              selectedVariant = variantData.find(
                (variant) =>
                  variant.attributes[allVariantName[0]] ===
                    allVariantValue[0] &&
                  variant.attributes[allVariantName[1]] ===
                    allVariantValue[1] &&
                  variant.attributes[allVariantName[2]] === allVariantValue[2]
              );
            }

            // get product info from variant data
            const price = selectedVariant.onSale
              ? selectedVariant.salePrice.decimalValue
              : selectedVariant.price.decimalValue;
            const stock = selectedVariant.stock.quantity || '';
            const { sku, id: variantId } = selectedVariant;
            const weight = selectedVariant.shippingWeight.value;
            const { height, len, width } = selectedVariant.shippingSize;

            // trigger Foxy cart-submit event only if product is in stock
            if (stock !== 0) {
              FC.client.event('cart-submit').trigger({
                data: { cart: 'add' },
                url:
                  cartUrl +
                  variantParam +
                  `&price=${price}&quantity_max=${stock}&code=${variantId}&SKU=${encodeURIComponent(
                    sku
                  )}&weight=${weight}&height=${height}&length=${len}&width=${width}`,
              });
            }
          }
        } else {
          // product has no variants
          const price = variantData[0].onSale
            ? variantData[0].salePrice.decimalValue
            : variantData[0].price.decimalValue;
          const stock = variantData[0].stock.quantity || '';
          const { sku, id: variantId } = variantData[0];
          const weight = variantData[0].shippingWeight.value;
          const { height, len, width } = variantData[0].shippingSize;

          // trigger Foxy cart-submit event only if product is in stock
          if (stock !== 0) {
            FC.client.event('cart-submit').trigger({
              data: { cart: 'add' },
              url:
                cartUrl +
                `&price=${price}&quantity_max=${stock}&code=${variantId}&SKU=${encodeURIComponent(
                  sku
                )}&weight=${weight}&height=${height}&length=${len}&width=${width}`,
            });
          }
        }
      });
    });
  });
};
