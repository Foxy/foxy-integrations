// Foxy Customer Portal Content Protection - Attributes v2.0
var FC = FC || {};
(function (FC) {
  const DEFAULT_SETTINGS = {
    protectedPath: "/members",
    loginOrSignupPath: "/",
    loginRedirect: "",
    redirectIfNoActiveSubscriptions: false,
    useLatestTransactionOnly: false,
    ignoreSubscriptionsWithPastDue: false,
    removeElementsFromPage: false,
    webhookEndpointURL: "",
  };

  let SETTINGS = resolvedSettings();

  let {
    protectedPath,
    loginOrSignupPath,
    loginRedirect,
    redirectIfNoActiveSubscriptions,
    useLatestTransactionOnly,
    ignoreSubscriptionsWithPastDue,
    removeElementsFromPage,
    webhookEndpointURL,
  } = SETTINGS;

  let authenticated = false,
    activeSubs = 0,
    activeSubCodes = [],
    hasDynamicRedirect = false;
  (transactionCodes = []),
    (pastDueAmount = 0),
    (customerDetails = {}),
    (customerAttributes = {}),
    (portal = document.getElementsByTagName("foxy-customer-portal")[0]),
    (portalSessionKey = "session"),
    // Custom Foxy Attributes
    (attributeIfAuthenticated = '[foxy-logic-authenticated="true"]'),
    (attributeIfAnonymous = '[foxy-logic-authenticated="false"]'),
    (attributeIfSubscriber = '[foxy-logic-subscribed="true"]'),
    (attributeIfNotSubscriber = '[foxy-logic-subscribed="false"]'),
    (attributeIfSubscriberByCode = "[foxy-logic-subscribed-to]"), // subscription code is appended to the end of this class
    (attributeIfNotSubscriberByCode = "[foxy-logic-not-subscribed-to]"), // subscription code is appended to the end of this class
    (attributeIfTransactionByCode = "[foxy-logic-transaction-includes]"), // transaction code is appended to the end of this class
    (attributeIfNotTransactionByCode = "[foxy-logic-transaction-not-includes]"), // transaction code is appended to the end of this class
    (attributeIfAttributeByName = "[foxy-logic-customer-attribute-includes]"), // attribute name (lowercase) is appended to the end of this class
    (attributeIfNotAttributeByName = "[foxy-logic-customer-attribute-not-includes]"), // attribute name (lowercase) is appended to the end of this class
    (attributeIfSubscriberPastDue = '[foxy-logic-subscriber-past-due="true"]'),
    (attributeIfNotSubscriberPastDue = '[foxy-logic-subscriber-past-due="false"]'),
    (attributeSubscriberPastDueAmount = '[foxy-logic-display="subscription-past-due-amount"]'),
    (attributeCustomerId = '[foxy-logic-display="customer-id"]'),
    (attributeCustomerFirstName = '[foxy-logic-display="customer-first-name"]'),
    (attributeCustomerLastName = '[foxy-logic-display="customer-last-name"]'),
    (attributeCustomerEmail = '[foxy-logic-display="customer-email-address"]'),
    (attributeIfAttributeFavorite = "[foxy-logic-favorite-includes]"),
    (attributeIfAttributeNotFavorite = "[foxy-logic-favorite-not-includes]"),
    (attributeItemFavoriteCode = "[foxy-logic-favorite-code]"),
    (attributeCustomerFavorite = '[foxy-logic-action="favorite"]'),
    (attributeCustomerUnfavorite = '[foxy-logic-action="unfavorite"]'),
    (attributeCustomerLogout = '[foxy-logic-action="logout"]');

  // Support multiple protected paths (or a single string for backwards compatibility)
    let protectedPaths = Array.isArray(protectedPath)
      ? protectedPath.filter(Boolean)
      : protectedPath
      ? [protectedPath]
      : [];

  customElements.whenDefined("foxy-customer-portal").then(() => {
    if (portal) {
      portal.addEventListener("signin", function (event) {
        showSpinnerAnimation(event.detail.forcePasswordReset);
        fetchCustomerData(!event.detail.forcePasswordReset);
      });

      portal.addEventListener("passwordreset", function (event) {
        handleOnLogInRedirect();
      });

      portal.addEventListener("signout", function () {
        clearLocalStorage();
        updatePage();
      });

      checkAuthentication();
      if (authenticated) {
        // Fetch customer any time the portal is loaded in case they've made a purchase since logging in
        fetchCustomerData(false);
      }
    }
  });

  function clearLocalStorage() {
    localStorage.removeItem("fx.customer.attributes");
    localStorage.removeItem("fx.customer.details");
    localStorage.removeItem("fx.customer.firstName"); // legacy - remove later
    localStorage.removeItem("fx.customer.subs");
    localStorage.removeItem("fx.customer.transactions");
    authenticated = false;
    activeSubs = 0;
    activeSubCodes = [];
    pastDueAmount = 0;
    transactionCodes = [];
    customerDetails = {};
    customerAttributes = {};
  }

  function resolvedSettings() {
    const fromGlobal =
      window.foxyPortalLogicConfig && typeof window.foxyPortalLogicConfig === "object"
        ? window.foxyPortalLogicConfig
        : {};

    return Object.assign({}, DEFAULT_SETTINGS, fromGlobal);
  }

  document.addEventListener("click", async function (event) {
    const target = event.target;
    if (event.target.matches(attributeCustomerLogout + "," + attributeCustomerLogout + " *")) {
      localStorage.removeItem(portalSessionKey);
      clearLocalStorage();
      window.location.reload();
      return;
    }
    if (target.matches(attributeCustomerUnfavorite) || target.matches(attributeCustomerFavorite))
      await handleFavorites(event);
  });

  let fetchCustomerData = async function (allowRedirect = true) {
    let sessionToken = getSessionToken();
    if (sessionToken) {
      const store =
        portal?.getAttribute("base")?.split("/s/")[0] ??
        JSON.parse(localStorage.getItem("session")).sso.split("/checkout")[0];
      const headers = {
        "Content-Type": "application/json",
        "FOXY-API-VERSION": "1",
        Authorization: "Bearer " + sessionToken,
      };
      const [customerResponse, transactionResponse, subscriptionResponse] = await Promise.all([
        fetch(store + "/s/customer", { headers }),
        fetch(store + "/s/customer/transactions?zoom=items,items:item_options", { headers }),
        fetch(
          store +
            "/s/customer/subscriptions?zoom=transaction_template,transaction_template:items,transaction_template:items:item_options",
          { headers }
        ),
      ]);

      const customerData = await customerResponse.json();
      const transactionData = await transactionResponse.json();
      const subscriptionData = await subscriptionResponse.json();

      const existingAuthentication = authenticated;
      checkAuthentication();

      if (customerData) {
        customerDetails = {
          id: customerData.id,
          first_name: customerData.first_name,
          last_name: customerData.last_name,
          email: customerData.email,
          last_login_date: customerData.last_login_date,
        };
        localStorage.setItem("fx.customer.details", JSON.stringify(customerDetails));

        customerAttributes = {};
        if (customerData._embedded?.["fx:attributes"]) {
          let attributes = customerData._embedded["fx:attributes"];
          for (let i = 0; i < attributes.length; i++) {
            let attribute = attributes[i];
            let attribute_name = attribute.name.replace(" ", "_");
            customerAttributes[attribute_name] = {
              id: attribute._links.self.href.split("/attributes/")[1],
              value: attribute.value,
            };
          }
        }
        localStorage.setItem("fx.customer.attributes", JSON.stringify(customerAttributes));
      }

      transactionCodes = [];
      if (transactionData._embedded?.["fx:transactions"]) {
        let transactions = transactionData._embedded["fx:transactions"];
        for (let t = 0; t < transactions.length; t++) {
          let items = transactions[t]?._embedded?.["fx:items"];
          if (!items || !items.length) continue;
          for (let i = 0; i < items.length; i++) {
            if (items[i].code != "" && transactionCodes.indexOf(items[i].code) === -1) {
              transactionCodes.push(items[i].code);
            }
          }
          if (useLatestTransactionOnly && i == 0) break;
        }
      }
      localStorage.setItem("fx.customer.transactions", JSON.stringify({ codes: transactionCodes }));

      activeSubCodes = [];
      pastDueAmount = 0;
      if (subscriptionData._embedded?.["fx:subscriptions"]) {
        let subscriptions = subscriptionData._embedded["fx:subscriptions"];
        for (let s = 0; s < subscriptions.length; s++) {
          let subscription = subscriptions[s];

          if (subscription.is_active) {
            if (
              !ignoreSubscriptionsWithPastDue ||
              (ignoreSubscriptionsWithPastDue && subscription.past_due_amount == 0)
            ) {
              activeSubs += 1;
            }
            if (subscription.past_due_amount > 0) {
              pastDueAmount += subscription.past_due_amount;
            }
            let items = subscription._embedded["fx:transaction_template"]._embedded["fx:items"];
            for (let i = 0; i < items.length; i++) {
              if (items[i].code != "" && activeSubCodes.indexOf(items[i].code) === -1) {
                activeSubCodes.push(items[i].code);
              }
            }
          }
        }
      }
      localStorage.setItem(
        "fx.customer.subs",
        JSON.stringify({
          count: activeSubs,
          codes: activeSubCodes,
          past_due_amount: pastDueAmount,
        })
      );

      const event = new Event("fx.fetch.done");

      // Dispatch the event.
      window.dispatchEvent(event);

      // Change loginRedirect if dynamic redirect present
      checkForDynamicRedirect();
      // Redirect if loginRedirect set instead of showing the portal
      if (!existingAuthentication && allowRedirect) {
        handleOnLogInRedirect();
      }
    }
    updatePage();
  };
  let handleOnLogInRedirect = function () {
    if (
      loginRedirect != "" &&
      authenticated &&
      !window.location.pathname.match(new RegExp("^" + loginRedirect))
    ) {
      window.location.assign(window.location.origin + loginRedirect);
    }
  };
  let showSpinnerAnimation = function (forcePasswordReset) {
    checkForDynamicRedirect();
    if (
      loginRedirect != "" && !forcePasswordReset &&
      !window.location.pathname.match(new RegExp("^" + loginRedirect))
    ) {
      portal.parentElement.style.display = "none";
      portal.parentElement.insertAdjacentHTML(
        "beforebegin",
        '<style>.spinner {animation: rotate 2s linear infinite;z-index: 2;width: 50px;height: 50px;}</style><div style="display:flex; justify-content:center; margin-top:35vh"><svg class="spinner" viewBox="0 0 50 50"><circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle></svg></div>'
      );
    }
  };

  function escapeForRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function isOnProtectedPath() {
    return protectedPaths.some(p =>
      new RegExp("^" + escapeForRegex(p)).test(window.location.pathname)
    );
  }
  let updatePage = function () {
    // Redirect if on any protected path and not authenticated, or on a protected path and no active subs
    if (
      protectedPaths.length &&
      isOnProtectedPath() &&
      (!authenticated || (!activeSubs && redirectIfNoActiveSubscriptions))
    ) {
      window.location.assign(window.location.origin + loginOrSignupPath);
    }

    // Display the customer id if we know it
    if (customerDetails.hasOwnProperty("id")) {
      Array.prototype.slice.call(document.querySelectorAll(attributeCustomerId)).forEach(el => {
        el.innerHTML = customerDetails.id;
      });
    }

    // Display the customer first name if we know it
    if (customerDetails.hasOwnProperty("first_name")) {
      Array.prototype.slice
        .call(document.querySelectorAll(attributeCustomerFirstName))
        .forEach(el => {
          el.innerHTML = customerDetails.first_name;
        });
    }
    // Display the customer last name if we know it
    if (customerDetails.hasOwnProperty("last_name")) {
      Array.prototype.slice
        .call(document.querySelectorAll(attributeCustomerLastName))
        .forEach(el => {
          el.innerHTML = customerDetails.last_name;
        });
    }
    // Display the customer email if we know it
    if (customerDetails.hasOwnProperty("email")) {
      Array.prototype.slice.call(document.querySelectorAll(attributeCustomerEmail)).forEach(el => {
        el.innerHTML = customerDetails.email;
      });
    }
    // Display the past due amount if it's set
    if (pastDueAmount > 0) {
      Array.prototype.slice
        .call(document.querySelectorAll(attributeSubscriberPastDueAmount))
        .forEach(el => {
          el.innerHTML = pastDueAmount;
        });
    }
    let attributesToHide = [
        attributeIfSubscriberByCode,
        attributeIfTransactionByCode,
        attributeIfAttributeByName,
        attributeIfNotSubscriberByCode,
        attributeIfNotTransactionByCode,
        attributeIfNotAttributeByName,
        attributeIfAuthenticated,
        attributeIfSubscriber,
        attributeIfSubscriberPastDue,
        attributeIfAttributeFavorite,
        attributeIfAttributeNotFavorite,
      ],
      attributesToShow = [],
      hideCustomAttribute = function (value) {
        value = escapeAttribute(value);
        if (!attributesToHide.includes(value)) {
          attributesToHide.push(value);
        }
      },
      showCustomAttribute = function (value, force) {
        value = escapeAttribute(value);
        if (force) {
          if (!attributesToShow.includes(value)) {
            attributesToShow.push(value);
          }
        } else {
          attributesToHide = attributesToHide.filter(function (el) {
            return el != value;
          });
        }
      },
      escapeAttribute = function (value) {
        return value.replaceAll(/[^\-_a-z0-9="[\]]/gi, "\\$&");
      },
      insertValueIntoAttribute = function (attribute, value) {
        // Add the value inside double quotes and ensure outermost quotes are single quotes
        return `${attribute.replace(/\]$/, `="${value}"]`)}`;
      };

    if (authenticated) {
      hideCustomAttribute(attributeIfAnonymous);
      showCustomAttribute(attributeIfAuthenticated);
    } else {
      hideCustomAttribute(attributeIfAuthenticated);
      showCustomAttribute(attributeIfAnonymous);
    }

    if (authenticated && activeSubs) {
      hideCustomAttribute(attributeIfNotSubscriber);
      showCustomAttribute(attributeIfSubscriber);
    } else {
      hideCustomAttribute(attributeIfSubscriber);
      showCustomAttribute(attributeIfNotSubscriber);
    }

    if (pastDueAmount) {
      hideCustomAttribute(attributeIfNotSubscriberPastDue);
      showCustomAttribute(attributeIfSubscriberPastDue);
    } else {
      hideCustomAttribute(attributeIfSubscriberPastDue);
      showCustomAttribute(attributeIfNotSubscriberPastDue);
    }

    let subCodeAttributes = activeSubCodes.map(code => {
      let completedAttribute = insertValueIntoAttribute(attributeIfSubscriberByCode, code);
      showCustomAttribute(completedAttribute, true);
      return completedAttribute;
    });
    Array.prototype.slice
      .call(document.querySelectorAll(attributeIfNotSubscriberByCode))
      .forEach(el => {
        let codeAttribute = el.getAttribute(attributeIfNotSubscriberByCode.replace(/\[|\]/g, ""));
        if (
          !codeAttribute ||
          !subCodeAttributes.includes(
            insertValueIntoAttribute(attributeIfSubscriberByCode, codeAttribute)
          )
        ) {
          showCustomAttribute(
            insertValueIntoAttribute(attributeIfNotSubscriberByCode, codeAttribute),
            true
          );
        }
      });

    let transactionCodeAttributes = transactionCodes.map(code => {
      let completedAttribute = insertValueIntoAttribute(attributeIfTransactionByCode, code);
      showCustomAttribute(completedAttribute, true);
      return completedAttribute;
    });
    Array.prototype.slice
      .call(document.querySelectorAll(attributeIfNotTransactionByCode))
      .forEach(el => {
        let codeAttribute = el.getAttribute(attributeIfNotTransactionByCode.replace(/\[|\]/g, ""));
        if (
          !codeAttribute ||
          !transactionCodeAttributes.includes(
            insertValueIntoAttribute(attributeIfTransactionByCode, codeAttribute)
          )
        ) {
          showCustomAttribute(
            insertValueIntoAttribute(attributeIfNotTransactionByCode, codeAttribute),
            true
          );
        }
      });

    let attributeNames = Object.keys(customerAttributes).map(name => {
      let completedAttribute = insertValueIntoAttribute(attributeIfAttributeByName, name);
      if (name.includes("favorite-")) {
        completedAttribute = insertValueIntoAttribute(
          attributeIfAttributeFavorite,
          name.split("favorite-")[1]
        );
      }
      showCustomAttribute(completedAttribute, true);
      return completedAttribute;
    });
    Array.prototype.slice
      .call(document.querySelectorAll(attributeIfNotAttributeByName))
      .forEach(el => {
        let codeAttribute = el.getAttribute(attributeIfNotAttributeByName.replace(/\[|\]/g, ""));
        if (
          !codeAttribute ||
          !attributeNames.includes(
            insertValueIntoAttribute(attributeIfAttributeByName, codeAttribute)
          )
        ) {
          showCustomAttribute(
            insertValueIntoAttribute(attributeIfNotAttributeByName, codeAttribute),
            true
          );
        }
      });

    // Favorites
    Array.prototype.slice
      .call(document.querySelectorAll(attributeIfAttributeNotFavorite))
      .forEach(el => {
        let codeAttribute = el.getAttribute(attributeIfAttributeNotFavorite.replace(/\[|\]/g, ""));
        if (
          !codeAttribute ||
          !attributeNames.includes(
            insertValueIntoAttribute(attributeIfAttributeFavorite, codeAttribute)
          )
        ) {
          showCustomAttribute(
            insertValueIntoAttribute(attributeIfAttributeNotFavorite, codeAttribute),
            true
          );
        }
      });

    // ============================================
    // Attribute value-based conditions (v2.0)
    // --------------------------------------------
    // Supports dynamic attributes (non-case-sensitive):
    //   [foxy-logic-customer-attribute-DYNAMIC-value-includes="VALUE"]
    //   [foxy-logic-customer-attribute-DYNAMIC-value-not-includes="VALUE"]
    // Where DYNAMIC is the Foxy attribute name with spaces -> _ and no special chars.
    // Matches are case-insensitive, and "includes" checks substring containment.
    (function handleAttributeValueConditions() {
      // Optimized: no full DOM scan. Build exact selectors from existing customer attribute names.
      const PREFIX = "foxy-logic-customer-attribute-";
      const INC_SUFFIX = "-value-includes";
      const NOT_INC_SUFFIX = "-value-not-includes";

      const sanitize = name =>
        (name || "")
          .toString()
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9_]/g, ""); // drop special chars

      // Map sanitized attribute name -> string value
      const attrs = {};
      Object.keys(customerAttributes || {}).forEach(k => {
        attrs[sanitize(k)] = (customerAttributes[k]?.value ?? "").toString();
      });

      const names = Object.keys(attrs);
      if (!names.length) return; // nothing to resolve

      // Build exact attribute-name selectors for only the customer's attributes
      const incSelectors = names.map(n => `[${PREFIX}${n}${INC_SUFFIX}]`);
      const notSelectors = names.map(n => `[${PREFIX}${n}${NOT_INC_SUFFIX}]`);

      const checkSet = (nodeList, isIncludes) => {
        nodeList.forEach(el => {
          // Find the exact matching dynamic attribute name on this element
          const a = Array.from(el.attributes).find(
            attr =>
              attr.name.startsWith(PREFIX) &&
              attr.name.endsWith(isIncludes ? INC_SUFFIX : NOT_INC_SUFFIX)
          );
          if (!a) return;

          // Extract the dynamic segment from the attribute name
          const dyn = a.name.slice(
            PREFIX.length,
            a.name.length - (isIncludes ? INC_SUFFIX.length : NOT_INC_SUFFIX.length)
          );
          const sDyn = sanitize(dyn);

          const desired = (a.value || "").toLowerCase().trim();
          const actual = (attrs[sDyn] || "").toLowerCase();

          let shouldShow = false;
          if (isIncludes) {
            shouldShow = desired ? actual === desired : false;
          } else {
            // not-includes
            shouldShow = desired ? actual !== desired : true;
          }

          // Target this exact node's rule by including the value in the selector
          const selector = insertValueIntoAttribute(`[${a.name}]`, a.value);
          hideCustomAttribute(selector);
          if (shouldShow) showCustomAttribute(selector, true);
        });
      };

      if (incSelectors.length) {
        checkSet(document.querySelectorAll(incSelectors.join(",")), true);
      }
      if (notSelectors.length) {
        checkSet(document.querySelectorAll(notSelectors.join(",")), false);
      }
    })();
    // ============================================

    let portalCSS = `
            ${attributesToHide.join(", ")} {
                display: none !important;
            }
        `;
    if (attributesToShow.length) {
      portalCSS += `
                ${attributesToShow.join(", ")} {
                    display: revert !important;
                }
            `;
    }

    let existingSheet = document.querySelector("[data-foxy-portal-style]");
    if (existingSheet) {
      existingSheet.textContent = portalCSS;
    } else {
      let newStylesheet = document.createElement("style");
      newStylesheet.textContent = portalCSS;
      newStylesheet.setAttribute("data-foxy-portal-style", true);
      document.head.appendChild(newStylesheet);
    }

    // Remove hidden elements from the page if configured to and not on the portal page
    if (!portal && removeElementsFromPage) {
      for (let c = 0; c < attributesToHide.length; c++) {
        const elAttribute = attributesToHide[c];
        if (!attributesToShow.includes(elAttribute)) {
          document.querySelectorAll(elAttribute).forEach(el => {
            const elementAttributes = el.attributes;
            let shouldRemove = true;

            for (let i = 0; i < elementAttributes.length; i++) {
              const attribute = elementAttributes[i];
              if (attributesToShow.includes(`[${attribute.name}="${attribute.value}"]`)) {
                shouldRemove = false;
                break;
              }
            }

            if (shouldRemove) {
              el.remove();
            }
          });
        }
      }
    }
  };

  let handleFavorites = async function (event) {
    if (!webhookEndpointURL) return;
    const favoriteElement = event.target;
    let customerID = getCustomerID();

    let displayOppositeFavoriteState = oppositeElement => {
      //  removing pointer-events to element while action takes place for debouncing
      favoriteElement.style.setProperty("display", "none", "important");
      oppositeElement.style.setProperty("display", "revert", "important");

      favoriteElement.style.setProperty("pointer-events", "none");
      oppositeElement.style.setProperty("pointer-events", "none");
      setTimeout(() => {
        favoriteElement.style.setProperty("pointer-events", "auto");
        oppositeElement.style.setProperty("pointer-events", "auto");
      }, 2000);

      setTimeout(() => {
        favoriteElement.style.setProperty("display", "unset", "");
        oppositeElement.style.setProperty("display", "unset", "");
      }, 10000);
    };

    let addOrRemoveFavorite = async function (ifTrueAddElseRemove = false) {
      const itemID = favoriteElement
        ?.closest(attributeItemFavoriteCode)
        .getAttribute(attributeItemFavoriteCode.replace(/\[|\]/g, ""));

      const attributeID = customerAttributes[`favorite-${itemID}`]?.id;
      try {
        const headers = {
          "Content-Type": "application/json",
          "FOXY-API-VERSION": "1",
        };
        const body = JSON.stringify({
          customer_id: customerID,
          item_code: itemID,
          attribute_id: ifTrueAddElseRemove ? false : attributeID,
        });
        const res = await fetch(webhookEndpointURL, { headers, method: "POST", body });

        if (!res.ok) {
          const error = ifTrueAddElseRemove
            ? new Error(`There was an error adding favorite to product with ID ${itemID} `)
            : new Error(`There was an error removing favorite from product with ID ${itemID} `);

          throw error;
        }

        const data = await res.json();

        if (!ifTrueAddElseRemove && !data.message.includes("successfully")) {
          throw new Error(`There was an error removing favorite from product with ID ${itemID} `);
        }
      } catch (error) {
        console.log(error);
        console.log(error?.type);
      }
    };

    if (favoriteElement.matches(attributeCustomerFavorite) && customerID) {
      const unfavoriteElement = document.querySelector(attributeCustomerUnfavorite);
      displayOppositeFavoriteState(unfavoriteElement);
      await addOrRemoveFavorite(true);
      await fetchCustomerData(false);
      return;
    } else if (favoriteElement.matches(attributeCustomerUnfavorite) && customerID) {
      const favoriteElement = document.querySelector(attributeCustomerFavorite);
      displayOppositeFavoriteState(favoriteElement);
      await addOrRemoveFavorite(false);
      await fetchCustomerData(false);
      return;
    }
  };
  let init = function () {
    try {
      checkAuthentication();
      let subData = JSON.parse(localStorage.getItem("fx.customer.subs"));
      if (subData) {
        activeSubs = parseInt(subData.count);
        activeSubCodes = subData.codes;
        pastDueAmount = subData.past_due_amount;
      }
      let transactionData = JSON.parse(localStorage.getItem("fx.customer.transactions"));
      // Backwards compatability, remove later
      if (transactionData && transactionData.hasOwnProperty("codes")) {
        transactionCodes = transactionData.codes;
      } else {
        transactionCodes = transactionData;
      }
      if (!transactionCodes) {
        transactionCodes = [];
      }
      customerAttributes = JSON.parse(localStorage.getItem("fx.customer.attributes"));
      if (!customerAttributes) {
        customerAttributes = {};
      }
      customerDetails = JSON.parse(localStorage.getItem("fx.customer.details"));
      if (!customerDetails) {
        customerDetails = {};
      }

      const event = new Event("fx.fetch.done");

      // Dispatch the event.
      window.dispatchEvent(event);

      if (authenticated) {
        fetchCustomerData(false);
      }
    } catch (error) {
      console.log("Portal content protection initialization error:", error);
    }
    if (!authenticated) clearLocalStorage();
    updatePage();
  };
  let parseJWT = function (token) {
    let base64Url = token.split(".")[1];
    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    let jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );

    return JSON.parse(jsonPayload);
  };
  let checkAuthentication = function () {
    let sessionStore = JSON.parse(localStorage.getItem(portalSessionKey));
    if (sessionStore && sessionStore.hasOwnProperty("jwt")) {
      let sessionData = parseJWT(sessionStore.jwt);
      let expires =
        Math.floor(new Date(sessionStore.date_created).getTime() / 1000) + sessionStore.expires_in;
      authenticated =
        expires > Math.floor(Date.now() / 1000) && sessionData.hasOwnProperty("customer_id");
    }
  };
  let getSessionToken = function () {
    let sessionStore = JSON.parse(localStorage.getItem(portalSessionKey));
    if (sessionStore && sessionStore.hasOwnProperty("session_token")) {
      return sessionStore.session_token;
    }
    return false;
  };
  let getCustomerID = function () {
    let sessionStore = JSON.parse(localStorage.getItem(portalSessionKey));
    if (sessionStore && sessionStore.hasOwnProperty("sso")) {
      return new URL(sessionStore.sso).searchParams.get("fc_customer_id");
    }
    return false;
  };
  let checkForDynamicRedirect = function () {
    // Get query parameters from the URL
    const queryParams = new URLSearchParams(window.location.search);

    // Get the hash from the URL
    const hash = window.location.hash;

    // Get the 'redirect' parameter and decode it
    const redirectParam = queryParams.get("redirect");

    // If the 'redirect' parameter exists, append the hash and set loginRedirect
    if (redirectParam) {
      loginRedirect = `${decodeURIComponent(redirectParam)}${hash}`;
      hasDynamicRedirect = true; // Mark that we have a dynamic redirect
    } else {
      hasDynamicRedirect = false; // No dynamic redirect found
    }
  };

  if (!FC.hasOwnProperty("custom")) {
    FC.custom = {};
  }
  FC.custom.updatePage = updatePage;
  FC.custom.hasTransactionByCode = function (code) {
    return transactionCodes.includes(code);
  };
  FC.custom.hasSubscriptionByCode = function (code) {
    return activeSubCodes.includes(code);
  };
  FC.custom.hasAttributeByName = function (name, value) {
    let exists = customerAttributes.hasOwnProperty(name);
    if (exists && value) {
      exists = customerAttributes[name]?.value == value;
    }
    return exists;
  };
  FC.custom.getAttributeByName = function (name) {
    if (customerAttributes.hasOwnProperty(name)) {
      return customerAttributes[name]?.value;
    }
    return false;
  };
  FC.custom.isAuthenticated = function () {
    checkAuthentication();
    return authenticated;
  };
  FC.custom.isSubscriber = function () {
    checkAuthentication();
    return authenticated && activeSubs > 0;
  };
  init();
})(FC);
