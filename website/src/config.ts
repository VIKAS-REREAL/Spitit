export const APP_CONFIG = {
  name: "Spitit",
  tagline: "Speak. Release. Done.",
  subtitle: "Ultra-fast, private voice dictation for Windows 10 & 11. Bring your own Groq key. Zero telemetry, zero accounts, sub-35 MB idle RAM.",
  version: "3.0.0",
  releaseDate: "October 2026",
  license: "MIT",
  author: "Vikas Nath (REREAL)",
  domain: "https://spitit.in",
  repoUrl: "https://github.com/VIKAS-REREAL/Spitit",
  releasesUrl: "https://github.com/VIKAS-REREAL/Spitit/releases",
  discussionsUrl: "https://github.com/VIKAS-REREAL/Spitit/discussions",
  securityUrl: "https://github.com/VIKAS-REREAL/Spitit/security/advisories",
  groqConsoleUrl: "https://console.groq.com/keys",
  downloads: {
    installer: {
      filename: "Spitit_3.0.0_x64-setup.exe",
      size: "3.1 MB",
      sha256: "e080bf5558519e5f141235f94750cbe056a3d01abe2cdc3728716bdf649b9343",
      url: "https://github.com/VIKAS-REREAL/Spitit/releases/download/v3.0.0/Spitit_3.0.0_x64-setup.exe"
    },
    portable: {
      filename: "Spitit_3.0.0_portable.exe",
      size: "7.8 MB",
      sha256: "b25a89b32b3c471435c0fc7c6f2d02f93032b59556793f24389e006c97e0909b",
      url: "https://github.com/VIKAS-REREAL/Spitit/releases/download/v3.0.0/Spitit_3.0.0_portable.exe"
    }
  },
  systemRequirements: {
    os: "Windows 10 (1809+) or Windows 11 (64-bit)",
    ram: "≤ 35 MB idle / ≤ 85 MB active",
    runtime: "Microsoft Edge WebView2 (Evergreen)",
    network: "Direct TLS connection to Groq API"
  }
};
