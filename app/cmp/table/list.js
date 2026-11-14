


function PlanetCard(index, planet_name, star_name, esi, phi) {
    let esi_class
    let phi_class

    if (esi >= 0.8) esi_class = "good"
    else if (esi >= 0.5) esi_class = "normal"
    else esi_class = "bad"

    if (phi >= 0.8) phi_class = "good"
    else if (phi >= 0.5) phi_class = "normal"
    else phi_class = "bad"

    return `
        <div class="planet-card d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center h-100">
                <div class="index d-flex justify-content-center align-items-center me-2">
                    <span class="fs-4">
                        ${index}
                    </span>
                </div>

                <div class="name">
                    <h5 class="mb-0">
                        ${planet_name}
                    </h5>
                    <span class="">
                        <i class="fa-regular fa-star"></i> ${star_name}
                    </span>
                </div>
            </div>

            <div class="values h-100 d-flex align-items-center gap-3">
                <div class="esi d-flex flex-column align-items-center ${esi_class}">
                    <span class="val">
                        ${esi}
                    </span>
                    <span class="desc">
                        ESI
                    </span>
                </div>

                <div class="phi d-flex flex-column align-items-center ${phi_class}">
                    <span class="val">
                        ${phi}
                    </span>
                    <span class="desc">
                        PHI
                    </span>
                </div>
            </div>
        </div>
    `
}


var selected_planet;
$(document).ready(() => {
    selected_planet = document.querySelector(".planets-list .planet-card.selected")
})


$(".planets-list .planet-card").on("click", (e) => {
    if (e.currentTarget == selected_planet) return;

    $(".planets-list .planet-card").removeClass("selected")

    $(e.currentTarget).addClass("selected")
    selected_planet = $(e.currentTarget)
})