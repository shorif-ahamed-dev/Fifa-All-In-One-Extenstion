// 🔹 Constants
const API_BASE = "http://localhost:3000/api";
const IFRAME_CHECK_INTERVAL = 250;

// 🔹 helper
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
    console.warn("⚠️ Header iframe not accessible");
    return "Unknown User";
  }
}

// 🔹 login
function detectLoginForm() {
  return Boolean(
    document.querySelector("input[type=email], input[name=email], #email") &&
      document.querySelector(
        "input[type=password], input[name=password], #password"
      )
  );
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

async function getUnusedLogin() {
  return fetchJson(`${API_BASE}/search/status?value=N/A`);
}

// 🔹 Payment
async function handlePayment(tabId) {
  try {
    // 2️⃣ Extract User Name
    const fullName = await getUserFullName(tab.id);
    const paymentFrame = await waitForIframeByUrl(
      tabId,
      "payment-p8.secutix.com/alias"
    );
    const cardData = await getCardDataByName(fullName);
    if (!cardData) return false;

    await exec(tabId, {
      target: { frameIds: [paymentFrame.frameId] },
      func: fillCardFormInIframe,
      args: [cardData],
    });

    return true;
  } catch {
    console.warn("⚠️ Payment iframe not found");
    return false;
  }
}

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
  setValue(fields.holder, data.name || data.holder);
  setValue(fields.month, data.month);
  setValue(fields.year, data.year);
  setValue(fields.cvv, data.cvv);

  const addNowBtn = document.querySelector(
    "button.widgetPayNowButton, button.sc-dIUggk.widgetPayNowButton"
  );

  if (!addNowBtn) return false;

  // addNowBtn.click();
  postStatus(data.email, "Done");

  return true;
}

// 🔹 Ticket Automation
function runTicketAutomation(matchNames, category, quantity) {
  const ul = document.getElementById(
    "stx-lt-product-subscription-10229225515651"
  );

  if (!ul) {
    return;
  }

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
async function runTicketSelection(tabId) {
  const name = await getUserFullName(tabId);
  const data = await getCardDataByName(name);

  if (!data) return false;

  const matchNames = Array.isArray(data.matches)
    ? data.matches.map(String)
    : String(data.matches || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

  const category = Number(data.category);
  const quantity = Number(data.quantity);

  return exec(tabId, {
    func: runTicketAutomation,
    args: [matchNames, category, quantity],
  });
}

// 🔹 Main Extension Flow
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  try {
    // 1️⃣ Login Flow
    const hasLogin = await exec(tab.id, { func: detectLoginForm });
    if (hasLogin) {
      const loginData = await getUnusedLogin();
      if (loginData) {
        await exec(tab.id, { func: fillLoginForm, args: [loginData] });
        await postStatus(loginData.email, "Used");
      }
      return;
    }
    // Run ticket automation after login
    await runTicketSelection(tab.id);

    // 3️⃣ Payment Flow
    // Step 3: Fill payment iframe

    const fullname = await getUserFullName(tab.id);
    const apiData = await getCardDataByName(fullname);
    try {
      const paymentIframe = await waitForIframeByUrl(
        tab.id,
        "https://payment-p8.secutix.com/alias",
        15000
      );
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [paymentIframe.frameId] },
        func: fillCardFormInIframe,
        args: [apiData],
      });
    } catch (err) {
      console.error("Payment iframe not found or injection failed:", err);
    }
  } catch (err) {
    console.error("❌ Extension error:", err);
  }
});
