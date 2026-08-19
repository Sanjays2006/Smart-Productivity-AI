/**
 * content.js — Injected into every page
 * Extracts visible text and sends it to background.js for RAG ingestion.
 */
(function () {
    // Only run once per page load
    if (window.__focusTrackerInjected) return;
    window.__focusTrackerInjected = true;

    // Wait for page to settle before extracting text (avoids partial content)
    setTimeout(() => {
        try {
            const bodyText = extractReadableText();
            if (bodyText && bodyText.length > 100) {
                chrome.runtime.sendMessage({
                    type: 'PAGE_CONTENT',
                    url: window.location.href,
                    title: document.title,
                    bodyText
                });
            }
        } catch (e) {}
    }, 2000);

    function extractReadableText() {
        // Remove scripts, styles, nav, footer, ads
        const clone = document.body.cloneNode(true);
        ['script', 'style', 'nav', 'footer', 'header', 'noscript',
         'iframe', 'svg', 'img', 'button', 'input', 'select', 'form']
            .forEach(tag => clone.querySelectorAll(tag).forEach(el => el.remove()));

        // Get innerText, clean whitespace
        const text = (clone.innerText || clone.textContent || '')
            .replace(/\s+/g, ' ')
            .replace(/[^\x20-\x7E\n]/g, '') // keep printable ASCII only
            .trim();

        // Return max 8000 chars — enough for several RAG chunks
        return text.substring(0, 8000);
    }
})();
