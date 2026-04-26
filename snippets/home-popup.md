# Home page image popup

Modal that opens automatically on page load, dims the background, and shows a single image with an accessible close button. Closes on backdrop click, on the X button, or on Escape. Tab is trapped to the close button so focus can't escape the modal.

To reuse: drop the HTML into the page (after any nav scripts), append the CSS to `components.css`, and inline the script after the markup. Replace the `picture`/`img` sources and the visually-hidden `<h2>`/`<p>` text with the new announcement.

## HTML

```html
<div
  class="home-popup"
  id="home-popup"
  role="dialog"
  aria-modal="true"
  aria-labelledby="home-popup-title"
  aria-describedby="home-popup-message"
  hidden
>
  <div class="home-popup-backdrop" data-popup-close></div>
  <div class="home-popup-content">
    <button type="button" class="home-popup-close" aria-label="Close" data-popup-close>
      <svg
        class="home-popup-close__icon"
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
      >
        <path
          d="M6 6 L18 18 M18 6 L6 18"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
        />
      </svg>
    </button>
    <h2 id="home-popup-title" class="u-visually-hidden">Scheduling announcement</h2>
    <p id="home-popup-message" class="u-visually-hidden">
      I will be out for the second half of May. Last day for appointments for May is the 18th.
      My books are filling up, so book soon if you want to get in before June.
    </p>
    <picture
      ><source
        type="image/webp"
        srcset="assets/images/home/popup-400.webp 400w, assets/images/home/popup-800.webp 800w"
        sizes="100vw" /><img
        src="assets/images/home/popup.png"
        alt=""
        class="home-popup-image"
    /></picture>
  </div>
</div>
<script>
  (function () {
    var popup = document.getElementById("home-popup");
    if (!popup) return;
    var closeBtn = popup.querySelector(".home-popup-close");
    var previouslyFocused = document.activeElement;
    function close() {
      popup.hidden = true;
      document.removeEventListener("keydown", onKey);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    }
    function onKey(e) {
      if (e.key === "Escape") {
        close();
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (closeBtn) closeBtn.focus();
      }
    }
    popup.addEventListener("click", function (e) {
      if (e.target.closest("[data-popup-close]")) close();
    });
    document.addEventListener("keydown", onKey);
    popup.hidden = false;
    if (closeBtn) closeBtn.focus();
  })();
</script>
```

## CSS

```css
.home-popup {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.home-popup[hidden] {
  display: none;
}

.home-popup-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
}

.home-popup-content {
  position: relative;
  max-width: min(90vw, 720px);
  max-height: 90vh;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.home-popup-image {
  display: block;
  width: 100%;
  height: auto;
  max-height: 90vh;
  object-fit: contain;
}

.home-popup-close {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: #222;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.home-popup-close__icon {
  display: block;
  width: 16px;
  height: 16px;
}

.home-popup-close:hover,
.home-popup-close:focus-visible {
  background: #fff;
  outline: none;
}

@media (max-width: 767px) {
  .home-popup {
    padding: 12px;
  }
}
```
