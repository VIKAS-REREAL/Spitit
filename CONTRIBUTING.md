# Contributing to Spitit

Thank you for your interest in contributing to Spitit! Spitit is an open-source project dedicated to making voice dictation on Windows ultra-fast, lightweight, and private.

---

## 1. Project Philosophy & Non-Goals

Before submitting a feature request or Pull Request, please review our core architectural non-goals:

1. **No Cloud Accounts or Telemetry:** We will never add user accounts, cloud database sync, remote telemetry, or usage tracking.
2. **No AI Rewriting or Chat Clutter:** Spitit is an instant speech-to-text dictation client, not a conversational chatbot, document editor, or AI summarizer.
3. **No Heavy Background Runtimes:** The core idle footprint must remain strictly below 40 MB RAM. All OS hooks and system interactions must remain in native Rust.
4. **Bring Your Own Key (BYOK):** Audio processing relies on direct user-managed API keys without intermediary servers.

PRs introducing features outside these boundaries will be respectfully declined.

---

## 2. Development Setup

Spitit requires a 64-bit Windows environment (Windows 10 version 1809+ or Windows 11).

### Prerequisites
1. **Node.js**: v18.0 or newer (LTS recommended).
2. **Rust & Cargo**: Latest stable Rust toolchain via [rustup.rs](https://rustup.rs).
3. **C++ Build Tools**: Microsoft C++ Build Tools (MSVC) via Visual Studio Installer (workload: "Desktop development with C++").
4. **Microsoft Edge WebView2**: Pre-installed on Windows 11; install the Evergreen Runtime on older Windows 10 versions.

### Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/VIKAS-REREAL/Spitit.git
cd Spitit

# 2. Install frontend dependencies
npm install

# 3. Run frontend development server (UI & Pill preview in browser)
npm run dev

# 4. Run full desktop application in development mode
npm run tauri dev
```

---

## 3. Testing and Code Quality

Please run checks before submitting a PR:

### Frontend
```bash
# Typecheck TypeScript
npm run build
```

### Rust Core
```bash
cd src-tauri

# Run tests
cargo test

# Check linting
cargo clippy --all-targets -- -D warnings

# Format check
cargo fmt --check
```

---

## 4. Contributing Rights: Developer Certificate of Origin (DCO)

Spitit uses the **Developer Certificate of Origin (DCO)** rather than a restrictive Contributor License Agreement (CLA).

### What is the DCO?
The DCO is a lightweight confirmation that you wrote the code or have the right to submit it under the project's MIT License. You retain full copyright ownership of your contributions, licensed to the project under MIT.

To sign off on your commit, simply use the `-s` flag with git:
```bash
git commit -s -m "feat(hotkey): add support for custom function keys"
```
This appends a sign-off line:
```
Signed-off-by: Your Name <your.email@example.com>
```

---

## 5. Pull Request Checklist

Before submitting your PR, ensure:

- [ ] All code conforms to existing style guidelines (`cargo fmt`, TypeScript strict mode).
- [ ] No personal paths, local drive references, or secrets are included.
- [ ] Commits are signed with DCO (`git commit -s`).
- [ ] Documentation and comments are updated where relevant.
- [ ] No regression in idle memory footprint or hook latency.
- [ ] The PR does not introduce features listed in the Non-Goals.
