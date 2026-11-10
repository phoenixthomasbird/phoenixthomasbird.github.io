// Encrypt src/index.html into a password-locked index.html.
//
//   node tools/lock.mjs            asks for the password (typed twice, not shown)
//   node tools/lock.mjs --rewrap   rebuilds the lock screen around the existing
//                                  encrypted text in OUT (same password, no prompt);
//                                  use it after changing only the lock screen's look
//
// The published index.html holds only AES-256-GCM ciphertext; the browser
// derives the key from the password (PBKDF2-SHA256) and decrypts it locally.
// src/ is git-ignored, so the readable page never reaches the public repo.
// Images under assets/ are NOT encrypted.

import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes, pbkdf2Sync, createCipheriv } from "node:crypto";
import { createInterface } from "node:readline";

const ITERATIONS = 600000;
const SRC = process.env.LOCK_SRC || "src/index.html";
const OUT = process.env.LOCK_OUT || "index.html";

function ask(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(prompt)) rl.output.write(s); };
    rl.question(prompt, (answer) => { rl.output.write("\n"); rl.close(); resolve(answer); });
  });
}

async function getPassword() {
  if (process.env.LOCK_PASSWORD) return process.env.LOCK_PASSWORD; // tests only
  const a = await ask("Password for the site: ");
  const b = await ask("Type it again: ");
  if (a !== b) throw new Error("The two passwords don't match.");
  if (a.length < 12) throw new Error("Use at least 12 characters.");
  return a;
}

function encrypt(plaintext, password) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return { salt: salt.toString("base64"), iv: iv.toString("base64"), ct: body.toString("base64") };
}

// The lock card's words can be overridden per page (LOCK_TITLE, LOCK_KICKER, LOCK_HEADING, LOCK_NOTE, LOCK_PHOTO="" hides the photo).
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const T = {
  title: esc(process.env.LOCK_TITLE ?? "Phoenix T. Bird"),
  kicker: esc(process.env.LOCK_KICKER ?? "Private preview"),
  heading: esc(process.env.LOCK_HEADING ?? "Phoenix T. Bird"),
  note: esc(process.env.LOCK_NOTE ?? "This site is for people looking to hire Phoenix. The password is in Phoenix's resume or application."),
  photo: process.env.LOCK_PHOTO === "" ? "" : `<img src="/assets/lock-photo.webp" width="1000" height="750" alt="Phoenix in a backwards cap, leaning on a big Minion figure." />`,
};

