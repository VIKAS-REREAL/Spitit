# Third-Party Notices & Licenses

Spitit incorporates and links to third-party open-source software, runtimes, and models. This document provides the required attributions, copyright notices, and license terms.

---

## 1. Summary of Dependencies

Spitit is written in Rust and TypeScript/React. The majority of dependencies are licensed under permissive open-source licenses:

- **MIT License**: Standard permissive license.
- **Apache License 2.0**: Permissive license with express patent grant.
- **BSD 2-Clause / BSD 3-Clause**: Permissive attribution licenses.
- **ISC / Zlib**: Permissive simplified licenses.
- **Mozilla Public License 2.0 (MPL-2.0)**: Weak, file-level copyleft license.
- **SIL Open Font License 1.1 (OFL)**: Open-source font license.

No component of Spitit utilizes code under the GNU General Public License (GPL) or Affero General Public License (AGPL).

---

## 2. Weak Copyleft Dependencies (MPL 2.0)

The following crates linked into Spitit are licensed under the **Mozilla Public License, Version 2.0 (MPL-2.0)**:

- `cssparser` (v0.37.0) — Mozilla Foundation
- `cssparser-macros` (v0.7.1) — Mozilla Foundation
- `dtoa-short` (v0.3.5) — Mozilla Foundation
- `option-ext` (v0.2.0) — Simon Sapin
- `selectors` (v0.38.0) — Mozilla Foundation
- `lightningcss-win32-x64-msvc` (npm build dependency) — Devon Govett

### Compliance Note
Section 3.3 of MPL-2.0 explicitly permits combining MPL-covered software with other files to create a "Larger Work" under terms of the developer's choice (in this case, the MIT License), provided that any modifications made directly to the original MPL source files remain available under MPL-2.0. **Spitit includes these crates without modification.**

The full text of the Mozilla Public License, Version 2.0 is available at:  
https://www.mozilla.org/en-US/MPL/2.0/

---

## 3. Microsoft Windows & WebView2 Runtime

Spitit relies on the **Microsoft Edge WebView2 Evergreen Runtime** on Windows 10 and Windows 11.

- The WebView2 Runtime is pre-installed as an operating system component on Windows 11 and modern Windows 10 installations, and updates automatically via Microsoft Update.
- The WebView2 Runtime is distributed and licensed by Microsoft Corporation under the **Microsoft Software License Terms**:  
  https://developer.microsoft.com/en-us/microsoft-edge/webview2/

Windows, Win32, and WebView2 are trademarks or registered trademarks of Microsoft Corporation in the United States and other countries.

---

## 4. Third-Party Services & Model Citations

### Groq Inc.
- Spitit uses **Groq Cloud API** inference for speech-to-text processing (`whisper-large-v3-turbo`) and Roman Hinglish transliteration (`llama-3.1-8b-instant`).
- Spitit is an independent open-source desktop client and is **NOT affiliated with, sponsored by, or endorsed by Groq Inc.**
- Requests are transmitted directly from the user's computer to Groq's API endpoints using the user's personal API credentials under Groq's Terms of Service and Acceptable Use Policy.
- "Groq" is a trademark of Groq, Inc.

### OpenAI
- "Whisper" refers to the open-source speech recognition model architecture created and released by OpenAI under the MIT License.
- Spitit is an independent application and is **NOT affiliated with, sponsored by, or endorsed by OpenAI.**
- "OpenAI" and "Whisper" are trademarks of OpenAI OpCo, LLC.

### Meta
- "Llama" refers to the open-weights language model developed by Meta Platforms, Inc. Spitit accesses the hosted Llama 3.1 model via Groq's API.
- "Meta" and "Llama" are trademarks of Meta Platforms, Inc.

---

## 5. Non-Code Assets Audit

- **Audio Sounds (`done.wav`, `start.wav`)**: 100% original algorithmically synthesized waveforms, created without third-party audio sampling or copyrighted audio libraries.
- **Icons & Brand Identity**: Original vector SVGs and PNG assets created exclusively for Spitit.
- **Web & Interface Typography**:
  - `Segoe UI Variable` / `Segoe UI`: Microsoft system fonts rendered via native Windows platform font stacks.
  - `Space Grotesk`: Created by Florian Karsten, licensed under the [SIL Open Font License 1.1](https://openfontlicense.org/).
  - `Inter`: Created by Rasmus Andersson, licensed under the [SIL Open Font License 1.1](https://openfontlicense.org/).

---

## 6. Rust Crates Attribution List

A selection of key Rust crates utilized in Spitit:

| Crate | Version | License | Copyright / Maintainer |
|---|---|---|---|
| `tauri` | 2.x | MIT OR Apache-2.0 | The Tauri Programme within The Commons Conservancy |
| `tauri-plugin-single-instance` | 2.x | MIT OR Apache-2.0 | The Tauri Programme |
| `windows` | 0.58 | MIT OR Apache-2.0 | Microsoft Corporation |
| `cpal` | 0.15 | Apache-2.0 | Pierre Krieger and cpal contributors |
| `hound` | 3.5 | Apache-2.0 | Ruud van Asseldonk |
| `keyring` | 3.x | MIT OR Apache-2.0 | Brocode and keyring contributors |
| `arboard` | 3.4 | MIT OR Apache-2.0 | arboard contributors |
| `rusqlite` | 0.32 | MIT | John Gallagher and rusqlite contributors |
| `reqwest` | 0.12 | MIT OR Apache-2.0 | Sean McArthur |
| `tokio` | 1.x | MIT | Tokio Contributors |
| `serde` / `serde_json` | 1.x | MIT OR Apache-2.0 | David Tolnay and serde contributors |
| `image` | 0.25 | MIT OR Apache-2.0 | The image-rs Developers |
| `r-efi` | 5.3 / 6.0 | MIT OR Apache-2.0 OR LGPL-2.1+ | David Rheinsberg |

---

## 7. Open Source License Texts

### The MIT License
```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Apache License, Version 2.0
```
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
