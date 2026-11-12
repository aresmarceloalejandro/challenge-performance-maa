# Parte 1 — Qué pruebas de performance conviene hacer

## El dato de negocio

El comercio cierra unas **1500 ventas por día**. En una fecha especial (Black Friday, Navidad u otra campaña) ese número se **multiplica por cinco**: 7500 ventas en el día.

Eso no es 1500 requests por segundo. Una venta es el final de un recorrido: home, búsqueda, ficha, carrito, checkout y pago. El número que hay que probar es el de ese recorrido en la hora pico, no el promedio del día repartido en 24 horas.

## Supuestos para pasar de ventas a carga

No hay analytics en la consigna, así que dejo explícito con qué cuentas trabajo. Si el negocio tiene el dato real, se reemplaza el supuesto y se recalcula. No se cambia el tipo de prueba.

| Supuesto | Valor que uso | Para qué sirve |
| --- | --- | --- |
| Horas con tráfico útil | 16 h, no 24 h planas | El promedio de madrugada esconde el mediodía. |
| Pico de un día normal | 20 % de las ventas del día en una hora | Define la carga de todos los días. |
| Apertura de una fecha especial | 25 % de las ventas del día en la primera hora | Black Friday no arranca parejo: arranca de golpe. |
| Requests de negocio por venta | 100, sin estáticos de CDN | Traduce ventas a tráfico que pega en la aplicación. |

Con eso:

| Momento | Ventas | Ritmo de ventas | Requests de aplicación |
| --- | --- | --- | --- |
| Promedio de un día normal | 1500 / 16 h | ~1,6 por minuto | Bajo, no es el escenario a diseñar. |
| Pico de un día normal | 300 en una hora | ~0,08 por segundo | ~8 requests/segundo. |
| Día especial, promedio | 7500 / 16 h | ~7,8 por minuto | Sigue sin ser el peor momento. |
| Apertura de la campaña | 1875 en la primera hora | ~0,5 por segundo | ~50 requests/segundo. |

El checkout en sí es una fracción de eso: del orden de **media venta por segundo** en la peor hora que estoy estimando. Cincuenta escrituras por segundo sobre un solo endpoint quedarían muy por encima de esta estimación. Sirven para conocer el margen, no para representar un día normal ni una campaña.

## Qué probaría, y en este orden

1. **Carga del día normal (load test).** El pico horario de una jornada común, con el recorrido completo y el mix de búsqueda, ficha, carrito y pago. Ahí se fija el tiempo de respuesta y la tasa de error que el negocio acepta. Sin esta línea de base, el resultado de la campaña no se puede leer.

2. **Carga de la fecha especial.** El volumen x5 sostenido durante un tramo representativo, no el promedio diluido del día. Responde si la infraestructura prevista para la campaña aguanta mientras la gente compra, no solo en el instante de la apertura.

3. **Pico de apertura (spike test).** El salto desde el tráfico de un día normal hasta la primera hora de campaña, en minutos. Es la prueba más oportuna de las tres: estas fechas fallan al abrirse, cuando el cache está frío, el pool de conexiones se llena y el medio de pago no acompaña. Un load test largo no muestra ese golpe.

4. **Resistencia del día de campaña (soak).** La carga de la fecha especial durante varias horas. Busca lo que una prueba de un minuto no ve: memoria que crece, conexiones que no vuelven, colas, tokens que vencen, degradación lenta del checkout.

5. **Escalabilidad.** El mismo pico x5 con la cantidad de nodos que producción va a tener ese día. El negocio ya sabe que la demanda se multiplica por cinco. La pregunta de arquitectura es si sumar instancias alcanza, o si hay un cuello (base, stock, pago) que no escala con la aplicación.

6. **Margen (stress), al final.** Subir por encima del pico de campaña (por ejemplo x7 y x10 respecto del día normal) hasta ver el quiebre. No es la primera prueba. Sirve para saber cuánto aire queda si la campaña sale mejor de lo previsto, y para no enterarse del límite el mismo Black Friday.

En todas, el foco es el camino que cobra: stock, precio, carrito, checkout y el proveedor de pago. Mediría aparte el home si hace falta, pero no lo usaría como representante de la venta.

## Qué no haría primero

- Un stress sin techo, desconectado del x5 que el negocio ya cuantificó.
- Una sola prueba de endurance de 24 horas al promedio del día. Pasa, y esconde la hora que importa.
- Tomar 1500 ventas como 1500 usuarios concurrentes o como 1500 TPS. Son unidades distintas, y con ese atajo se dimensiona un sistema que este comercio no necesita, o se declara un éxito sobre una carga que no es la real.

## Qué decisión sale de cada resultado

| Si pasa | Decisión |
| --- | --- |
| El día normal cumple el tiempo de respuesta y casi no hay errores | Hay una línea de base. Se puede comparar la campaña contra eso. |
| La fecha especial se sostiene, pero la apertura se cae | El problema es el golpe, no el volumen del día. Se ensaya cache, colas, precalentado y el límite del medio de pago. |
| La apertura aguanta y a las horas el soak se degrada | No alcanza con escalar para el minuto uno. Hay un recurso que se agota. |
| Escalar instancias no mueve el pico | El cuello está fuera del frontend. No se resuelve con más réplicas. |
| El stress muestra poco margen sobre el x5 | La campaña del año que viene no tiene aire. Hay que actuar antes, no durante. |

Marcelo Alejandro Ares
