


function escapeName(value, fallback) {
    const text = typeof value === "string" && value.trim() ? value.trim() : fallback;
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return text.replace(/[&<>"']/g, character => entities[character]);
}

export function PlanetCard(index, planet_name, star_name, esi, id = String(index)) {
    let selected_class = "";
    const hasEsi = Number.isFinite(esi) && esi >= 0 && esi <= 1;
    const esiText = hasEsi ? esi.toFixed(2).replace(".", ",") : "—";

    let esi_class

    if (!hasEsi) esi_class = "unavailable"
    else if (esi >= 0.8) esi_class = "good"
    else if (esi >= 0.5) esi_class = "normal"
    else esi_class = "bad"


    return `
        <div class="planet-card d-flex align-items-center justify-content-between${selected_class}" data-planet-id="${escapeName(id, String(index))}">
            <button type="button" class="planet-select d-flex align-items-center h-100" aria-pressed="false" aria-label="Выбрать ${escapeName(planet_name, "планету")}">
                <span class="index esi ${esi_class} d-flex flex-column justify-content-center align-items-center me-3">
                    <span class="val"${hasEsi ? "" : ' aria-label="Нет данных ESI"'}>${esiText}</span>
                    <span class="desc">ESI</span>
                </span>
                <span class="name">
                    <span class="planet-name">${escapeName(planet_name, "Нет названия")}</span>
                    <span class="star-name"><i class="fa-regular fa-star"></i> ${escapeName(star_name, "Звезда неизвестна")}</span>
                </span>
            </button>
        </div>
    `
}



var planets_limit = 50
var planets;

export async function GetPlanets(library, { onSelect = () => {}, onReady = () => {} } = {}) {
    // $(".planets-cards").append(PlanetCard(0, "test", "test", 1))

    try {
        await library.init();
        
        planets = library.getTopPlanets().slice(0, planets_limit);

        console.log("Каталог загружен:", planets);
        $(".planets-cards").empty().removeClass("loader");
        
        for (let i = 0; i < planets.length; i++) {
            const pl = planets[i];
            
            const star = library.getPlanetStar(pl);
            const esi = pl.esi?.simple;

            $(".planets-cards").append(PlanetCard(i+1, pl.name, star?.name, esi, pl.id))
        }


        
        const cards = $(".planets-cards");
        const resolvePlanet = target => {
            const id = target.closest(".planet-card").dataset.planetId;
            return planets.find(planet => planet.id === id) ?? library.getPlanet(id);
        };
        cards.off(".planetList");
        cards.on("click.planetList", ".planet-select", event => {
            const planet = resolvePlanet(event.currentTarget);
            if (planet) onSelect(planet);
        });
        onReady(planets);



    } catch (error) {
        // что-то с NASA API или же истратили лимиты (~50 в час с одного IP)
        console.error("Ошибка загрузки:", error);
    }
}
