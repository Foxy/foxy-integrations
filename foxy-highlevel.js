var FC = FC || {};
const existingOnLoadHighLevel = typeof FC.onLoad == "function" ? FC.onLoad : function () {};
FC.onLoad = function () {
  existingOnLoadHighLevel()
  FC.client.on("ready.done", function () {
    let productItemDetails = null;

    // modify mini-cart links
    // modify mini-cart quantity
    document
      .querySelectorAll(".nav-cart-wrapper")
      ?.forEach(wrapper => {

        const button = wrapper?.querySelector("button");
        const buttonCopy = button?.cloneNode(true);

        button?.remove();
        wrapper?.appendChild(buttonCopy);

        buttonCopy?.addEventListener("click", () => {
          FC.sidecart.show();
        });
        wrapper?.querySelector("button .items-text")?.setAttribute('data-fc-id', 'minicart-quantity');
      });

    FC.client.updateMiniCart();

    // Clone add-to-cart buttons to remove listener conflicts
    const addToCartButtons = document.querySelector("#add-to-cart-btn") || document.querySelector("#buy-now-btn");
    if (addToCartButtons) {
      const addToCartWrapper = addToCartButtons.parentElement;
      const addToCartContainer = addToCartWrapper?.parentElement;
      const addToCartWrapperCopy = addToCartWrapper?.cloneNode(true);
      addToCartWrapper?.remove();
      addToCartContainer?.appendChild(addToCartWrapperCopy);
      addToCartContainer.querySelectorAll("#add-to-cart-btn, #buy-now-btn").forEach(btn => {
        btn?.removeAttribute("disabled");
      });
    }

    document.querySelectorAll("#add-to-cart-btn, #buy-now-btn").forEach(btn => {

      if(window.__NUXT__.data){
        productItemDetails = Object.entries(window.__NUXT__.data || {}).find(([k]) =>
          k.includes("product-store")
        )[1]?.productDetails;
      }
      btn?.addEventListener("click", (e) => {
        const isBuyNow = e.target.id === "buy-now-btn" ? true : false;
        // get product info from elements

        const name = productItemDetails?.name ||
          document.querySelector(".c-product-details .hl-product-detail-product-name")?.textContent;
        if (!name) console.error("Foxy: cannot find product name");

        const quantity =
          document.querySelector(".quantity-container .hl-quantity-input")?.value || 1;

        const cartUrl = `https://${FC.settings.storedomain}/cart?name=${encodeURIComponent(
          name
        )}&quantity=${quantity}`;

        // get variant info from static Squarespace context
        const variantData = productItemDetails?.variants

        if (variantData.length > 0) {
          // product has variants
          // get selected variant name and value from elements
          // TODO: handle multiple variants
        } else {
          // product has no variants
          const price = productItemDetails?.prices[0]?.amount;
          const stock = productItemDetails?.prices[0]?.availableQuantity || "";
          const code = productItemDetails?._id || "";
          const image = productItemDetails.image || document.querySelector(".image-wrapper img")?.src;
          const goToCheckout = isBuyNow ? "&cart=checkout" : "";

          if(!isBuyNow) {
            FC.client.event("cart-submit").trigger({
              data: { cart: "add" },
              url:
                cartUrl +
                `&price=${price}&quantity_max=${stock}&code=${code}&image=${encodeURIComponent(
                  image
                )}&quantity_max=${stock}`,
            });
          } 
          if(isBuyNow){        
            window.location.href =
            cartUrl +
            `&price=${price}&quantity_max=${stock}&code=${code}&image=${encodeURIComponent(
              image
            )}${goToCheckout}`;
          }
        }
      });
    });
  });
};
