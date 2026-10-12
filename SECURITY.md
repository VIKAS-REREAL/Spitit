# Security Policy

The security and privacy of Spitit users is a primary commitment of this project. Because Spitit executes low-level keyboard hooks and interacts directly with system audio and credentials, we treat vulnerability reports with high priority.

---

## 1. Reporting a Vulnerability

Please **DO NOT** report security vulnerabilities through public GitHub issues or public discussions.

### Preferred Method: GitHub Private Vulnerability Reporting
Please submit a private vulnerability report directly through GitHub:
1. Navigate to the repository: [https://github.com/VIKAS-REREAL/Spitit](https://github.com/VIKAS-REREAL/Spitit)
2. Click on the **Security** tab.
3. Click **"Report a vulnerability"** to open a confidential advisory with the maintainer.

If GitHub Private Vulnerability Reporting is unavailable, you can open a confidential draft advisory or contact the maintainer through the GitHub platform.

---

## 2. In-Scope Areas

We actively welcome security reviews and responsible disclosures on:

- **Windows Credential Manager Integration (`keyring`)**: Any potential flaw that leaks, exposes, or improperly handles API keys in memory or on disk.
- **Low-Level Keyboard Hook (`WH_KEYBOARD_LL`)**: Any flaw allowing unintended keystroke interception, keylogging vulnerability, or injection vulnerabilities.
- **Audio Capture & Buffer Isolation**: Verification that temporary audio buffers are maintained strictly in memory and zero unencrypted WAV or PCM files are persisted to temporary directories.
- **Clipboard & Auto-Paste Synchronization**: Any race condition or injection issue during `SendInput` simulation.
- **Release Verification**: Release pipeline integrity, binary SHA256 checksums, and dependency supply chain vulnerabilities.

---

## 3. Out-of-Scope

- Attacks requiring physical access to an unlocked host machine.
- Vulnerabilities within external third-party services (e.g. Groq Cloud API itself), which should be reported to the respective provider.
- Social engineering attacks targeting end users.

---

## 4. Maintainer Response SLA

As an independent, solo-maintained open-source project:
- **Initial Acknowledgment:** Within **48 to 72 hours** of receiving a private advisory.
- **Triage & Assessment:** Within **7 days**, confirming reproducibility and severity rating.
- **Remediation & Patch:** Security fixes will be released in an expedited patch release (`v3.0.x`), accompanied by a coordinated public security advisory.
