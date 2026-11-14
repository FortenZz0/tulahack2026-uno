var label = $(".search-field")
var input = $("#search")
var placeholder = $(".search-field .placeholder")
var planets_scrollbox = $(".scrollbox")


$(document).ready(() => {
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


    const updateScrollPosition = (element) => {
        const maxScrollTop = element.scrollHeight - element.clientHeight;
        let scrollClass = "scroll-mid";

        if (element.scrollTop <= 0 || maxScrollTop <= 0) {
            scrollClass = "scroll-top";
        } else if (element.scrollTop >= maxScrollTop - 1) {
            scrollClass = "scroll-bot";
        }

        planets_scrollbox
            .removeClass("scroll-top scroll-mid scroll-bot")
            .addClass(scrollClass);
    };

    planets_scrollbox.on("scroll", (event) => {
        updateScrollPosition(event.currentTarget);
    });
    updateScrollPosition(planets_scrollbox[0]);
})


