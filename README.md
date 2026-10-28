# phoenixtbird.com

GitHub Pages user site for phoenixtbird.com: Phoenix T. Bird's cartoons, AI workflow building, and Rolling Stone Home Inspections. Plain HTML, no build step. Project repos with Pages enabled (for example `gigflow`) are still served as folders under it.

| File | What it is |
|---|---|
| `index.html` | The password-locked page that gets published. Generated; don't edit it by hand |
| `src/index.html` | The readable page: cartoons, AI, inspections, about. Git-ignored, so it never reaches GitHub |
| `tools/lock.mjs` | Encrypts `src/index.html` into `index.html` |
| `404.html` | Not-found page |
| `assets/art/` | Sketchbook tiles, 800 px square, cut from ~/Cartooning/work/thumbs |
| `assets/share.jpg`, `assets/icon.svg` | Social share image and favicon |
| `CNAME` | Custom domain. Do not delete |

## Private preview lock

The published `index.html` holds only encrypted text (AES-256-GCM, key from the password with PBKDF2-SHA256, 600,000 rounds). Visitors type the password and the browser decrypts the page; the password is never stored in this repo. Images in `assets/` are not encrypted.

To change the page: edit `src/index.html`, run `node tools/lock.mjs` (it asks for the password twice), then commit and push `index.html`. A backup of the readable page lives outside this repo.

To make the site public again: copy `src/index.html` over `index.html` and push.

## Rules for this site

- No court advocacy and no court case material: no case names, numbers, counties, dates, parties, or judges.
- No "transgender man" label in the copy (Phoenix's call, Oct 23, 2026).
- AI copy describes work Phoenix directed and checked; no hype, invented numbers, or client data.
- No cartoons that show or name the author's children.
- Inspection copy promises nothing beyond the Washington Standards of Practice and never reads as a warranty or code inspection.

## Fixing the live site (error 525, Oct 23, 2026)

Cloudflare's DNS for phoenixtbird.com points at a server that isn't GitHub. In Cloudflare → phoenixtbird.com → DNS:
1. Set four `A` records for `phoenixtbird.com` to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (delete other A/AAAA records for the root).
2. Set `CNAME` `www` → `justhurkledurkling-max.github.io`.
3. Set all of them to **DNS only** (grey cloud) for now.
4. In GitHub → this repo → Settings → Pages, wait for the certificate, then tick **Enforce HTTPS**.
5. Optional, afterwards: turn the orange cloud back on with SSL/TLS mode **Full (strict)**.
