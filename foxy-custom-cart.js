var FC = FC || {};
var existingOnload =
  typeof FC.onLoad == 'function' ? FC.onLoad : function () {};
FC.onLoad = function () {
  existingOnload();
  FC.client
    .on('ready.done', initCustomCart)
    .on('cart-submit.done', () => {
      $('[foxy-id="cart-trigger"]').trigger('click');
      initCustomCart();
    })
    .on('cart-update.done', initCustomCart)
    .on('cart-item-quantity-update.done', initCustomCart)
    .on('cart-item-remove.done', initCustomCart);
};

function initCustomCart() {
  const cartQtyEl = document.querySelector('[foxy-id="cart-quantity"]');
  if (!!cartQtyEl) {
    $(cartQtyEl).text(FC.json.item_count);
  }

  const cartSubtotalEl = document.querySelector('[foxy-id="cart-subtotal"]');
  if (!!cartSubtotalEl) {
    $(cartSubtotalEl).text(formatMoney(FC.json.total_item_with_tax_price));
  }

  const cartEmptyEl = document.querySelector('[foxy-id="cart-empty"]');
  const cartHasItemsEl = document.querySelector('[foxy-id="cart-has-items"]');
  if (FC.json.item_count > 0) {
    $(cartEmptyEl)?.css('display', 'none');
    $(cartHasItemsEl)?.css('display', '');
  } else {
    $(cartEmptyEl)?.css('display', '');
    $(cartHasItemsEl)?.css('display', 'none');
  }

  const cartItemsEl = document.querySelector('[foxy-id="cart-items"]');
  const cartItemEl = document.querySelector('[foxy-id="cart-item"]');
  if (!!cartItemsEl && !!cartItemEl) {
    cartItemsEl.innerHTML = '';
    cartItemsEl.append(cartItemEl);
    cartItemEl.style.display = 'none';

    FC.json.items.forEach(
      ({
        name,
        price_with_tax,
        price_each_with_tax,
        code,
        category,
        quantity,
        weight_each,
        image,
        id,
        options,
        sub_frequency,
        sub_startdate,
        sub_nextdate,
        sub_enddate,
      }) => {
        const newItem = cartItemEl.cloneNode(true);
        newItem.style.removeProperty('display');

        $(newItem).find('[foxy-id="cart-item-name"]')?.text(name);
        $(newItem)
          .find('[foxy-id="cart-item-price"]')
          ?.text(formatMoney(price_each_with_tax));
        $(newItem)
          .find('[foxy-id="cart-item-total"]')
          ?.text(formatMoney(price_with_tax));
        $(newItem).find('[foxy-id="cart-item-code"]')?.text(code);
        $(newItem).find('[foxy-id="cart-item-quantity"]')?.text(quantity);
        $(newItem).find('[foxy-id="cart-item-image"]')?.attr('src', image);

        if (category !== 'DEFAULT') {
          $(newItem).find('[foxy-id="cart-item-category"]')?.text(category);
        } else {
          $(newItem).find('[foxy-id="cart-item-category"]')?.text('');
        }

        if (weight_each !== 0) {
          $(newItem).find('[foxy-id="cart-item-weight"]')?.text(weight_each);
          $(newItem)
            .find('[foxy-id="cart-item-weight-unit"]')
            ?.text(FC.json.weight_uom);
        } else {
          $(newItem).find('[foxy-id="cart-item-weight"]')?.text('');
          $(newItem).find('[foxy-id="cart-item-weight-unit"]')?.text('');
        }

        if (sub_frequency !== '') {
          $(newItem)
            .find('[foxy-id="cart-item-sub-frequency"]')
            ?.text(sub_frequency);
          $(newItem)
            .find('[foxy-id="cart-item-sub-start-date"]')
            ?.text(sub_startdate);
          $(newItem)
            .find('[foxy-id="cart-item-sub-next-date"]')
            ?.text(sub_nextdate);

          if (sub_enddate !== '0000-00-00') {
            $(newItem)
              .find('[foxy-id="cart-item-sub-end-date"]')
              ?.text(sub_enddate);
          } else {
            $(newItem).find('[foxy-id="cart-item-sub-end-date"]')?.text('');
          }
        } else {
          $(newItem).find('[foxy-id="cart-item-sub-frequency"]')?.text('');
          $(newItem).find('[foxy-id="cart-item-sub-start-date"]')?.text('');
          $(newItem).find('[foxy-id="cart-item-sub-next-date"]')?.text('');
          $(newItem).find('[foxy-id="cart-item-sub-end-date"]')?.text('');
        }

        const optionEl = newItem.querySelector('[foxy-id="cart-item-option"]');
        if (optionEl) {
          if (options.length > 0) {
            options.forEach((option) => {
              const newOptionEl = optionEl.cloneNode(true);

              $(newOptionEl).css('display', '');
              $(newOptionEl)
                .find('[foxy-id="cart-item-option-name"]')
                .text(option.name);
              $(newOptionEl)
                .find('[foxy-id="cart-item-option-value"]')
                .text(option.value);

              $(optionEl).after(newOptionEl);
            });
          }

          optionEl.remove();
        }

        const qtyInputEl = newItem.querySelector(
          '[foxy-id="cart-item-quantity-input"]'
        );
        if (!!qtyInputEl) {
          qtyInputEl.value = quantity;
          qtyInputEl.addEventListener('change', (event) =>
            updateQty(event.target.value)
          );
        }

        newItem
          .querySelector('[foxy-id="cart-item-remove"]')
          ?.addEventListener('click', () => updateQty(0));
        newItem
          .querySelector('[foxy-id="cart-item-plus"]')
          ?.addEventListener('click', () => updateQty(quantity + 1));
        newItem
          .querySelector('[foxy-id="cart-item-minus"]')
          ?.addEventListener('click', () => updateQty(quantity - 1));

        function updateQty(newQty) {
          FC.client
            .request(
              `https://${FC.settings.storedomain}/cart?cart=update&quantity=${newQty}&id=${id}`
            )
            .done(() => {
              initCustomCart();

              const upsellItem = document.querySelector(
                `[foxy-id="upsell-item-${id}"]`
              );
              if (newQty === 0 && !!upsellItem) {
                upsellItem.style.removeProperty('display');
                upsellItem.setAttribute('foxy-id', 'upsell-item');
              }
            });
        }

        cartItemsEl.appendChild(newItem);
      }
    );
  }

  function formatMoney(amount) {
    return FC.util.money_format(FC.json.config.currency_format, amount).trim();
  }
}