function wrapper({ salt, iv, ct }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="color-scheme" content="dark" />
    <title>${T.title}</title>
    <link rel="icon" href="/assets/icon.svg" type="image/svg+xml" />
    <style>
      :root { --night: #0d1016; --steel: #222936; --bone: #ece8e1; --ash: #a9a49b; --gold: #d2ad62;
              --head: "Poppins", "Helvetica Neue", Arial, sans-serif; --text: "Inter", "Helvetica Neue", Arial, sans-serif; }
      * { box-sizing: border-box; }
      html { height: 100%; }
      body { margin: 0; min-height: 100%; background: var(--night); color: var(--bone); font: 400 1.0625rem/1.6 var(--text); display: grid; place-items: center; padding: 2rem 1rem; }
      .card { width: 100%; max-width: 26rem; border: 1px solid var(--steel); display: grid; }
      .card img { display: block; width: 100%; height: auto; border-bottom: 1px solid var(--steel); }
      form { padding: 2rem; }
      .k { font: 600 0.75rem/1 var(--head); letter-spacing: 0.26em; text-transform: uppercase; color: var(--gold); margin: 0 0 1rem; }
      h1 { font: 700 1.8rem/1.1 var(--head); margin: 0 0 0.8rem; }
      .note { color: var(--ash); font-size: 0.95rem; margin: 0 0 1.4rem; }
      .alt { color: var(--ash); font-size: 0.85rem; margin: 1.2rem 0 0; padding-top: 1rem; border-top: 1px solid var(--steel); }
      a { color: var(--gold); text-underline-offset: 0.2em; }
      a:hover { color: var(--bone); }
      label { display: block; color: var(--ash); font-size: 0.9rem; margin-bottom: 0.4rem; }
      input { width: 100%; font: inherit; color: var(--bone); background: #151a23; border: 1px solid var(--steel); padding: 0.7rem 0.8rem; }
      button { margin-top: 1rem; width: 100%; font: 600 0.85rem/1 var(--head); letter-spacing: 0.12em; text-transform: uppercase; color: var(--night); background: var(--gold); border: 0; padding: 0.9rem; cursor: pointer; }
      :focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
      .pw { position: relative; }
      .pw input { padding-right: 3rem; }
      .pw button { position: absolute; top: 0; right: 0; bottom: 0; width: 2.9rem; margin: 0; padding: 0; background: transparent; color: var(--ash); display: grid; place-items: center; }
      .pw button:hover { color: var(--gold); }
      .pw button svg { width: 1.25rem; height: 1.25rem; }
      .pw button .off, .pw button[aria-pressed="true"] .on { display: none; }
      .pw button[aria-pressed="true"] .off { display: block; }
      #msg { min-height: 1.4em; color: #e6a07a; font-size: 0.9rem; margin: 0.8rem 0 0; }
    </style>
  </head>
  <body>
    <main class="card">
    ${T.photo}
    <form id="f">
      <p class="k">${T.kicker}</p>
      <h1>${T.heading}</h1>
      <p class="note">${T.note}</p>
      <label for="pw">Password</label>
      <div class="pw">
        <input id="pw" type="password" autocomplete="current-password" required autofocus />
        <button type="button" id="eye" aria-controls="pw" aria-pressed="false" aria-label="Show password" title="Show password">
          <svg class="on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
          <svg class="off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1"/><path d="M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
        </button>
      </div>
      <button type="submit">Open</button>
      <p id="msg" role="status" aria-live="polite"></p>
      <p class="alt">Code and project write-ups are public on <a href="https://github.com/phoenixthomasbird">GitHub</a>.</p>
    </form>
    </main>
    <script>
      const SALT = "${salt}", IV = "${iv}", CT = "${ct}", ITER = ${ITERATIONS};
      const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
      async function keyFrom(pw) {
        const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
        return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(SALT), iterations: ITER, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
      }
      async function open(key) {
        const html = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(IV) }, key, b64(CT)));
        // Swap in the whole decrypted document; unlike document.write this is safe at any point in loading.
        const doc = new DOMParser().parseFromString(html, "text/html");
        document.replaceChild(document.adoptNode(doc.documentElement), document.documentElement);
        if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
      }
      // Remember the unlocked key for this tab only, so a reload doesn't ask again.
      (async () => {
        try {
          const saved = sessionStorage.getItem("pb-key");
          if (saved) await open(await crypto.subtle.importKey("raw", b64(saved), "AES-GCM", true, ["decrypt"]));
        } catch (e) { try { sessionStorage.removeItem("pb-key"); } catch (_) {} }
      })();
      document.getElementById("eye").addEventListener("click", (e) => {
        const b = e.currentTarget, pw = document.getElementById("pw"), show = pw.type === "password";
        pw.type = show ? "text" : "password";
        b.setAttribute("aria-pressed", String(show));
        b.setAttribute("aria-label", show ? "Hide password" : "Show password");
        b.title = show ? "Hide password" : "Show password";
        pw.focus();
      });
      document.getElementById("f").addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = document.getElementById("msg");
        msg.textContent = "Checking…";
        try {
          const key = await keyFrom(document.getElementById("pw").value);
          const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
          await open(key);
          try { sessionStorage.setItem("pb-key", btoa(String.fromCharCode(...raw))); } catch (_) {}
        } catch (err) {
          msg.textContent = "That password didn't work.";
        }
      });
    </script>
  </body>
</html>
`;
}

if (process.argv.includes("--rewrap")) {
  // Reuse the encrypted text already in OUT, so the password and page stay the same.
  const old = readFileSync(OUT, "utf8");
  const m = old.match(/const SALT = "([^"]+)", IV = "([^"]+)", CT = "([^"]+)", ITER = (\d+);/);
  if (!m) throw new Error(`No encrypted page found in ${OUT}.`);
  if (Number(m[4]) !== ITERATIONS) throw new Error(`${OUT} uses ${m[4]} rounds, not ${ITERATIONS}; re-lock it with the password instead.`);
  writeFileSync(OUT, wrapper({ salt: m[1], iv: m[2], ct: m[3] }));
  console.log(`Rewrapped ${OUT} (same password)`);
} else {
  const password = await getPassword();
  writeFileSync(OUT, wrapper(encrypt(readFileSync(SRC, "utf8"), password)));
  console.log(`Locked ${SRC} -> ${OUT}`);
}
