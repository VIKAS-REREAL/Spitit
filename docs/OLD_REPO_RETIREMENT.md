# Instructions: Retiring Legacy Repository (`REREAL-Spitit`)

This document provides the exact steps and replacement copy to properly archive the legacy Python repository ([https://github.com/VIKAS-REREAL/REREAL-Spitit](https://github.com/VIKAS-REREAL/REREAL-Spitit)).

---

## Step 1: Update `README.md` in `REREAL-Spitit`

Replace the existing `README.md` in the `REREAL-Spitit` repository with the following text:

```markdown
# [DEPRECATED] REREAL Spitit v2 (Python)

> [!WARNING]
> **This repository is archived and no longer maintained.**  
> Spitit has been completely rewritten for Windows from scratch as **Spitit v3** using **Tauri 2, Rust, and React 19** with sub-35 MB idle RAM and instant Win32 performance.
>
> 🚀 **Official New Repository:** [https://github.com/VIKAS-REREAL/Spitit](https://github.com/VIKAS-REREAL/Spitit)  
> 🌐 **Official Website & Downloads:** [https://spitit.in](https://spitit.in)

---

## About This Historical Archive

This repository contains the legacy Python and CustomTkinter implementation (Spitit v1–v2). It is preserved strictly as a read-only historical archive for reference.

### License & Terms Notice
- The code in this repository is licensed under the permissive **MIT License**.
- Previous claims in earlier revisions suggesting that commercial use requires a separate license were in error and are retracted; under the MIT License, anyone may use the software freely for personal or commercial purposes.
- Audio transcription in this legacy version routes through external API endpoints (Groq Cloud) using your personal API key; it is not an offline/no-cloud product.

### Upgrade to Spitit v3
We strongly encourage all users and contributors to transition to the new native release:
- 🦀 **Rust Core & Tauri 2:** Lower memory, zero temporary files, native Win32 keyboard hooks.
- ⚡ **Ultra-Low Latency:** Push-to-talk with live waveform status pill.
- 🔒 **Windows Credential Manager:** Secure credential vault integration.

Visit the active project at **[github.com/VIKAS-REREAL/Spitit](https://github.com/VIKAS-REREAL/Spitit)**.
```

---

## Step 2: Audit Legacy Repo Files for Personal Details Before Archival

Before archiving, verify the following files in `REREAL-Spitit`:
1. `build-msix.ps1`: Check for any hardcoded publisher certificate paths (`.pfx`), passwords, or Store publisher IDs. If present, delete or sanitize them.
2. `test_launch.py` and `test_pill.py`: Verify that no local hardcoded drive paths (e.g. `D:\...`) or personal test audio files remain.
3. Git Commit Author Emails: Note whether personal emails were committed (see report on GitHub's "Keep my email private" setting).

---

## Step 3: Repository Settings & Archival (One-Click)

Once the README is committed to `main` on `REREAL-Spitit`:
1. Navigate to: `https://github.com/VIKAS-REREAL/REREAL-Spitit/settings`
2. Under **General** -> **Repository name / Description**:
   - Description: `[Archived] Legacy Python implementation of Spitit. Superseded by v3 in VIKAS-REREAL/Spitit`
   - Website URL: `https://spitit.in`
   - Topics: `archived`, `python`, `whisper`, `dictation`, `legacy`
3. Scroll down to the **Danger Zone** at the bottom of the Settings page.
4. Click **Archive this repository**.
5. Confirm by typing `VIKAS-REREAL/REREAL-Spitit`.

*(Note: Once archived, the repository becomes read-only and no further changes or commits can be pushed.)*
