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

}


function caluculateSimpleESI(
    radius,
    eqt
) {

}