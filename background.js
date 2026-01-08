// 🔹 Constants
const API_BASE = "http://localhost:3000/api";
const IFRAME_CHECK_INTERVAL = 250;

// 🔹 Helper Functions
async function postStatus(email, status) {
  try {
    await fetch(`${API_BASE}/update-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, status }),
    });
  } catch {}
}

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function exec(tabId, options) {
  const res = await chrome.scripting.executeScript({
    target: { tabId, ...options.target },
    func: options.func,
    args: options.args || [],
  });
  return res?.[0]?.result;
}

function waitForIframeByUrl(tabId, urlPart, timeout = 15000) {
  return new Promise((resolve, reject) => {
    let elapsed = 0;

    const check = () => {
      chrome.webNavigation.getAllFrames({ tabId }, (frames) => {
        const frame = frames?.find((f) => f.url?.includes(urlPart));
        if (frame) return resolve(frame);

        elapsed += IFRAME_CHECK_INTERVAL;
        if (elapsed >= timeout) {
          return reject(new Error(`Iframe '${urlPart}' not found`));
        }

        setTimeout(check, IFRAME_CHECK_INTERVAL);
      });
    };

    check();
  });
}

function extractFullNameFromHeader() {
  const el = document.querySelector("a.fp-menu-item.user_name");
  return el?.textContent.trim() || null;
}

async function getUserFullName(tabId) {
  try {
    const headerFrame = await waitForIframeByUrl(
      tabId,
      "fifa-fwc26-us.tickets.fifa.com/api/1/resources/custom/en/header.html"
    );

    const name = await exec(tabId, {
      target: { frameIds: [headerFrame.frameId] },
      func: extractFullNameFromHeader,
    });

    return name || "Unknown User";
  } catch {
    return "Unknown User";
  }
}

// 🔹 Login Functions
function detectLoginForm() {
  const hasLogin = Boolean(
    document.querySelector("input[type=email], input[name=email], #email") &&
      document.querySelector(
        "input[type=password], input[name=password], #password"
      )
  );
  const hasApplication = Boolean(
    document.getElementById("stx-lt-product-subscription-10229225515651")
  );

  const hasSignup = Boolean(document.querySelector("#firstname"));
  return { hasLogin, hasApplication, hasSignup };
}

function fillLoginForm(data) {
  function setValue(el, value) {
    if (!el) return;
    el.focus?.();
    el.value = value ?? "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const email = document.querySelector("input[type='email'], #email");
  const pass = document.querySelector("input[type='password'], #password");
  const submit = document.querySelector(
    "button[type='submit'], #loginFormSubmitBtn"
  );

  if (!email || !pass || !submit) return false;

  setValue(email, data.email);
  setValue(pass, data.password);

  submit.click();

  return true;
}

function fillSignupForm(data) {
  if (document.readyState !== "complete") {
    window.addEventListener("load", () => fillSignupForm(data), {
      once: true,
    });
    return;
  }

  const setValue = (selector, value) => {
    const el = document.querySelector(selector);
    if (!el || value == null) return;
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const firstnameEl = document.querySelector("#firstname");
  const lastnameEl = document.querySelector("#lastname");

  const fullName = data.name?.trim() || "";
  const parts = fullName.split(/\s+/);

  if (firstnameEl && lastnameEl) {
    // Form has separate first + last name
    setValue("#firstname", parts[0] || "");
    setValue("#lastname", parts.slice(1).join(" ") || "");
  } else if (firstnameEl) {
    // Form has only one name field (first/full name)
    setValue("#firstname", fullName);
  }

  setValue("#email", data.email);
  setValue("#gender", data.gender);

  setValue("#day", data.day);
  setValue("#month", data.month);
  setValue("#year", data.year);

  setValue("#country", data.country);
  setValue("#preferredLanguage", "en-GB");

  const submitBtn = document.querySelector("#btnSubmitRegister");
  if (submitBtn) {
    submitBtn.click();
  } else {
    document.querySelector("#frmRegister")?.requestSubmit();
  }
}

async function getUnusedLogin() {
  return fetchJson(`${API_BASE}/search/status?value=N/A`);
}

// 🔹 Payment Functions
async function getCardDataByName(fullName) {
  return fetchJson(
    `${API_BASE}/search/name?value=${encodeURIComponent(fullName)}`
  );
}

function fillCardFormInIframe(data) {
  function setValue(el, value) {
    if (!el) return;
    el.focus?.();
    el.value = value ?? "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const fields = {
    number: document.querySelector("#card_number, input[name='cardnumber']"),
    holder: document.querySelector("#card_holder, input[name='cardholder']"),
    month: document.querySelector(
      "#card_expiration_date_month, select[name='exp_month']"
    ),
    year: document.querySelector(
      "#card_expiration_date_year, select[name='exp_year']"
    ),
    cvv: document.querySelector("#card_cvv, input[name='cvv']"),
  };

  setValue(fields.number, data.card_number);
  setValue(fields.holder, data.name);
  setValue(fields.month, data.card_month);
  setValue(fields.year, data.card_year);
  setValue(fields.cvv, data.cvv);

  const addNowBtn = document.querySelector(
    "button.widgetPayNowButton, button.sc-dIUggk.widgetPayNowButton"
  );

  if (!addNowBtn) return false;

  // Uncomment to auto-click payment button
  // addNowBtn.click();

  return true;
}

// 🔹 Ticket Automation
function runTicketAutomation(data) {
  const matchNames = Array.isArray(data.matches)
    ? data.matches.map(String)
    : String(data.matches || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

  const category = Number(data.category);
  const quantity = Number(data.quantity);

  const ul = document.getElementById(
    "stx-lt-product-subscription-10229225515651"
  );

  if (!ul) return false;

  const listItems = ul.querySelectorAll("li");

  listItems.forEach((li) => {
    if (li.dataset.extensionProcessed === "true") return;

    const title = li.querySelector("p.tw-m-0.tw-font-semibold.stx-text-body2");
    if (!title) return;

    const matchNumber = title.textContent.replace(/\D+/g, "");

    if (!matchNames.includes(matchNumber)) return;

    li.dataset.extensionProcessed = "true";

    const showMoreBtn = li.querySelector('button[aria-label="Show more"]');
    if (!showMoreBtn) return;

    showMoreBtn.click();

    setTimeout(() => {
      const categories = li.querySelectorAll("div.sc-clsFYl");
      const categoryIndex = category - 1;

      if (!categories[categoryIndex]) return;

      categories[categoryIndex].click();

      const increaseBtn = li.querySelector(
        `button[aria-label="Increase quantity of Category ${category} Ticket Price"]`
      );

      if (!increaseBtn) return;

      for (let i = 0; i < quantity; i++) {
        increaseBtn.click();
      }
    }, 500);
  });

  return true;
}

// 🔹 Main Extension Flow
chrome.action.onClicked.addListener(async (tab) => {
  console.log("extenstion clicked");
  if (!tab?.id) return;

  // 1️⃣ Detect Page Type
  const { hasLogin, hasSignup, hasApplication } = await exec(tab.id, {
    func: detectLoginForm,
  });

  try {
    console.log("Page Detection:", {
      hasLogin,
      hasSignup,
      hasApplication,
    });

    // 2️⃣ Handle Login Page
    if (hasLogin) {
      const loginData = await getUnusedLogin();
      if (!loginData) return;

      await exec(tab.id, { func: fillLoginForm, args: [loginData] });
      await postStatus(loginData.email, "Used");
      return;
    }

    // 3️⃣ Handle Signup Page
    if (hasSignup) {
      const signUpData = await getUnusedLogin();

      if (!signUpData) return;

      await exec(tab.id, { func: fillSignupForm, args: [signUpData] });
      await postStatus(signUpData.email, "Used");
      return;
    }

    // 4️⃣ Handle Ticket Application Page
    if (hasApplication) {
      const name = await getUserFullName(tab.id);
      const data = await getCardDataByName(name);
      console.log("Fetched ticket automation data:", name, data);
      if (!data) return;

      await exec(tab.id, {
        func: runTicketAutomation,
        args: [data],
      });
      return;
    }

    // 5️⃣ Handle Payment Page
    try {
      const paymentIframe = await waitForIframeByUrl(
        tab.id,
        "payment-p8.secutix.com/alias",
        15000
      );

      if (paymentIframe.frameId) {
        const fullname = await getUserFullName(tab.id);
        const apiData = await getCardDataByName(fullname);
        console.log("Fetched card data:", apiData);
        if (!apiData) return;

        await chrome.scripting.executeScript({
          target: { tabId: tab.id, frameIds: [paymentIframe.frameId] },
          func: fillCardFormInIframe,
          args: [apiData],
        });

        await postStatus(apiData.email, "Done");
      }
    } catch {}
  } catch (err) {
    console.error("Error in extension flow:", err);
  }
});
