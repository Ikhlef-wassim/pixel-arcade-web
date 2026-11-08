document.querySelectorAll("[data-copy]").forEach((btn) => {
  const original = btn.textContent;
  const value = btn.getAttribute("data-copy");

  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(value);
      btn.textContent = `Copied: ${value}`;
    } catch (err) {
      btn.textContent = `Copy failed. Username: ${value}`;
    }
    setTimeout(() => {
      btn.textContent = original;
    }, 2000);
  });
});
