const form = document.querySelector("#account-form");
const message = document.querySelector("#message");
const password = document.querySelector("#password");
const passwordHint = document.querySelector("#password-hint");
const submitButton = document.querySelector("#submit-button");
const accountView = document.querySelector("#account-view");
const signedInView = document.querySelector("#signed-in-view");
const signedInName = document.querySelector("#signed-in-name");
const tabs = [...document.querySelectorAll(".tab")];
let mode = "login";

function showMessage(text, isSuccess = false) {
  message.textContent = text;
  message.classList.toggle("success", isSuccess);
}

function setMode(nextMode) {
  mode = nextMode;
  tabs.forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelector("#page-title").textContent =
    mode === "login" ? "Welcome back" : "Create your account";
  submitButton.textContent = mode === "login" ? "Sign in" : "Create account";
  password.autocomplete = mode === "login" ? "current-password" : "new-password";
  passwordHint.hidden = mode === "login";
  showMessage("");
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function showSignedIn(user) {
  accountView.hidden = true;
  signedInView.hidden = false;
  document.querySelector(".tabs").hidden = true;
  document.querySelector("#page-title").textContent = "You’re all set";
  signedInName.textContent = user.username;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");
  submitButton.disabled = true;

  try {
    const data = await request(`/api/${mode}`, {
      method: "POST",
      body: JSON.stringify({
        username: form.elements.username.value,
        password: password.value
      })
    });
    showSignedIn(data.user);
  } catch (error) {
    showMessage(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

tabs.forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));

document.querySelector("#logout-button").addEventListener("click", async () => {
  const button = document.querySelector("#logout-button");
  button.disabled = true;
  try {
    await request("/api/logout", { method: "POST" });
    signedInView.hidden = true;
    accountView.hidden = false;
    document.querySelector(".tabs").hidden = false;
    form.reset();
    setMode("login");
    document.querySelector("#page-title").textContent = "Welcome back";
  } catch (error) {
    showMessage(error.message);
  } finally {
    button.disabled = false;
  }
});

request("/api/me")
  .then((data) => showSignedIn(data.user))
  .catch((error) => {
    if (error.message !== "Not signed in.") showMessage(error.message);
  });
