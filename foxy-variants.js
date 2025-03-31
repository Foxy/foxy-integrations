var FC = FC || {},
  Weglot = Weglot || {},
  Foxy = (function () {
    let stylesAdded = !1;
    return {
      setVariantConfig: function (newConfig) {
        const config = {
            sortBy: "",
            sortOrder: "",
            defaultLocale: "en-US",
            defaultCurrency: "USD",
            priceDisplay: "low",
            inventoryDefaultLabel: "Please choose options",
            selectUnavailableLabel: "Unavailable",
            inventoryControl: !1,
            multiCurrency: !1,
            multilingual: !1,
            addonsConfig: null,
          },
          disableClass = "foxy-disable",
          disableOptionClass = "foxy-disable-option",
          foxy_variant_group = "foxy-variant-group",
          foxy_variant_group_order = "foxy-variant-group-order",
          foxy_variant_item = "[foxy-id='variant-item']",
          foxy_variant_group_name = "foxy-variant-group-name";
        let variantSelectionCompleteProduct = [],
          variantItems = { serialized: {}, array: [] },
          variantGroups = [],
          addonInit = !0,
          switchEventListenerSet = !1;
        const firstConfigDefaults = { ...newConfig };
        setConfig(config, newConfig);
        let container = (function () {
          let container = document;
          const foxyInstanceContainer = document?.currentScript?.closest("[foxy-id='container']");
          foxyInstanceContainer && (container = foxyInstanceContainer);
          return container;
        })();
        const foxyForm = container.querySelector("[foxy-id='form']"),
          imageElement = container.querySelector("[foxy-id='image']"),
          priceElement = container.querySelector("[foxy-id='price']"),
          inventoryElement = container.querySelector("[foxy-id='inventory']"),
          quantityElement = foxyForm?.querySelector("input[name='quantity']"),
          priceAddToCart = foxyForm?.querySelector("input[name='price']"),
          addToCartQuantityMax = foxyForm?.querySelector("input[name='quantity_max']"),
          variantGroupElements = foxyForm?.querySelectorAll(`[${foxy_variant_group}]`),
          foxyTemplateSwitch = document.querySelector("[foxy-id='switch']");
        function setConfig(config, newConfig) {
          if (newConfig && "object" == typeof newConfig)
            for (const key in newConfig) key in config && (config[key] = newConfig[key]);
        }
        function handleAddons() {
          let templateSet = "DEFAULT";
          const newAddonConfig = {
              defaultCurrency: config.defaultCurrency,
              defaultLocale: config.defaultLocale,
            },
            templateSetFromURL = (function (url, config) {
              const urlParts = url.split("/"),
                subdomain = urlParts[2].split(".")[0],
                subdirectory = urlParts[3],
                isTemplateChangeBySubdomain =
                  "subdomain" === config.addonsConfig.templateChangeTrigger,
                isTemplateChangeBySubdirectory =
                  "subdirectory" === config.addonsConfig.templateChangeTrigger;
              if (isTemplateChangeBySubdomain && config.addonsConfig.templateSets[subdomain])
                return subdomain;
              if (isTemplateChangeBySubdirectory && config.addonsConfig.templateSets[subdirectory])
                return subdirectory;
              return null;
            })(window.location.href, config),
            isTemplateChangeByCountry = "country" === config.addonsConfig.templateChangeTrigger,
            isTemplateChangeByWeglotJS = "weglotjs" === config.addonsConfig.templateChangeTrigger,
            updateNewConfig = templateSetCode => {
              const templateSetConfig = config.addonsConfig.templateSets[templateSetCode];
              if (templateSetConfig) {
                const { currency: currency, locale: locale } = templateSetConfig;
                (newAddonConfig.defaultCurrency = currency),
                  (newAddonConfig.defaultLocale = locale),
                  (templateSet = templateSetCode);
                const translation = config.addonsConfig.translations[templateSetCode];
                if (translation) {
                  const {
                    selectUnavailableLabel: selectUnavailableLabel,
                    inventoryDefaultLabel: inventoryDefaultLabel,
                  } = translation;
                  (newAddonConfig.selectUnavailableLabel = selectUnavailableLabel),
                    (newAddonConfig.inventoryDefaultLabel = inventoryDefaultLabel);
                }
              } else {
                const {
                  defaultCurrency: defaultCurrency,
                  defaultLocale: defaultLocale,
                  selectUnavailableLabel: selectUnavailableLabel,
                  inventoryDefaultLabel: inventoryDefaultLabel,
                } = firstConfigDefaults;
                (newAddonConfig.defaultCurrency = defaultCurrency),
                  (newAddonConfig.defaultLocale = defaultLocale),
                  (newAddonConfig.selectUnavailableLabel = selectUnavailableLabel),
                  (newAddonConfig.inventoryDefaultLabel = inventoryDefaultLabel),
                  (templateSet = "DEFAULT");
              }
            },
            handleWeglotLanguageChange = newLang => {
              updateNewConfig(newLang),
                removeVariantOptions(),
                (addonInit = !1),
                setConfig(config, newAddonConfig),
                updateTemplateSet(templateSet, !0);
            },
            handleTemplateSwitcher = e => {
              const templateSetCode = e.target.getAttribute("foxy-template");
              templateSetCode &&
                ((addonInit = !1),
                removeVariantOptions(),
                updateNewConfig(templateSetCode),
                setConfig(config, newAddonConfig),
                updateTemplateSet(templateSet, !0));
            };
          if (isTemplateChangeByCountry) {
            const country = FC.json.shipping_address.country.toLowerCase();
            updateNewConfig(country);
          }
          isTemplateChangeByWeglotJS &&
            (updateNewConfig(Weglot.getCurrentLang()),
            Weglot.on("languageChanged", handleWeglotLanguageChange)),
            templateSetFromURL && updateNewConfig(templateSetFromURL),
            setConfig(config, newAddonConfig),
            updateTemplateSet(templateSet),
            !switchEventListenerSet &&
              foxyTemplateSwitch &&
              (foxyTemplateSwitch?.addEventListener("click", handleTemplateSwitcher),
              (switchEventListenerSet = !0));
        }
        function updateTemplateSet(templateSet, initVariantLogic = !1) {
          (FC.json.template_set || "DEFAULT") !== templateSet &&
            FC.client.request(
              `https://${FC.settings.storedomain}/cart?template_set=${templateSet}`
            ),
            initVariantLogic && init();
        }
        function init() {
          if ((config.multiCurrency || config.multilingual) && addonInit) {
            const existingOnLoad = "function" == typeof FC.onLoad ? FC.onLoad : function () {};
            FC.onLoad = function () {
              existingOnLoad(),
                (addonInit = !1),
                FC.client.on("ready.done", handleAddons).on("ready.done", init);
            };
          } else
            quantityElement &&
              (quantityElement.setAttribute("value", "1"),
              quantityElement.setAttribute("min", "1")),
              (function () {
                const variantList = container.querySelectorAll(foxy_variant_item);
                if (!variantList.length) return;
                variantList.forEach(variantItem => {
                  const variant = Object.values(variantItem.attributes).reduce((acc, currAttr) => {
                    const { name: name, value: value } = currAttr;
                    if (name.includes("foxy-variant") && value) {
                      const key = sanitize(name.split("foxy-variant-")[1]),
                        currency = sanitize(config.defaultCurrency);
                      if (!acc[key]) {
                        if (config.multiCurrency && key === `price-${currency}`)
                          return (acc.price = value.trim()), acc;
                        if (
                          config.multiCurrency &&
                          key.includes("price") &&
                          key !== `price-${currency}`
                        )
                          return acc;
                        acc["sku" === key ? "code" : key] = value.trim();
                      }
                      return acc;
                    }
                    return acc;
                  }, {});
                  (variantItems.serialized[variant?.code ?? variant.name] = filterEmpty(variant)),
                    variantItems.array.push(filterEmpty(variant));
                });
              })(),
              (function () {
                if (!variantGroupElements) return;
                variantGroupElements.forEach(variantGroupElement => {
                  let editorElementGroupName;
                  const cmsVariantGroupName = sanitize(
                      variantGroupElement.getAttribute(foxy_variant_group)
                    ),
                    variantOptionsData = (function (groupName) {
                      const variantGroupOptions = [];
                      return (
                        variantItems.array.forEach(variantItem => {
                          const variantOption = variantItem[groupName]?.trim(),
                            variantItemStyles = Object.fromEntries(
                              Object.entries(variantItem)
                                .filter(([key, value]) => {
                                  if (key.includes(`${groupName}-`) && value) return !0;
                                })
                                .map(([key, value]) => [key.replace(`${groupName}-`, ""), value])
                            );
                          variantOption &&
                            !variantGroupOptions.some(
                              option => option.variantOption === variantOption
                            ) &&
                            variantGroupOptions.push({
                              inventory: variantItem.inventory,
                              label: variantItem.label,
                              price: variantItem.price,
                              variantOption: variantOption,
                              styles: variantItemStyles,
                            });
                        }),
                        (function (variantGroupOptions) {
                          const { sortBy: sortBy, sortOrder: sortOrder } = config,
                            compareFn = (a, b) => {
                              if ("price" === sortBy) {
                                const priceA = a.price,
                                  priceB = b.price;
                                return "Descending" === sortOrder
                                  ? priceB - priceA
                                  : priceA - priceB;
                              }
                              if ("label" === sortBy) {
                                const labelA = a.label,
                                  labelB = b.label;
                                if ("descending" === sortOrder) return labelB.localeCompare(labelA);
                                if ("ascending" === sortOrder) return labelA.localeCompare(labelB);
                              }
                              return 0;
                            };
                          sortBy
                            ? variantGroupOptions.sort(compareFn)
                            : variantGroupOptions.sort((a, b) => {
                                const labelA = a.variantOption,
                                  labelB = b.variantOption;
                                return "descending" === sortOrder
                                  ? labelB.localeCompare(labelA)
                                  : "ascending" === sortOrder
                                  ? labelA.localeCompare(labelB)
                                  : 0;
                              });
                        })(variantGroupOptions),
                        variantGroupOptions
                      );
                    })(cmsVariantGroupName),
                    variantGroupOptions = variantOptionsData.map(option => option.variantOption),
                    variantGroupType = (function (variantGroupElement) {
                      const select = variantGroupElement.querySelector("select"),
                        radio = variantGroupElement.querySelector("input[type=radio]");
                      if (select) return "select";
                      if (radio) return "radio";
                    })(variantGroupElement),
                    variantOptionDesignElement =
                      "select" === variantGroupType ? "select" : ".w-radio";
                  editorElementGroupName =
                    "select" === variantOptionDesignElement
                      ? variantGroupElement
                          .querySelector(variantOptionDesignElement)
                          .getAttribute("data-name")
                      : variantGroupElement
                          .querySelector(`${variantOptionDesignElement} input[type=radio]`)
                          .getAttribute("data-name");
                  const customSortOrder =
                    variantGroupElement
                      .getAttribute(foxy_variant_group_order)
                      ?.trim()
                      .split(/\s*,\s*/) ?? null;
                  0 === variantGroupOptions.length
                    ? variantGroupElement.remove()
                    : (variantGroups.push({
                        editorElementGroupName: editorElementGroupName,
                        customSortOrder: customSortOrder,
                        element: variantGroupElement,
                        options: variantGroupOptions,
                        optionsData: variantOptionsData,
                        name: cmsVariantGroupName,
                        variantGroupType: variantGroupType,
                        variantOptionDesign: variantGroupElement.querySelector(
                          variantOptionDesignElement
                        ),
                        variantOptionDesignParent: variantGroupElement.querySelector(
                          variantOptionDesignElement
                        ).parentElement,
                      }),
                      variantGroupElement.querySelector(variantOptionDesignElement).remove());
                });
              })(),
              (function () {
                const style = (node, styles) =>
                    Object.keys(styles).forEach(key => (node.style[key] = styles[key])),
                  addRadioOptions = variantGroup => {
                    const {
                      editorElementGroupName: editorElementGroupName,
                      element: element,
                      name: name,
                      options: options,
                      optionsData: optionsData,
                      customSortOrder: customSortOrder,
                      variantOptionDesign: variantOptionDesign,
                      variantOptionDesignParent: variantOptionDesignParent,
                    } = variantGroup;
                    (customSortOrder || options).forEach((option, index) => {
                      const variantOptionData = optionsData.find(
                          optionData => optionData.variantOption === option
                        ),
                        variantOptionClone = variantOptionDesign.cloneNode(!0),
                        radioInput = variantOptionClone.querySelector("input[type=radio]"),
                        label = variantOptionClone.querySelector("span[for]");
                      (label.textContent = option),
                        label.setAttribute("for", `${option}-${index}`),
                        (radioInput.id = `${option}-${index}`),
                        (radioInput.name = editorElementGroupName || name),
                        (radioInput.value = option),
                        radioInput.setAttribute(foxy_variant_group_name, name),
                        (radioInput.required = !0),
                        config.inventoryControl &&
                          1 === variantGroups.length &&
                          !Number(variantOptionData.inventory) &&
                          ((radioInput.disabled = !0),
                          radioInput.parentElement.classList.add(disableClass));
                      const customInput = variantOptionClone.querySelector("div.w-radio-input");
                      customInput && style(customInput, variantOptionData.styles),
                        variantOptionDesignParent?.getAttribute(foxy_variant_group)
                          ? element.append(variantOptionClone)
                          : variantOptionDesignParent.append(variantOptionClone);
                    });
                  },
                  addSelectOptions = variantGroup => {
                    const {
                        editorElementGroupName: editorElementGroupName,
                        element: element,
                        name: name,
                        options: options,
                        optionsData: optionsData,
                        customSortOrder: customSortOrder,
                        variantOptionDesign: variantOptionDesign,
                        variantOptionDesignParent: variantOptionDesignParent,
                      } = variantGroup,
                      variantOptions = customSortOrder || options;
                    let variantSelect = variantOptionDesign.cloneNode(!0);
                    (variantSelect.required = !0),
                      (variantSelect.name = editorElementGroupName || name),
                      variantSelect.setAttribute(foxy_variant_group_name, name),
                      variantOptions.forEach(option => {
                        const variantOptionData = optionsData.find(
                          optionData => optionData.variantOption === option
                        );
                        let selectOption = new Option(option, option);
                        if (
                          config.inventoryControl &&
                          1 === variantGroups.length &&
                          !Number(variantOptionData.inventory)
                        ) {
                          let unavailableText;
                          config.selectUnavailableLabel &&
                            (unavailableText = `(${config.selectUnavailableLabel})`),
                            (selectOption = new Option(`${option} ${unavailableText}`, option)),
                            (selectOption.disabled = !0);
                        }
                        variantSelect.add(selectOption);
                      }),
                      variantOptionDesignParent.getAttribute(foxy_variant_group)
                        ? element.append(variantSelect)
                        : variantOptionDesignParent.append(variantSelect);
                  };
                if (!variantGroups.length) return;
                variantGroups.forEach(variantGroup => {
                  "select" === variantGroup.variantGroupType
                    ? addSelectOptions(variantGroup)
                    : addRadioOptions(variantGroup);
                });
              })(),
              addPrice(),
              setInventory(),
              foxyForm?.addEventListener("change", handleVariantSelection);
        }
        function removeVariantOptions() {
          variantGroups.length &&
            (variantGroups.forEach(variantGroup => {
              const { variantOptionDesignParent: variantOptionDesignParent } = variantGroup;
              if ("radio" === variantGroup.variantGroupType) {
                const radioInputs = variantOptionDesignParent.querySelectorAll("input[type=radio]");
                for (let i = 1; i < radioInputs.length; i++) radioInputs[i].parentNode.remove();
              }
              if ("select" === variantGroup.variantGroupType) {
                const selectOptions = variantOptionDesignParent.querySelectorAll("option");
                for (let i = 1; i < selectOptions.length; i++) selectOptions[i].remove();
              }
            }),
            (variantSelectionCompleteProduct = []),
            (variantItems = { serialized: {}, array: [] }),
            (variantGroups = []));
        }
        function addPrice() {
          if (1 === variantItems.array.length) {
            const variantPrice = variantItems.array[0].price;
            priceElement &&
              ((priceElement.textContent = moneyFormat(
                config.defaultLocale,
                config.defaultCurrency,
                variantPrice
              )),
              priceElement.classList.remove("w-dyn-bind-empty")),
              priceAddToCart && (priceAddToCart.value = parseFloat(variantPrice));
          }
          if (variantItems.array.length) {
            if (variantItems.array.length > 1) {
              const sortedPrices = variantItems.array
                .map(variant => Number(variant.price))
                .sort((a, b) => a - b);
              if (sortedPrices[0] !== sortedPrices[sortedPrices.length - 1]) {
                if ("low" === config.priceDisplay)
                  return (
                    priceElement &&
                      (priceElement.textContent = moneyFormat(
                        config.defaultLocale,
                        config.defaultCurrency,
                        sortedPrices[0]
                      )),
                    void priceElement?.classList.remove("w-dyn-bind-empty")
                  );
                if ("high" === config.priceDisplay)
                  return (
                    priceElement &&
                      (priceElement.textContent = moneyFormat(
                        config.defaultLocale,
                        config.defaultCurrency,
                        sortedPrices[sortedPrices.length - 1]
                      )),
                    void priceElement?.classList.remove("w-dyn-bind-empty")
                  );
                const priceText = `${moneyFormat(
                  config.defaultLocale,
                  config.defaultCurrency,
                  sortedPrices[0]
                )}–${moneyFormat(
                  config.defaultLocale,
                  config.defaultCurrency,
                  sortedPrices[sortedPrices.length - 1]
                )}`;
                priceElement && (priceElement.textContent = priceText),
                  priceElement?.classList.remove("w-dyn-bind-empty");
              } else {
                const price = moneyFormat(
                  config.defaultLocale,
                  config.defaultCurrency,
                  sortedPrices[0]
                );
                priceElement?.classList.remove("w-dyn-bind-empty"),
                  priceElement && (priceElement.textContent = price),
                  priceAddToCart && (priceAddToCart.value = parseFloat(sortedPrices[0]));
              }
            }
          } else if (priceElement && priceElement.textContent) {
            const numericPrice = Number(priceElement.textContent);
            isNaN(numericPrice)
              ? ((priceElement.textContent = ""), priceElement.classList.add("w-dyn-bind-empty"))
              : ((priceElement.textContent = moneyFormat(
                  config.defaultLocale,
                  config.defaultCurrency,
                  numericPrice
                )),
                priceElement.classList.remove("w-dyn-bind-empty"));
          }
        }
        function setInventory(isVariantsSelectionDone) {
          if (isVariantsSelectionDone) {
            if (!config.inventoryControl) return;
            const quantity = quantityElement?.value ?? 1,
              submitButton = foxyForm.querySelector("input[type=submit]"),
              inventory =
                1 === variantItems.array.length
                  ? variantItems.array[0]?.inventory
                  : variantSelectionCompleteProduct?.inventory;
            if (
              (Number(quantity) > Number(inventory) && (quantityElement.value = 1),
              inventoryElement)
            ) {
              if (void 0 === inventory)
                return (
                  (inventoryElement.textContent = "0"),
                  (submitButton.disabled = !0),
                  void submitButton.classList.add(disableClass)
                );
              if (Number(quantity) <= Number(inventory))
                return (
                  (inventoryElement.textContent = inventory),
                  (submitButton.disabled = !1),
                  void submitButton.classList.remove(disableClass)
                );
            }
          } else
            1 !== variantItems.array.length
              ? variantItems.array.length > 1 &&
                inventoryElement &&
                ((inventoryElement.textContent = config.inventoryDefaultLabel),
                inventoryElement.classList.remove("w-dyn-bind-empty"))
              : config.inventoryControl &&
                (addToCartQuantityMax.value = variantItems.array[0]?.inventory ?? 0);
        }
        function handleVariantSelection(e) {
          const targetElement = e.target,
            { value: value } = targetElement,
            currentVariantSelectionElement = targetElement,
            currentVariantSelection = value;
          if (!value) return;
          if (!targetElement.closest(`div[${foxy_variant_group}]`)) return;
          const variantSelectionGroup = sanitize(
            targetElement.getAttribute(foxy_variant_group_name)
          );
          removeDisabledStyleVariantGroupOptions(currentVariantSelectionElement, !1);
          const selectedProductVariants = getSelectedVariantOptions(),
            availableProductsPerVariant = getAvailableProductsPerVariantSelection(
              currentVariantSelection,
              selectedProductVariants
            );
          updateVariantOptions(
            availableProductsPerVariant,
            variantSelectionGroup,
            currentVariantSelectionElement
          ),
            (function (availableProductsPerVariant, selectedProductVariants) {
              const isVariantsSelectionDone = (function () {
                if (
                  0 === foxyForm.querySelectorAll("[foxy-variant-group] [required]:invalid").length
                )
                  return !0;
                return !1;
              })();
              if (isVariantsSelectionDone)
                return (
                  (variantSelectionCompleteProduct = availableProductsPerVariant.find(product => {
                    let isProduct = [];
                    return (
                      Object.keys(selectedProductVariants).forEach(key => {
                        product[key] === selectedProductVariants[key]
                          ? isProduct.push(!0)
                          : isProduct.push(!1);
                      }),
                      isProduct.every(productCheck => !0 === productCheck)
                    );
                  })),
                  void Object.keys(variantSelectionCompleteProduct).forEach(key => {
                    const inputToUpdate = foxyForm.querySelector(
                      `input[type='hidden'][name="${key}"]`
                    );
                    switch (
                      (inputToUpdate &&
                        (inputToUpdate.value = variantSelectionCompleteProduct[key]),
                      key)
                    ) {
                      case "inventory":
                        if (!config.inventoryControl) break;
                        (foxyForm.querySelector('input[name="quantity_max"]').value =
                          variantSelectionCompleteProduct[key]),
                          quantityElement?.setAttribute(
                            "max",
                            variantSelectionCompleteProduct[key]
                          ),
                          setInventory(isVariantsSelectionDone);
                        break;
                      case "price":
                        priceElement &&
                          (priceElement.textContent = moneyFormat(
                            config.defaultLocale,
                            config.defaultCurrency,
                            variantSelectionCompleteProduct[key]
                          ));
                        break;
                      case "image":
                        imageElement?.setAttribute("srcset", ""),
                          imageElement?.setAttribute("src", variantSelectionCompleteProduct[key]);
                        break;
                    }
                  })
                );
              addPrice(), setInventory();
            })(availableProductsPerVariant, selectedProductVariants);
        }
        function removeDisabledStyleVariantGroupOptions(
          currentVariantSelectionElement,
          resetChoices
        ) {
          const { nodeName: nodeName } = currentVariantSelectionElement;
          if ("INPUT" === nodeName) {
            if (
              (currentVariantSelectionElement.parentElement.classList.remove(disableClass),
              resetChoices)
            ) {
              currentVariantSelectionElement
                .closest(`[${foxy_variant_group}]`)
                .querySelectorAll(`.${disableClass}`)
                .forEach(input => input.classList.remove(disableClass));
            }
          } else
            "SELECT" === nodeName &&
              currentVariantSelectionElement
                .querySelectorAll(`select option.${disableOptionClass}`)
                .forEach(option => {
                  option.classList.remove(disableOptionClass);
                  const unavailableText = ` (${config.selectUnavailableLabel})`,
                    optionText = option.textContent.split(unavailableText)[0];
                  option.textContent = optionText;
                });
        }
        function getSelectedVariantOptions() {
          const selectedProductVariants = {};
          return (
            foxyForm
              .querySelectorAll(
                `div[${foxy_variant_group}] input:checked, div[${foxy_variant_group}] select[required]:valid option:checked,div[${foxy_variant_group}] option:checked`
              )
              .forEach(variant => {
                variant.value &&
                  ("OPTION" !== variant.nodeName
                    ? (selectedProductVariants[
                        sanitize(variant.getAttribute(foxy_variant_group_name))
                      ] = variant.value)
                    : (selectedProductVariants[
                        sanitize(variant.parentElement.getAttribute(foxy_variant_group_name))
                      ] = variant.value));
              }),
            selectedProductVariants
          );
        }
        function getAvailableProductsPerVariantSelection(
          currentVariantSelection,
          selectedProductVariants
        ) {
          const ifIsInventoryControlEnabled = inventory =>
            !config.inventoryControl || Number(inventory) > 0;
          if (variantGroups.length > 2)
            return variantItems.array.filter(variant => {
              const inventory = Number(variant.inventory);
              let isProduct = [];
              return (
                Object.keys(selectedProductVariants).forEach(variantOptionKey => {
                  variant[variantOptionKey] === selectedProductVariants[variantOptionKey]
                    ? isProduct.push(!0)
                    : isProduct.push(!1);
                }),
                isProduct.every(productCheck => !0 === productCheck) &&
                  ifIsInventoryControlEnabled(inventory)
              );
            });
          if (variantGroups.length <= 2) {
            const availableProductsPerVariant = [];
            return (
              variantItems.array.forEach(variant => {
                const inventory = Number(variant.inventory);
                Object.values(variant).includes(currentVariantSelection) &&
                  ifIsInventoryControlEnabled(inventory) &&
                  availableProductsPerVariant.push(variant);
              }),
              availableProductsPerVariant
            );
          }
        }
        function updateVariantOptions(
          availableProductsPerVariant,
          variantSelectionGroup,
          currentVariantSelectionElement
        ) {
          const otherVariantGroups = variantGroups.filter(
            variantGroup => variantGroup.name !== variantSelectionGroup
          );
          let variantGroupsStateChange = !1;
          if (
            (otherVariantGroups.forEach(otherVariantGroup => {
              const {
                  editorElementGroupName: editorElementGroupName,
                  element: element,
                  variantGroupType: variantGroupType,
                  name: name,
                  options: options,
                } = otherVariantGroup,
                otherVariantGroupName =
                  (string = editorElementGroupName || name).charAt(0).toUpperCase() +
                  string.slice(1).toLowerCase();
              var string;
              const hasSelection = (function (variantGroupElement, variantGroupType) {
                if ("radio" === variantGroupType)
                  return variantGroupElement.querySelectorAll("[required]:checked").length > 0;
                if ("select" === variantGroupType)
                  return !!variantGroupElement.querySelector("select").selectedOptions[0].value;
                return !1;
              })(element, variantGroupType);
              let availableProductOptions = availableProductsPerVariant.map(e => e[name]),
                unavailableOptions = options.filter(
                  value => !availableProductOptions.includes(value)
                );
              "radio" === variantGroupType
                ? (element
                    .querySelectorAll(`input[name=${otherVariantGroupName}]`)
                    .forEach(input => {
                      input.parentElement.classList.remove(disableClass);
                    }),
                  0 !== unavailableOptions.length &&
                    unavailableOptions.forEach(option => {
                      const radioElements = element.querySelectorAll("input[type='radio']"),
                        exactMatchOptionInput = Array.from(radioElements).find(
                          input => input.value === option
                        );
                      if (
                        (exactMatchOptionInput.parentElement.classList.add(disableClass),
                        hasSelection)
                      ) {
                        const unavailableElement =
                          !0 === exactMatchOptionInput.checked && exactMatchOptionInput;
                        unavailableElement &&
                          ((unavailableElement.checked = !1),
                          unavailableElement.parentElement.classList.add(disableClass),
                          unavailableElement?.previousElementSibling?.classList?.remove(
                            "w--redirected-checked"
                          ),
                          (variantGroupsStateChange = !0));
                      }
                    }))
                : "select" === variantGroupType &&
                  (element
                    .querySelectorAll(`select option.${disableOptionClass}`)
                    .forEach(option => {
                      option.classList.remove(disableOptionClass);
                      const unavailableText = ` (${config.selectUnavailableLabel})`,
                        optionText = option.textContent.split(unavailableText)[0];
                      option.textContent = optionText;
                    }),
                  0 !== unavailableOptions.length &&
                    unavailableOptions.forEach(option => {
                      const selectOptions = element.querySelector("select")?.options,
                        exactMatchOption = Array.from(selectOptions).find(
                          opt => opt.value === option
                        ),
                        selectedOptionValue =
                          element.querySelector("select").selectedOptions[0].value;
                      if (
                        (exactMatchOption.classList.add(disableOptionClass),
                        config.selectUnavailableLabel)
                      ) {
                        const unavailableText = `(${config.selectUnavailableLabel})`;
                        exactMatchOption.textContent = `${exactMatchOption.textContent} ${unavailableText}`;
                      }
                      hasSelection &&
                        selectedOptionValue === option &&
                        ((element.querySelector("select").selectedIndex = 0),
                        (variantGroupsStateChange = !0));
                    }));
            }),
            variantGroupsStateChange)
          ) {
            removeDisabledStyleVariantGroupOptions(currentVariantSelectionElement, !0);
            const selectedProductVariants = getSelectedVariantOptions();
            updateVariantOptions(
              getAvailableProductsPerVariantSelection(
                currentVariantSelectionElement.value,
                selectedProductVariants
              ),
              variantSelectionGroup,
              currentVariantSelectionElement
            );
          }
        }
        function moneyFormat(locale, currency, number) {
          const numericValue = parseFloat(number);
          let decimalPlaces = numericValue.toString().includes(".")
            ? numericValue.toString().split(".")[1].length
            : 0;
          const webflowFractionDigits = window?.__WEBFLOW_CURRENCY_SETTINGS?.fractionDigits;
          return (
            webflowFractionDigits &&
              webflowFractionDigits > decimalPlaces &&
              (decimalPlaces = webflowFractionDigits),
            new Intl.NumberFormat(locale, {
              style: "currency",
              currency: currency,
              minimumFractionDigits: decimalPlaces,
              maximumFractionDigits: decimalPlaces,
            }).format(numericValue)
          );
        }
        function sanitize(string) {
          return "string" != typeof string ? string : string.trim().toLowerCase();
        }
        function filterEmpty(obj) {
          return Object.entries(obj).reduce((a, [k, v]) => (v ? ((a[k] = v), a) : a), {});
        }
        return (
          stylesAdded ||
            (document.head.insertAdjacentHTML(
              "beforeend",
              `<style>\n         .${disableClass} {opacity: 0.5 !important; }  \n          .${disableOptionClass} {color: #808080 !important;} \n          </style>`
            ),
            (stylesAdded = !0)),
          { init: init, setConfig: setConfig }
        );
      },
    };
  })();
