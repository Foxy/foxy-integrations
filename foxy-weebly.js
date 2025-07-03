var FC = FC || {};
FC.onLoad = function () {
  FC.client.on('ready.done', function () {
    const miniCartEl = document.querySelector('#wsite-nav-cart-a');
    if (miniCartEl) {
      miniCartEl.href = `https://${FC.settings.storedomain}/cart?cart=view`;
    }

    document
      .querySelector('#wsite-nav-cart-num')
      ?.setAttribute('data-fc-id', 'minicart-quantity');

    FC.client.updateMiniCart();

    document
      .querySelector('#wsite-com-product-add-to-cart')
      ?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        const name = document
          .querySelector('#wsite-com-product-title')
          ?.textContent.trim();
        if (!name) {
          console.error('Foxy: Cannot find product name');
          return;
        }

        const price = document.querySelector('[itemprop="price"]')?.textContent;
        if (!price) {
          console.error('Foxy: Cannot find product price');
          return;
        }

        const code =
          document
            .querySelector('#wsite-com-product-sku-value')
            ?.textContent.trim() || '';
        const image =
          document.querySelector('#wsite-com-product-images img')?.src || '';

        const quantityEl = document.querySelector(
          '#wsite-com-product-quantity-input'
        );
        const quantity = quantityEl?.value || 1;
        const quantityMax = quantityEl?.max || '';

        const atcUrl = `https://${
          FC.settings.storedomain
        }/cart?name=${encodeURIComponent(
          name
        )}&price=${price}&quantity=${quantity}&quantity_max=${quantityMax}&code=${encodeURIComponent(
          code
        )}&image=${encodeURIComponent(image)}&url=${encodeURIComponent(
          window.location.href
        )}`;

        const productOptionEl = Array.from(
          document.querySelectorAll('.wsite-com-product-option select')
        );
        if (productOptionEl.some((el) => !el.value)) {
          return;
        }
        const optionParams = productOptionEl
          .map(
            (el) =>
              `&${encodeURIComponent(el.name)}=${encodeURIComponent(el.value)}`
          )
          .join('');

        FC.client.event('cart-submit').trigger({
          data: { cart: 'add' },
          url: atcUrl + optionParams,
        });
      });
  });
};
