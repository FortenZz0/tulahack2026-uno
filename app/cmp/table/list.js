


function escapeName(value, fallback) {
    const text = typeof value === "string" && value.trim() ? value.trim() : fallback;
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return text.replace(/[&<>"']/g, character => entities[character]);
}

export function PlanetCard(index, planet_name, star_name, esi) {
    let selected_class = "";
    const hasEsi = Number.isFinite(esi) && esi >= 0 && esi <= 1;
    const esiText = hasEsi ? String(Math.round(esi * 100) / 100) : "—";

    let esi_class

    if (!hasEsi) esi_class = "unavailable"
    else if (esi >= 0.8) esi_class = "good"
    else if (esi >= 0.5) esi_class = "normal"
    else esi_class = "bad"


    return `
        <div class="planet-card d-flex align-items-center justify-content-between${selected_class}">
            <div class="d-flex align-items-center h-100">
                <div class="index d-flex justify-content-center align-items-center me-3">
                    <span class="fs-4">
                        ${index}
                    </span>
                </div>

                <div class="name">
                    <h5 class="mb-0">
                        ${escapeName(planet_name, "Нет названия")}
                    </h5>
                    <span class="">
                        <i class="fa-regular fa-star"></i> ${escapeName(star_name, "Звезда неизвестна")}
                    </span>
                </div>
            </div>

            <div class="values h-100 d-flex align-items-center gap-3">
                <div class="esi d-flex flex-column align-items-center ${esi_class}">
                    <span class="val"${hasEsi ? "" : ' aria-label="Нет данных ESI"'}>
                        ${esiText}
                    </span>
                    <span class="desc">
                        ESI
                    </span>
                </div>
            </div>
        </div>
    `
}



var selected_planet;
var planets_limit = 10
var planets;

export async function GetPlanets(library) {
    // $(".planets-cards").append(PlanetCard(0, "test", "test", 1))

    try {
        await library.init();
        
        planets = library.getPlanets({
            sort: {
                by: "esi.simple",
                order: "desc",
            },
            offset: 0,
            limit: planets_limit,
        });

        console.log("Каталог загружен:", planets);
        
        for (let i = 0; i < planets.length; i++) {
            const pl = planets[i];
            
            const star = library.getPlanetStar(pl);
            const esi = pl.esi?.simple;

            $(".planets-cards").append(PlanetCard(i+1, pl.name, star?.name, esi))
        }


        
        selected_planet = document.querySelector(".planets-cards .planet-card.selected")


        $(".planets-cards .planet-card").on("click", (e) => {
            if (selected_planet && e.currentTarget == selected_planet) return;

            $(".planets-cards .planet-card").removeClass("selected")

            $(e.currentTarget).addClass("selected")
            selected_planet = $(e.currentTarget)
        })



    } catch (error) {
        // что-то с NASA API или же истратили лимиты (~50 в час с одного IP)
        console.error("Ошибка загрузки:", error);
    }
}
