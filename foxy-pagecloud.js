var FC = FC || {};
FC.onLoad = function () {
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
          const atcBtn = document.querySelector(
            '.details-product-purchase__add-to-bag button'
          );

          if (atcBtn) {
            atcBtn.addEventListener('click', (e) => handleAddToCart(e));
          }
        }
      });

      buttonObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    function handleAddToCart(e) {
      e.stopImmediatePropagation();

      const name = document.querySelector(
        'h1.product-details__product-title'
      ).innerText;
      if (!name) {
        console.error('Foxy: cannot find product name');
        return;
      }

      const price = document.querySelector(
        '.details-product-price__value.ec-price-item'
      ).innerText;
      if (!price) {
        console.error('Foxy: cannot find product price');
        return;
      }

      const quantity = document.querySelector('#qty-field')?.value || 1;
      const image =
        document.querySelector('.details-gallery__picture')?.src || '';
      const code =
        document
          .querySelector('.product-details__product-sku')
          ?.innerText.split('SKU ')[1] || '';
      const weight =
        document
          .querySelector(
            '.product-details__product-weight .details-product-attribute__value'
          )
          ?.innerText.split(' ')[0] || '';

      const options = Array.from(
        document.querySelectorAll(
          '.product-details-module.details-product-option'
        )
      );
      const optionsParams = options.map((option) => {
        const optionName = option.querySelector(
          '.details-product-option__title'
        ).innerText;
        const optionVal =
          option.querySelector(
            `input[name="${optionName}"][type="radio"]:checked`
          )?.value ||
          option.querySelector(`input[name="${optionName}"][type="text"]`)
            ?.value;

        if (!optionVal) return '';

        return `&${encodeURIComponent(optionName)}=${encodeURIComponent(
          optionVal
        )}`;
      });
      if (
        options.length !== optionsParams.filter((param) => param !== '').length
      ) {
        return;
      }

      const atcLink =
        `https://${FC.settings.storedomain}/cart?name=${encodeURIComponent(
          name
        )}&price=${price}&quantity=${quantity}&image=${encodeURIComponent(
          image
        )}&code=${encodeURIComponent(code)}&weight=${weight}` +
        optionsParams.join('');

      FC.client.event('cart-submit').trigger({
        data: { cart: 'add' },
        url: atcLink,
      });
    }
  });
};
