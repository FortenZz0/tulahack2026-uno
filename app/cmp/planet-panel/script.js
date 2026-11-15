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
    }

    toggle.addEventListener("click", () => {
        setExpanded(toggle.getAttribute("aria-expanded") !== "true");
    });
    workspace.addEventListener("keydown", event => {
        if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
            setExpanded(false);
        }
    });
}
