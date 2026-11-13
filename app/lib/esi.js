// функции работают только с числами.
// перед вызовом, проверить аргументы на тип и null


function calculateESIcomponent(
    value, 
    earthValue, 
    weight
) {
    return (
        1 - Math.abs(value - earthValue) / (value + earthValue)
    ) ** weight;
}


function calculateESI(
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


function caluculateSimpleESI(
    radius,
    eqt
) {
    const r = calculateESIcomponent(radius, 1, 0.57);
    const t = calculateESIcomponent(eqt, 288, 5.58);

    return Math.sqrt(r * t);
}


export {
    calculateESIcomponent,
    calculateESI,
    caluculateSimpleESI
};