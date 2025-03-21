var FC = FC || {};
FC.onLoad = function () {
  FC.client.on('ready.done', function () {
    foxyAddToCart();

    let previousUrl = location.pathname;
    const urlObserver = new MutationObserver(function () {
      if (location.pathname !== previousUrl) {
        previousUrl = location.pathname;
        foxyAddToCart();
        document.querySelector('#foxy-add-btn')?.remove();
      }
    });
    urlObserver.observe(document, { subtree: true, childList: true });

    function foxyAddToCart() {
      const buttonObserver = new MutationObserver(function (mutationsList) {
        if (mutationsList.some((mutation) => mutation.type === 'childList')) {
          // mini-cart link
          const cartBtnIcon = document.querySelector('button.cart-icon svg');
          const foxyMiniCart = document.querySelector('#foxy-mini-cart');
          if (!!cartBtnIcon && !foxyMiniCart) {
            const cartBtn = document.querySelector('button.cart-icon');
            const cartLink = document.createElement('a');
            cartLink.href = `https://${FC.settings.storedomain}.foxycart.com/cart?cart=view`;
            cartLink.id = 'foxy-mini-cart';
            const clonedBtn = cartBtn.cloneNode(true);
            cartLink.appendChild(clonedBtn);
            cartBtn.parentNode.replaceChild(cartLink, cartBtn);
          }

          // mini-cart quantity
          const cartQty = document.querySelector('.nav-icon__cart-number');
          if (!!cartQty && !cartQty.hasAttribute('data-fc-id')) {
            cartQty.setAttribute('data-fc-id', 'minicart-quantity');
          }

          // add to cart button
          const buttonWrapper = Array.from(
            document.querySelectorAll('[showaddtocartbutton="true"]')
          ).find((el) => el.getBoundingClientRect().width !== 0);
          const foxyAddBtn = document.querySelector('#foxy-add-btn');

          if (!!buttonWrapper && !foxyAddBtn) {
            const button =
              buttonWrapper.querySelector('button') ||
              buttonWrapper.closest('button');

            buttonObserver.disconnect();

            const newButton = button.cloneNode(true);
            newButton.children[1].remove();
            newButton.id = 'foxy-add-btn';
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', clickEventListener);

            function clickEventListener() {
              const name =
                document.querySelector('.product__title')?.innerText || '';
              const price =
                document.querySelector('.product__price')?.lastElementChild
                  .innerText || '';
              const image =
                Array.from(
                  document.querySelectorAll('.carousel__image img')
                ).find((el) => el.src).src || '';
              const quantity =
                document.querySelectorAll('.quantity__wrapper span')[2]
                  ?.innerText || 1;
              const productOptions = document.querySelectorAll('.form-item');

              if (!!name && !!price) {
                let cartUrl = `https://${
                  FC.settings.storedomain
                }/cart?name=${encodeURIComponent(
                  name
                )}&price=${price}&quantity=${quantity}&image=${encodeURIComponent(
                  image
                )}`;

                if (productOptions.length === 0) {
                  FC.client.event('cart-submit').trigger({
                    data: { cart: 'add' },
                    url: cartUrl,
                  });
                } else if (
                  productOptions.length > 0 &&
                  Array.from(productOptions).some(
                    (option) => !!option.querySelector('select').value
                  )
                ) {
                  productOptions.forEach((option) => {
                    const optionValue = option
                      .querySelector('select')
                      .selectedOptions[0].innerText.trim();
                    cartUrl += `&Option=${encodeURIComponent(optionValue)}`;
                  });

                  FC.client.event('cart-submit').trigger({
                    data: { cart: 'add' },
                    url: cartUrl,
                  });
                }
              }
            }
          }
        }
      });

      buttonObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  });
};
