export default function init(foxyConfig) {
  window.FC = window.FC || {};
  window.FC.onLoad = function () {
    window.FC.client.on('ready.done', function () {
      document
        .querySelector('.w-commerce-commerceaddtocartbutton')
        ?.addEventListener('click', (e) => {
          e.preventDefault();

          const name = document.querySelector(
            '[foxy-product-option="name"]'
          )?.innerText;
          if (!name) {
            console.error('Foxy: Cannot find product name');
            return;
          }

          let price = document
            .querySelector('[foxy-product-option="price"]')
            ?.innerText.replace(/[^\d,.]/g, '');
          if (price.charAt(price.length - 3) === ',') {
            price = price.replace(/[.]/g, '').replace(/[,]/g, '.');
          }
          if (!price) {
            console.error('Foxy: Cannot find product price');
            return;
          }

          const code =
            document.querySelector('[foxy-product-option="code"]')?.innerText ||
            '';
          const image =
            document.querySelector('[foxy-product-option="image"]')?.src || '';
          const quantity =
            document.querySelector('.w-commerce-commerceaddtocartquantityinput')
              ?.value || 1;

          let cartUrl = `https://${
            FC.settings.storedomain
          }/cart?name=${encodeURIComponent(
            name
          )}&price=${price}&code=${encodeURIComponent(
            code
          )}&quantity=${quantity}&image=${encodeURIComponent(
            image
          )}&url=${encodeURIComponent(window.location.href)}`;

          const optionEls = Array.from(
            document.querySelectorAll(
              '[data-node-type="commerce-add-to-cart-option-list"] > div'
            )
          );
          const options = [];
          optionEls.forEach((optionEl) => {
            const optionName = optionEl.firstElementChild.innerText;
            const selectEl = optionEl.querySelector('select');
            const optionVal = selectEl
              ? selectEl.selectedIndex === 0
                ? ''
                : selectEl.options[selectEl.selectedIndex].text
              : optionEl.querySelector('.w--ecommerce-pill-selected')
                  ?.innerText || '';

            options.push({ [optionName]: optionVal });
          });

          if (!options.some((param) => Object.values(param)[0] === '')) {
            const optionParams = options
              .map((param) => {
                const paramName = Object.keys(param)[0];
                const paramVal = param[paramName];

                if (paramName === foxyConfig.frequencyGroupLabel) {
                  const text = paramVal.split(' ');
                  const frequency = text[0];
                  const unit = text[1][0];

                  return `&sub_frequency=${frequency}${unit}`;
                } else {
                  return `&${encodeURIComponent(
                    paramName
                  )}=${encodeURIComponent(paramVal)}`;
                }
              })
              .join('');

            FC.client.event('cart-submit').trigger({
              data: { cart: 'add' },
              url: cartUrl + optionParams,
            });
          }
        });
    });
  };
}
