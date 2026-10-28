// Encrypt src/index.html into a password-locked index.html.
//
//   node tools/lock.mjs            asks for the password (typed twice, not shown)
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

function wrapper({ salt, iv, ct }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="color-scheme" content="dark" />
    <title>Phoenix T. Bird</title>
    <link rel="icon" href="/assets/icon.svg" type="image/svg+xml" />
    <style>
      :root { --night: #0d1016; --steel: #222936; --bone: #ece8e1; --ash: #a9a49b; --gold: #d2ad62;
              --head: "Poppins", "Helvetica Neue", Arial, sans-serif; --text: "Inter", "Helvetica Neue", Arial, sans-serif; }
      * { box-sizing: border-box; }
      html, body { height: 100%; }
      body { margin: 0; background: var(--night); color: var(--bone); font: 400 1.0625rem/1.6 var(--text); display: grid; place-items: center; padding: 2rem 1rem; }
      form { width: 100%; max-width: 26rem; border: 1px solid var(--steel); padding: 2rem; }
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
      #msg { min-height: 1.4em; color: #e6a07a; font-size: 0.9rem; margin: 0.8rem 0 0; }
    </style>
  </head>
  <body>
    <form id="f">
      <p class="k">Private preview</p>
      <h1>Phoenix T. Bird</h1>
      <p class="note">This site is for people looking to hire Phoenix. The password is in Phoenix's resume or application.</p>
      <label for="pw">Password</label>
      <input id="pw" type="password" autocomplete="current-password" required autofocus />
      <button type="submit">Open</button>
      <p id="msg" role="status" aria-live="polite"></p>
      <p class="alt">Code and project write-ups are public on <a href="https://github.com/phoenixthomasbird">GitHub</a>.</p>
    </form>
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

const password = await getPassword();
writeFileSync(OUT, wrapper(encrypt(readFileSync(SRC, "utf8"), password)));
console.log(`Locked ${SRC} -> ${OUT}`);
