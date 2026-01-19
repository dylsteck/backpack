# Font Files for Cortex

This directory contains the custom fonts used for Cortex's refined editorial aesthetic.

## Required Font Files

Please download and place the following font files in this directory:

### 1. Fraunces (Display Font)
- **File**: `Fraunces-VariableFont_wght.woff2`
- **Source**: https://fonts.google.com/specimen/Fraunces
- **Download**: Click "Download family" → Extract → Copy the `.woff2` variable font file
- **Usage**: Headlines, card titles, date headers
- **License**: SIL Open Font License

### 2. Manrope (Body Font)
- **File**: `Manrope-VariableFont_wght.woff2`
- **Source**: https://fonts.google.com/specimen/Manrope
- **Download**: Click "Download family" → Extract → Copy the `.woff2` variable font file
- **Usage**: Body text, metadata, descriptions
- **License**: SIL Open Font License

### 3. JetBrains Mono (Monospace Font)
- **Files**:
  - `JetBrainsMono-Regular.woff2`
  - `JetBrainsMono-Bold.woff2`
- **Source**: https://fonts.google.com/specimen/JetBrains+Mono
- **Download**: Click "Download family" → Extract → Copy Regular and Bold `.woff2` files
- **Usage**: Code blocks, technical data, transaction amounts
- **License**: SIL Open Font License

## File Structure

After downloading, your directory should look like:

```
src/assets/fonts/
├── README.md (this file)
├── Fraunces-VariableFont_wght.woff2
├── Manrope-VariableFont_wght.woff2
├── JetBrainsMono-Regular.woff2
└── JetBrainsMono-Bold.woff2
```

## Notes

- All fonts use the `.woff2` format for best compression and browser support
- Variable fonts (Fraunces, Manrope) allow dynamic weight adjustment without multiple files
- Fonts are loaded with `font-display: swap` for progressive enhancement
- If fonts are missing, the app will fall back to system fonts

## Alternative: Google Fonts CDN

If you prefer not to download fonts locally, you can optionally load them from Google Fonts CDN by adding this to the `<head>` of your HTML:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100..900&family=JetBrains+Mono:wght@400;700&family=Manrope:wght@200..800&display=swap" rel="stylesheet">
```

However, local fonts provide better performance and offline capability.
