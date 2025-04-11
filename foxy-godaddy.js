export default function init(foxyConfig) {
  const buttonObserver = new MutationObserver(function (mutationsList) {
    if (mutationsList.some((mutation) => mutation.type === 'childList')) {
      const gdAddBtn = parent.document.querySelector(
        '[data-aid="ADD_TO_CART"]'
      );
      if (gdAddBtn && !gdAddBtn.dataset.listenerAttached) {
        gdAddBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopImmediatePropagation();
          foxyAddToCart(foxyConfig);
        });
        gdAddBtn.dataset.listenerAttached = 'true';
      }
    }
  });

  buttonObserver.observe(parent.document.body, {
    childList: true,
    subtree: true,
  });
}

function foxyAddToCart(foxyConfig) {
  const name = parent.document.querySelector(
    '[data-aid="PRODUCT_NAME_RENDERED"]'
  )?.textContent;
  if (!name) {
    console.error('Foxy: Cannot find product name');
    return;
  }

  const price = parent.document
    .querySelector('[data-aid="PRODUCT_PRICE_RENDERED"]')
    ?.textContent.replace(/[^0-9.]/g, '');
  if (!price) {
    console.error('Foxy: Cannot find product price');
    return;
  }

  const quantity =
    parent.document.querySelector('[data-aid="PRODUCT_QUANTITY"]')?.value || 1;
  const image =
    parent.document.querySelector('#ols-image-wrapper img')?.src || '';

  const url = `https://${foxyConfig.storeDomain}/cart?name=${encodeURIComponent(
    name
  )}&price=${price}&quantity=${quantity}&image=${encodeURIComponent(image)}`;

  parent.window.location.href = url;
}
