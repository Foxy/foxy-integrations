var FC = FC || {};
FC.onLoad = function () {
  FC.client.on('ready.done', function () {
    foxyAddToCart();

    let previousUrl = location.pathname;
    const urlObserver = new MutationObserver(function () {
      if (location.pathname !== previousUrl) {
        previousUrl = location.pathname;
        foxyAddToCart();
      }
    });
    urlObserver.observe(document, { subtree: true, childList: true });

    function foxyAddToCart() {
      const foxyForm = document.querySelector('[data-foxy-product="form"]');

      if (!foxyForm) return;

      foxyForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const formData = new FormData(e.target);
        const formValues = Object.fromEntries(formData.entries());
        const { name, price, cart, ...params } = formValues;
        const image =
          document.querySelector('[data-foxy-product="image"] img')?.src ||
          foxyForm.querySelector('img')?.src ||
          '';

        if (!name || !price) {
          console.error('Foxy: Cannot find product name or price');
          return;
        }

        const cartUrl =
          `https://${FC.settings.storedomain}/cart?name=${encodeURIComponent(
            name
          )}&price=${price}` +
          Object.entries({ ...params, image })
            .map(
              ([key, value]) =>
                `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`
            )
            .join('');

        if (cart === 'checkout') {
          window.location.href = `${cartUrl}&cart=checkout`;
        } else {
          FC.client.event('cart-submit').trigger({
            data: { cart: 'add' },
            url: cartUrl,
          });
        }
      });
    }
  });
};
