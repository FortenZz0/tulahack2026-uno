const workspace = document.getElementById("planet-workspace");
const toggle = document.getElementById("planet-panel-toggle");
const details = document.getElementById("planet-details");

if (workspace && toggle && details) {
    function setExpanded(expanded) {
        // Возвращаем фокус до скрытия содержимого (в том числе по Escape).
        if (!expanded && details.contains(document.activeElement)) toggle.focus();
        workspace.classList.toggle("details-expanded", expanded);
        toggle.setAttribute("aria-expanded", String(expanded));
        toggle.querySelector("span").textContent = expanded ? "Свернуть подробности" : "Подробнее о планете";
        details.hidden = !expanded;
        if (!expanded) details.closest('.scrollbox').scrollTop = 0;
    }

    toggle.addEventListener("click", () => {
        setExpanded(toggle.getAttribute("aria-expanded") !== "true");
    });

    document.getElementById('vizual-sun-name')?.addEventListener('click', event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const starTitle = document.getElementById('star-title');
        const scroll = document.getElementById('planet-panel-scroll');
        if (!starTitle || !scroll) return;
        event.preventDefault();
        setExpanded(true);
        starTitle.focus({ preventScroll: true });
        scroll.scrollTo({
            top: scroll.scrollTop + starTitle.closest('section').getBoundingClientRect().top - scroll.getBoundingClientRect().top,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        });
    });

    workspace.addEventListener("keydown", event => {
        if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
            setExpanded(false);
        }
    });
}
