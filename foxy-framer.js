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
      const form = document.querySelector('[data-foxy-product="form"]');

      if (!form) return;

      form.addEventListener('submit', (e) => {
        e.preventDefault();

        const formData = new FormData(e.target);
        const formValues = Object.fromEntries(formData.entries());
        const { name, price, ...params } = formValues;
        const image =
          document.querySelector('[data-foxy-product="image"] img')?.src ||
          form.querySelector('img')?.src ||
          '';

        if (!name || !price) {
          console.error('Foxy: Cannot find product name or price');
          return;
        }

        FC.client.event('cart-submit').trigger({
          data: { cart: 'add' },
          url:
            `https://${FC.settings.storedomain}/cart?name=${encodeURIComponent(
              name
            )}&price=${price}` +
            Object.entries({ ...params, image })
              .map((param) => `&${param[0]}=${param[1]}`)
              .join(''),
        });
      });
    }
  });
};
