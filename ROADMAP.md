# better-markdown-to-pdf Roadmap

md-to-pdf uyumluluğu için eksik özelliklerin implementasyon planı.

## Mevcut Avantajlar (md-to-pdf'de yok)

- [x] LaTeX/KaTeX matematik desteği
- [x] Mermaid diyagram desteği
- [x] Modern Playwright (Puppeteer yerine)
- [x] Web UI arayüzü
- [x] Task list checkbox desteği

---

## Yüksek Öncelikli

### 1. Watch Modu (`--watch`, `-w`) ✅
- [x] Chokidar ile dosya izleme
- [x] Değişiklikte otomatik PDF yenileme
- [x] Çoklu dosya izleme
- [x] Graceful shutdown (SIGINT/SIGTERM)

**Kullanım:**
```bash
md-to-pdf readme.md --watch
md-to-pdf *.md --watch
```

---

## Orta Öncelikli

### 2. HTML Çıktısı (`--as-html`) ✅
- [x] PDF yerine HTML döndürme
- [x] Standalone HTML dosyası oluşturma
- [x] API'de `as_html` option

**Kullanım:**
```bash
md-to-pdf readme.md --as-html
md-to-pdf readme.md output.html
```

### 3. Stdin/Stdout Desteği ✅
- [x] Stdin'den markdown okuma (`-` argümanı)
- [x] Stdout'a PDF/HTML yazma
- [x] Pipe desteği

**Kullanım:**
```bash
cat readme.md | md-to-pdf - > output.pdf
echo "# Hello" | md-to-pdf -
```

### 4. Syntax Highlighting Temaları (`highlight_style`) ✅
- [x] Embedded tema CSS'leri (harici dosya gerektirmez)
- [x] Frontmatter'da `highlight_style` desteği
- [x] CLI'da `--highlight-style` flag

**Temalar:** github, monokai, vs2015, atom-one-dark, atom-one-light, dracula

**Kullanım:**
```bash
md-to-pdf readme.md --highlight-style monokai
```

```yaml
---
highlight_style: dracula
---
```

### 5. Çoklu Dosya İşleme ✅
- [x] Glob pattern desteği (`*.md`)
- [x] Batch output
- [x] İlerleme ve özet bilgisi

**Kullanım:**
```bash
md-to-pdf docs/*.md
md-to-pdf chapter1.md chapter2.md chapter3.md
```

---

## Düşük Öncelikli

### 6. Config Dosyası (`--config-file`) ✅
- [x] JSON config dosyası desteği
- [x] `.md-to-pdf.json` otomatik algılama
- [x] CLI options config dosyasını override eder

**Kullanım:**
```bash
md-to-pdf readme.md --config-file ./config.json
```

```json
{
  "stylesheet": ["./custom.css"],
  "pdf_options": {
    "format": "A4",
    "margin": { "top": "2cm" }
  }
}
```

### 7. Page Media Type (`page_media_type`) ✅
- [x] `screen` vs `print` emülasyonu
- [x] CSS @media query desteği

**Kullanım:**
```bash
md-to-pdf readme.md --page-media-type print
```

### 8. Marked Options (`markdown_options`) ✅
- [x] markdown-it parser ayarları (html, linkify, typographer, breaks)
- [x] CLI'da `--markdown-options` JSON flag
- [x] Frontmatter desteği

**Kullanım:**
```bash
md-to-pdf readme.md --markdown-options '{"html": true, "breaks": true}'
```

```yaml
---
markdown_options:
  html: true
  breaks: true
  linkify: true
  typographer: true
---
```

### 9. Launch Options (`launch_options`) ✅
- [x] Playwright browser ayarları
- [x] Proxy desteği
- [x] Custom executable path
- [x] Headless modu kontrolü

**Kullanım:**
```bash
md-to-pdf readme.md --launch-options '{"headless": true}'
md-to-pdf readme.md --launch-options '{"executablePath": "/path/to/chrome"}'
```

### 10. DevTools Modu (`--devtools`) ✅
- [x] Browser'ı görünür aç
- [x] DevTools'u aktif et
- [x] Debug için kullanışlı

**Kullanım:**
```bash
md-to-pdf readme.md --devtools
```

### 11. Script Injection (`script`) ✅
- [x] Custom JS dosyaları ekleme
- [x] Inline script desteği
- [x] External script URL desteği
- [x] CLI'da `--script` flag

**Kullanım:**
```bash
md-to-pdf readme.md --script ./custom.js
md-to-pdf readme.md --script https://example.com/lib.js
```

```yaml
---
script:
  - path: ./custom.js
  - url: https://example.com/lib.js
  - content: "console.log('Hello!');"
---
```

### 12. File Encoding Options ✅
- [x] `--md-file-encoding` flag
- [x] `--stylesheet-encoding` flag
- [x] UTF-8 dışı encoding desteği
- [x] API'de `md_file_encoding` ve `stylesheet_encoding` seçenekleri

**Kullanım:**
```bash
md-to-pdf readme.md --md-file-encoding utf-16
md-to-pdf readme.md --stylesheet-encoding latin1
```

---

## İlerleme Durumu

| Özellik | Durum | PR |
|---------|-------|-----|
| Watch modu | ✅ Tamamlandı | - |
| HTML çıktısı | ✅ Tamamlandı | - |
| Stdin/stdout | ✅ Tamamlandı | - |
| Highlight temaları | ✅ Tamamlandı | - |
| Çoklu dosya | ✅ Tamamlandı | - |
| Config dosyası | ✅ Tamamlandı | - |
| Page media type | ✅ Tamamlandı | - |
| Marked options | ✅ Tamamlandı | - |
| Launch options | ✅ Tamamlandı | - |
| DevTools modu | ✅ Tamamlandı | - |
| Script injection | ✅ Tamamlandı | - |
| File encoding | ✅ Tamamlandı | - |

---

## Notlar

- Öncelik sırası: Yüksek → Orta → Düşük
- Her özellik için test yazılacak
- API ve CLI birlikte güncellenecek
- Geriye dönük uyumluluk korunacak
