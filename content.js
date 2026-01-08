// content.js

// =======================
// 🔹 Helper Functions
// =======================
function setNativeValue(el, val) {
  const lastValue = el.value;
  el.value = val;
  el._valueTracker && el._valueTracker.setValue(lastValue);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// =======================
// 🔹 FIFA Form Autofill
// =======================
function fillSecondForm(data) {
  const ageCheckbox = document.querySelector("#contactCriteria\\[AGEVAL\\]");
  const tac = document.getElementById("contactCriteriaEXTDELlD.values1");
  const fanSelect = document.querySelector("#contactCriteriaFanOF26\\.values0");
  const address1 = document.querySelector("#address_line_1");
  const state = document.querySelector("#locality_STATE");
  const city = document.querySelector("#address_town_standalone");
  const zip = document.querySelector("#address_zipcode_standalone");
  const phone = document.querySelector("#mobile_number");
  const saveBtn = document.querySelector("#save");

  if (ageCheckbox) {
    ageCheckbox.checked = true;
    ageCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (tac) {
    tac.checked = true;
    tac.dispatchEvent(new Event("change", { bubbles: true }));
  }

  if (fanSelect) {
    fanSelect.value = "USA";
    fanSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }

  if (address1 && data.address) setNativeValue(address1, data.address);
  if (city && data.city) setNativeValue(city, data.city);
  if (zip && data.postcode) setNativeValue(zip, data.postcode);
  if (state && data.state) {
    state.value = data.state;
    state.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (phone && data.phone_number) setNativeValue(phone, data.phone_number);
  if (saveBtn) {
    setTimeout(() => {
      saveBtn.click();
      console.log("Save button clicked ✅");
    }, 1000);
  }
}

function initSecondFormAutoFill() {
  const emailInput = document.querySelector("#login");
  if (!emailInput) return;
  const email = emailInput.value;
  if (!email) return;

  fetch(
    `http://localhost:3000/api/search/email?value=${encodeURIComponent(email)}`
  )
    .then((res) => res.json())
    .then((data) => {
      if (data && data.email) fillSecondForm(data);
    })
    .catch((err) => console.error("Failed to fetch FIFA form data:", err));
}

// =======================
// 🔹 Controller
// =======================
window.addEventListener("load", () => {
  const interval = setInterval(() => {
    // detect address form
    const fifaFormReady =
      document.querySelector("#login") &&
      document.querySelector("#contactCriteria\\[AGEVAL\\]");

    //detect continue button
    const continueBtn = document.querySelector("#btnSubmitProfile");
    if (continueBtn) {
      clearInterval(interval);
      continueBtn.click();
    }
    // ballot
    const randomeBallow = document.getElementById(
      "stx-ballot-selection-details-10229650558900"
    );
    if (randomeBallow) {
      clearInterval(interval);
      randomeBallow.click();
    }

    //signup password

    const password = document.querySelector("#password");
    const confirmPassword = document.querySelector("#confirm-password");
    const terms = document.querySelector("#TandC");

    if (password && confirmPassword && terms) {
      password.value = "Tickets@123";
      confirmPassword.value = "Tickets@123";
      terms.checked = true;
    }

    // continue button

    const continueBtnss = [...document.querySelectorAll("button")].find(
      (btn) =>
        btn.innerText.trim() === "Continue" ||
        btn.getAttribute("aria-label") === "Continue"
    );
    if (continueBtnss) {
      clearInterval(interval);
      continueBtnss.click();
    }
    if (fifaFormReady) {
      clearInterval(interval);
      initSecondFormAutoFill();
    }
  }, 1000);
});
