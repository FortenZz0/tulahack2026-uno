var label = $(".search-field")
var input = $("#search")
var placeholder = $(".search-field .placeholder")
var planets_scrollbox = $(".planets-cards")

input.on("focus", () => {
    label.addClass("focused")
})

input.on("focusout", () => {
    if (input.val()) return;
    label.removeClass("focused")
})


document.querySelectorAll(".planets-list .checkbox").forEach((selector) => {
    selector.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-option]");
        if (!button || !selector.contains(button)) return;

        const selectedOption = button.dataset.option;
        selector.dataset.active = selectedOption;

        selector.querySelectorAll("button[data-option]").forEach((option) => {
            option.setAttribute("aria-pressed", String(option === button));
        });
    });
});


