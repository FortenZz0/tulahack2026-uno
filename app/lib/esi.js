// функции работают только с числами.
// перед вызовом, проверить аргументы на тип и null


export function calculateESIcomponent(
    value, 
    earthValue, 
    weight
) {
    return (
        1 - Math.abs(value - earthValue) / (value + earthValue)
    ) ** weight;
}


export function calculateESI(
    radius,
    density,
    vesc,
    eqt
) {
    const r = calculateESIcomponent(radius, 1, 0.57);
    const d = calculateESIcomponent(density, 5.51, 1.07);
    const v = calculateESIcomponent(vesc, 11.186, 0.70);
    const t = calculateESIcomponent(eqt, 288, 5.58);

    return (r * d * v * t) ** (1 / 4);
}

export function calculateSimpleESI(radius, flux) {
    if (
        !Number.isFinite(radius) ||
        !Number.isFinite(flux) ||
        radius <= 0 ||
        flux < 0
    ) {
        return null;
    }

    const dr = (radius - 1) / (radius + 1);
    const ds = (flux - 1) / (flux + 1);

    return 1 - Math.sqrt((dr ** 2 + ds ** 2) / 2);
}
