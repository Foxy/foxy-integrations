var FC = FC || {},
  Weglot = Weglot || {},
  Foxy = (function () {
    let e = !1;
    return {
      setVariantConfig: function (t) {
        const n = {
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
          r = "foxy-disable",
          o = "foxy-disable-option",
          a = "foxy-variant-group",
          i = "foxy-variant-group-order",
          l = "[foxy-id='variant-item']",
          c = "foxy-variant-group-name";
        let s = [],
          u = { serialized: {}, array: [] },
          d = [],
          f = !0,
          p = !1;
        const y = { ...t };
        x(n, t);
        let m = (function () {
          let e = document;
          const t = document?.currentScript?.closest("[foxy-id='container']");
          t && (e = t);
          return e;
        })();
        const v = m.querySelector("[foxy-id='form']"),
          g = m.querySelector("[foxy-id='image']"),
          b = m.querySelector("[foxy-id='price']"),
          C = m.querySelector("[foxy-id='inventory']"),
          h = v?.querySelector("input[name='quantity']"),
          L = v?.querySelector("input[name='price']"),
          S = v?.querySelector("input[name='quantity_max']"),
          q = v?.querySelectorAll(`[${a}]`),
          E = document.querySelector("[foxy-id='switch']");
        function x(e, t) {
          if (t && "object" == typeof t) for (const n in t) n in e && (e[n] = t[n]);
        }
        function A() {
          let e = "DEFAULT";
          const t = { defaultCurrency: n.defaultCurrency, defaultLocale: n.defaultLocale },
            r = (function (e, t) {
              const n = e.split("/"),
                r = n[2].split(".")[0],
                o = n[3],
                a = "subdomain" === t.addonsConfig.templateChangeTrigger,
                i = "subdirectory" === t.addonsConfig.templateChangeTrigger;
              if (a && t.addonsConfig.templateSets[r]) return r;
              if (i && t.addonsConfig.templateSets[o]) return o;
              return null;
            })(window.location.href, n),
            o = "country" === n.addonsConfig.templateChangeTrigger,
            a = "weglotjs" === n.addonsConfig.templateChangeTrigger,
            i = r => {
              const o = n.addonsConfig.templateSets[r];
              if (o) {
                const { currency: a, locale: i } = o;
                (t.defaultCurrency = a), (t.defaultLocale = i), (e = r);
                const l = n.addonsConfig.translations[r];
                if (l) {
                  const { selectUnavailableLabel: e, inventoryDefaultLabel: n } = l;
                  (t.selectUnavailableLabel = e), (t.inventoryDefaultLabel = n);
                }
              } else {
                const {
                  defaultCurrency: n,
                  defaultLocale: r,
                  selectUnavailableLabel: o,
                  inventoryDefaultLabel: a,
                } = y;
                (t.defaultCurrency = n),
                  (t.defaultLocale = r),
                  (t.selectUnavailableLabel = o),
                  (t.inventoryDefaultLabel = a),
                  (e = "DEFAULT");
              }
            },
            l = (r, o) => {
              i(r), D(), (f = !1), x(n, t), O(e, !0);
            },
            c = r => {
              const o = r.target.getAttribute("foxy-template");
              o && ((f = !1), D(), i(o), x(n, t), O(e, !0));
            };
          if (o) {
            const e = FC.json.shipping_address.country.toLowerCase();
            i(e);
          }
          a && (i(Weglot.getCurrentLang()), Weglot.on("languageChanged", l)),
            r && i(r),
            x(n, t),
            O(e),
            !p && E && (E?.addEventListener("click", c), (p = !0));
        }
        function O(e, t = !1) {
          (FC.json.template_set || "DEFAULT") !== e &&
            FC.client.request(`https://${FC.settings.storedomain}/cart?template_set=${e}`),
            t && $();
        }
        function $() {
          if ((n.multiCurrency || n.multilingual) && f) {
            const e = "function" == typeof FC.onLoad ? FC.onLoad : function () {};
            FC.onLoad = function () {
              e(), (f = !1), FC.client.on("ready.done", A).on("ready.done", $);
            };
          } else
            h && (h.setAttribute("value", "1"), h.setAttribute("min", "1")),
              (function () {
                const e = m.querySelectorAll(l);
                if (!e.length) return;
                e.forEach(e => {
                  const t = Object.values(e.attributes).reduce((e, t) => {
                    const { name: r, value: o } = t;
                    if (r.includes("foxy-variant") && o) {
                      const t = P(r.split("foxy-variant-")[1]),
                        a = P(n.defaultCurrency);
                      if (!e[t]) {
                        if (n.multiCurrency && t === `price-${a}`) return (e.price = o.trim()), e;
                        if (n.multiCurrency && t.includes("price") && t !== `price-${a}`) return e;
                        e["sku" === t ? "code" : t] = o.trim();
                      }
                      return e;
                    }
                    return e;
                  }, {});
                  (u.serialized[t?.code ?? t.name] = _(t)), u.array.push(_(t));
                }),
                  console.log("variantItems", u);
              })(),
              (function () {
                if (!q) return;
                q.forEach(e => {
                  let t;
                  const r = P(e.getAttribute(a)),
                    o = (function (e) {
                      const t = [];
                      return (
                        u.array.forEach(n => {
                          const r = n[e]?.trim(),
                            o = Object.fromEntries(
                              Object.entries(n)
                                .filter(([t, n]) => {
                                  if (t.includes(`${e}-`) && n) return !0;
                                })
                                .map(([t, n]) => [t.replace(`${e}-`, ""), n])
                            );
                          r &&
                            !t.some(e => e.variantOption === r) &&
                            t.push({
                              inventory: n.inventory,
                              label: n.label,
                              price: n.price,
                              variantOption: r,
                              styles: o,
                            });
                        }),
                        (function (e) {
                          const { sortBy: t, sortOrder: r } = n,
                            o = (e, n) => {
                              if ("price" === t) {
                                const t = e.price,
                                  o = n.price;
                                return "Descending" === r ? o - t : t - o;
                              }
                              if ("label" === t) {
                                const t = e.label,
                                  o = n.label;
                                if ("descending" === r) return o.localeCompare(t);
                                if ("ascending" === r) return t.localeCompare(o);
                              }
                              return 0;
                            };
                          t
                            ? e.sort(o)
                            : e.sort((e, t) => {
                                const n = e.variantOption,
                                  o = t.variantOption;
                                return "descending" === r
                                  ? o.localeCompare(n)
                                  : "ascending" === r
                                  ? n.localeCompare(o)
                                  : 0;
                              });
                        })(t),
                        t
                      );
                    })(r),
                    l = o.map(e => e.variantOption),
                    c = (function (e) {
                      const t = e.querySelector("select"),
                        n = e.querySelector("input[type=radio]");
                      if (t) return "select";
                      if (n) return "radio";
                    })(e),
                    s = "select" === c ? "select" : ".w-radio";
                  t =
                    "select" === s
                      ? e.querySelector(s).getAttribute("data-name")
                      : e.querySelector(`${s} input[type=radio]`).getAttribute("data-name");
                  const f =
                    e
                      .getAttribute(i)
                      ?.trim()
                      .split(/\s*,\s*/) ?? null;
                  0 === l.length
                    ? e.remove()
                    : (d.push({
                        editorElementGroupName: t,
                        customSortOrder: f,
                        element: e,
                        options: l,
                        optionsData: o,
                        name: r,
                        variantGroupType: c,
                        variantOptionDesign: e.querySelector(s),
                        variantOptionDesignParent: e.querySelector(s).parentElement,
                      }),
                      e.querySelector(s).remove());
                }),
                  console.log("variantGroups", d);
              })(),
              (function () {
                const e = (e, t) => Object.keys(t).forEach(n => (e.style[n] = t[n])),
                  t = t => {
                    const {
                      editorElementGroupName: o,
                      element: i,
                      name: l,
                      options: s,
                      optionsData: u,
                      customSortOrder: f,
                      variantOptionDesign: p,
                      variantOptionDesignParent: y,
                    } = t;
                    (f || s).forEach((t, s) => {
                      const f = u.find(e => e.variantOption === t),
                        m = p.cloneNode(!0),
                        v = m.querySelector("input[type=radio]"),
                        g = m.querySelector("span[for]");
                      (g.textContent = t),
                        g.setAttribute("for", `${t}-${s}`),
                        (v.id = `${t}-${s}`),
                        (v.name = o || l),
                        (v.value = t),
                        v.setAttribute(c, l),
                        (v.required = !0),
                        n.inventoryControl &&
                          1 === d.length &&
                          !Number(f.inventory) &&
                          ((v.disabled = !0), v.parentElement.classList.add(r));
                      const b = m.querySelector("div.w-radio-input");
                      b && e(b, f.styles), y?.getAttribute(a) ? i.append(m) : y.append(m);
                    });
                  },
                  o = e => {
                    const {
                        editorElementGroupName: t,
                        element: r,
                        name: o,
                        options: i,
                        optionsData: l,
                        customSortOrder: s,
                        variantOptionDesign: u,
                        variantOptionDesignParent: f,
                      } = e,
                      p = s || i;
                    let y = u.cloneNode(!0);
                    (y.required = !0),
                      (y.name = t || o),
                      y.setAttribute(c, o),
                      p.forEach(e => {
                        const t = l.find(t => t.variantOption === e);
                        let r = new Option(e, e);
                        if (n.inventoryControl && 1 === d.length && !Number(t.inventory)) {
                          let t;
                          n.selectUnavailableLabel && (t = `(${n.selectUnavailableLabel})`),
                            (r = new Option(`${e} ${t}`, e)),
                            (r.disabled = !0);
                        }
                        y.add(r);
                      }),
                      f.getAttribute(a) ? r.append(y) : f.append(y);
                  };
                if (!d.length) return;
                d.forEach(e => {
                  "select" === e.variantGroupType ? o(e) : t(e);
                });
              })(),
              N(),
              w(),
              v?.addEventListener("change", U);
        }
        function D() {
          d.length &&
            (d.forEach(e => {
              const { variantOptionDesignParent: t } = e;
              if ("radio" === e.variantGroupType) {
                const e = t.querySelectorAll("input[type=radio]");
                for (let t = 1; t < e.length; t++) e[t].parentNode.remove();
              }
              if ("select" === e.variantGroupType) {
                const e = t.querySelectorAll("option");
                for (let t = 1; t < e.length; t++) e[t].remove();
              }
            }),
            (s = []),
            (u = { serialized: {}, array: [] }),
            (d = []));
        }
        function N() {
          if (
            (u.array.length <= 1 &&
              b &&
              (b.textContent = G(n.defaultLocale, n.defaultCurrency, b.textContent)),
            u.array.length > 1)
          ) {
            const e = u.array.map(e => Number(e.price)).sort((e, t) => e - t);
            if (e[0] !== e[e.length - 1]) {
              if ("low" === n.priceDisplay)
                return (
                  b && (b.textContent = G(n.defaultLocale, n.defaultCurrency, e[0])),
                  void b?.classList.remove("w-dyn-bind-empty")
                );
              if ("high" === n.priceDisplay)
                return (
                  b && (b.textContent = G(n.defaultLocale, n.defaultCurrency, e[e.length - 1])),
                  void b?.classList.remove("w-dyn-bind-empty")
                );
              const t = `${G(n.defaultLocale, n.defaultCurrency, e[0])}–${G(
                n.defaultLocale,
                n.defaultCurrency,
                e[e.length - 1]
              )}`;
              b && (b.textContent = t), b?.classList.remove("w-dyn-bind-empty");
            } else {
              const t = G(n.defaultLocale, n.defaultCurrency, e[0]);
              b && (b.textContent = t), L && (L.value = t);
            }
          }
        }
        function w(e) {
          if (e) {
            if (!n.inventoryControl) return;
            const e = h?.value ?? 1,
              t = v.querySelector("input[type=submit]"),
              o = 1 === u.array.length ? u.array[0]?.inventory : s?.inventory;
            if ((Number(e) > Number(o) && (h.value = 1), C)) {
              if (void 0 === o)
                return (C.textContent = "0"), (t.disabled = !0), void t.classList.add(r);
              if (Number(e) <= Number(o))
                return (C.textContent = o), (t.disabled = !1), void t.classList.remove(r);
            }
          } else
            1 !== u.array.length
              ? u.array.length > 1 &&
                C &&
                ((C.textContent = n.inventoryDefaultLabel), C.classList.remove("w-dyn-bind-empty"))
              : n.inventoryControl && (S.value = u.array[0]?.inventory ?? 0);
        }
        function U(e) {
          const t = e.target,
            { value: r } = t,
            o = t,
            i = r;
          if (!r) return;
          if (!t.closest(`div[${a}]`)) return;
          const l = P(t.getAttribute(c));
          F(o, !1);
          const u = T();
          console.log("selectedProductVariants", u);
          const d = k(i, u);
          console.log("availableProductsPerVariant", d),
            j(d, l, o),
            (function (e, t) {
              const r = (function () {
                if (0 === v.querySelectorAll("[foxy-variant-group] [required]:invalid").length)
                  return !0;
                return !1;
              })();
              if (r)
                return (
                  (s = e.find(e => {
                    let n = [];
                    return (
                      Object.keys(t).forEach(r => {
                        e[r] === t[r] ? n.push(!0) : n.push(!1);
                      }),
                      n.every(e => !0 === e)
                    );
                  })),
                  void Object.keys(s).forEach(e => {
                    const t = v.querySelector(`input[type='hidden'][name="${e}"]`);
                    switch ((t && (t.value = s[e]), e)) {
                      case "inventory":
                        if (!n.inventoryControl) break;
                        (v.querySelector('input[name="quantity_max"]').value = s[e]),
                          h?.setAttribute("max", s[e]),
                          w(r);
                        break;
                      case "price":
                        b && (b.textContent = G(n.defaultLocale, n.defaultCurrency, s[e]));
                        break;
                      case "image":
                        g?.setAttribute("srcset", ""), g?.setAttribute("src", s[e]);
                    }
                  })
                );
              N(), w();
            })(d, u);
        }
        function F(e, t) {
          const { nodeName: i } = e;
          if ("INPUT" === i) {
            if ((e.parentElement.classList.remove(r), t)) {
              e.closest(`[${a}]`)
                .querySelectorAll(`.${r}`)
                .forEach(e => e.classList.remove(r));
            }
          } else
            "SELECT" === i &&
              e.querySelectorAll(`select option.${o}`).forEach(e => {
                e.classList.remove(o);
                const t = ` (${n.selectUnavailableLabel})`,
                  r = e.textContent.split(t)[0];
                e.textContent = r;
              });
        }
        function T() {
          const e = {};
          return (
            v
              .querySelectorAll(
                `div[${a}] input:checked, div[${a}] select[required]:valid option:checked,div[${a}] option:checked`
              )
              .forEach(t => {
                t.value &&
                  ("OPTION" !== t.nodeName
                    ? (e[P(t.getAttribute(c))] = t.value)
                    : (e[P(t.parentElement.getAttribute(c))] = t.value));
              }),
            e
          );
        }
        function k(e, t) {
          const r = e => !n.inventoryControl || Number(e) > 0;
          if (d.length > 2)
            return u.array.filter(e => {
              const n = Number(e.inventory);
              let o = [];
              return (
                Object.keys(t).forEach(n => {
                  e[n] === t[n] ? o.push(!0) : o.push(!1);
                }),
                o.every(e => !0 === e) && r(n)
              );
            });
          if (d.length <= 2) {
            const t = [];
            return (
              u.array.forEach(n => {
                const o = Number(n.inventory);
                Object.values(n).includes(e) && r(o) && t.push(n);
              }),
              t
            );
          }
        }
        function j(e, t, a) {
          const i = d.filter(e => e.name !== t);
          console.log("otherVariantGroups", i);
          let l = !1;
          if (
            (i.forEach(t => {
              const {
                editorElementGroupName: a,
                element: i,
                variantGroupType: c,
                name: s,
                options: u,
              } = t;
              console.log("otherVariantGroup", t);
              const d = (f = a || s).charAt(0).toUpperCase() + f.slice(1).toLowerCase();
              var f;
              const p = (function (e, t) {
                if ("radio" === t) return e.querySelectorAll("[required]:checked").length > 0;
                if ("select" === t) return !!e.querySelector("select").selectedOptions[0].value;
                return !1;
              })(i, c);
              let y = e.map(e => e[s]),
                m = u.filter(e => !y.includes(e));
              console.log("unavailableOptions for ", s, m),
                "radio" === c
                  ? (i.querySelectorAll(`input[name=${d}]`).forEach(e => {
                      e.parentElement.classList.remove(r);
                    }),
                    0 !== m.length &&
                      (console.log("element for radio", i),
                      m.forEach(e => {
                        const t = i.querySelectorAll("input[type='radio']"),
                          n = Array.from(t).find(t => t.value === e);
                        if ((n.parentElement.classList.add(r), p)) {
                          const e = !0 === n.checked && n;
                          e &&
                            ((e.checked = !1),
                            e.parentElement.classList.add(r),
                            console.log(e?.previousElementSibling?.classList),
                            e?.previousElementSibling?.classList?.remove("w--redirected-checked"),
                            (l = !0));
                        }
                      })))
                  : "select" === c &&
                    (i.querySelectorAll(`select option.${o}`).forEach(e => {
                      e.classList.remove(o);
                      const t = ` (${n.selectUnavailableLabel})`,
                        r = e.textContent.split(t)[0];
                      e.textContent = r;
                    }),
                    0 !== m.length &&
                      m.forEach(e => {
                        const t = i.querySelector("select")?.options,
                          r = Array.from(t).find(t => t.value === e),
                          a = i.querySelector("select").selectedOptions[0].value;
                        if ((r.classList.add(o), n.selectUnavailableLabel)) {
                          const e = `(${n.selectUnavailableLabel})`;
                          r.textContent = `${r.textContent} ${e}`;
                        }
                        p && a === e && ((i.querySelector("select").selectedIndex = 0), (l = !0));
                      }));
            }),
            l)
          ) {
            F(a, !0);
            const e = T();
            j(k(a.value, e), t);
          }
        }
        function G(e, t, n) {
          const r = parseFloat(n);
          let o = r.toString().includes(".") ? r.toString().split(".")[1].length : 0;
          const a = window?.__WEBFLOW_CURRENCY_SETTINGS?.fractionDigits;
          return (
            a && a > o && (o = a),
            new Intl.NumberFormat(e, {
              style: "currency",
              currency: t,
              minimumFractionDigits: o,
              maximumFractionDigits: o,
            }).format(r)
          );
        }
        function P(e) {
          return "string" != typeof e ? e : e.trim().toLowerCase();
        }
        function _(e) {
          return Object.entries(e).reduce((e, [t, n]) => (n ? ((e[t] = n), e) : e), {});
        }
        return (
          e ||
            (document.head.insertAdjacentHTML(
              "beforeend",
              `<style>\n         .${r} {opacity: 0.5 !important; }  \n          .${o} {color: #808080 !important;} \n          </style>`
            ),
            (e = !0)),
          { init: $, setConfig: x }
        );
      },
    };
  })();
