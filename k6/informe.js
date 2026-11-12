function buscar(metrics, base, scenario) {
  const exact = `${base}{scenario:${scenario}}`;
  if (metrics[exact]) return metrics[exact];
  const key = Object.keys(metrics).find((name) => name.startsWith(`${base}{`) && name.includes(`scenario:${scenario}`));
  return key ? metrics[key] : undefined;
}

function numero(metric, key) {
  if (!metric || !metric.values || metric.values[key] == null) return null;
  return metric.values[key];
}

function porcentaje(rate) {
  if (rate == null) return 'sin dato';
  return `${(rate * 100).toFixed(1).replace('.', ',')} %`;
}

function miles(value) {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function tiempo(ms) {
  if (ms == null) return 'sin dato';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2).replace('.', ',')} s`;
}

function entero(value) {
  if (value == null) return 'sin dato';
  return miles(value);
}

function escenario(data, nombre, etiqueta, esperados) {
  const requests = buscar(data.metrics, 'http_reqs', nombre);
  const failed = buscar(data.metrics, 'http_req_failed', nombre);
  const duration = buscar(data.metrics, 'http_req_duration', nombre);
  const dropped = buscar(data.metrics, 'dropped_iterations', nombre);

  // En http_req_failed, "passes" cuenta los pedidos rechazados y "fails" los que sí se crearon.
  const rechazados = numero(failed, 'passes');
  const creados = numero(failed, 'fails');
  const enviadosPorEstado = rechazados != null && creados != null ? rechazados + creados : null;
  const enviados = numero(requests, 'count') != null ? numero(requests, 'count') : enviadosPorEstado;
  const errorRate = numero(failed, 'rate');
  const p95 = numero(duration, 'p(95)');
  const caidos = numero(dropped, 'count') || 0;

  return {
    etiqueta,
    esperados,
    enviados,
    ritmo: enviados == null ? null : enviados / 60,
    creados,
    rechazados,
    errorRate,
    mediana: numero(duration, 'med'),
    p95,
    max: numero(duration, 'max'),
    caidos,
    veredicto: veredicto(errorRate, p95, caidos, enviados, esperados),
  };
}

function veredicto(errorRate, p95, caidos, enviados, esperados) {
  const incompleto = enviados != null && enviados < esperados * 0.9;
  if (errorRate == null) {
    return { tono: 'alerta', texto: 'No llegaron datos suficientes de esta tanda.' };
  }
  if (errorRate > 0.2 || incompleto) {
    const deCadaCien = Math.round((errorRate || 0) * 100);
    return {
      tono: 'mal',
      texto: `El servicio rechazó ${deCadaCien} de cada 100 pedidos. Los que aceptó respondieron enseguida.`,
    };
  }
  if (errorRate > 0.01 || caidos > 0) {
    return {
      tono: 'alerta',
      texto: 'Respondió, pero aparecieron fallos o pedidos que no se llegaron a enviar. No es una velocidad segura.',
    };
  }
  if (p95 != null && p95 > 2000) {
    return {
      tono: 'alerta',
      texto: 'Casi no hubo errores, aunque algunas respuestas tardaron más de 2 segundos.',
    };
  }
  return { tono: 'bien', texto: 'Creó los productos y respondió en un tiempo razonable.' };
}

function tarjeta(item) {
  return `
    <article class="tarjeta ${item.veredicto.tono}">
      <p class="etiqueta">${item.etiqueta}</p>
      <p class="frase">${item.veredicto.texto}</p>
      <dl>
        <div><dt>Pedidos enviados</dt><dd>${entero(item.enviados)}</dd></div>
        <div><dt>Productos creados</dt><dd>${entero(item.creados)}</dd></div>
        <div><dt>Pedidos rechazados</dt><dd>${entero(item.rechazados)} (${porcentaje(item.errorRate)})</dd></div>
        <div><dt>Ritmo de envío</dt><dd>${item.ritmo == null ? 'sin dato' : `${item.ritmo.toFixed(0)} por segundo`}</dd></div>
        <div><dt>Tiempo habitual</dt><dd>${tiempo(item.mediana)}</dd></div>
        <div><dt>95 de cada 100 tardaron menos de</dt><dd>${tiempo(item.p95)}</dd></div>
        <div><dt>La respuesta más lenta</dt><dd>${tiempo(item.max)}</dd></div>
        <div><dt>Pedidos que no se llegaron a enviar</dt><dd>${entero(item.caidos)}</dd></div>
      </dl>
    </article>`;
}

function apertura(cincuenta, cien) {
  if (cincuenta.creados == null || cien.creados == null) {
    return 'La corrida terminó, pero no alcanzaron los números para decir cuántos productos se crearon.';
  }
  if (cincuenta.veredicto.tono === 'bien' && cien.veredicto.tono === 'bien') {
    return 'El servicio creó los productos a las dos velocidades pedidas y respondió en un tiempo corto.';
  }
  return `El servicio no aceptó la velocidad pedida. A 50 por segundo se crearon ${entero(cincuenta.creados)} productos; a 100 por segundo, ${entero(cien.creados)}. Pedir el doble no creó más.`;
}

function cierre(cincuenta, cien) {
  if (cincuenta.creados == null || cien.creados == null) {
    return apertura(cincuenta, cien);
  }
  return `De ${entero(cincuenta.enviados)} pedidos a 50 por segundo, se crearon ${entero(cincuenta.creados)}. De ${entero(cien.enviados)} pedidos a 100 por segundo, se crearon ${entero(cien.creados)}. Los que sí se crearon tardaron alrededor de ${tiempo(cincuenta.mediana)}: el límite apareció en los rechazos, no en la espera. Para un comercio de unas 1500 ventas por día, 50 altas por segundo ya son una prueba de margen, no la carga de un día real.`;
}

export function construirInforme(data) {
  const cincuenta = escenario(data, 'cincuenta_tps', '50 creaciones por segundo', 3000);
  const cien = escenario(data, 'cien_tps', '100 creaciones por segundo', 6000);
  const ahora = new Date();
  const cuando = `${ahora.getDate()}/${ahora.getMonth() + 1}/${ahora.getFullYear()} ${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Informe de la prueba de creación de productos</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f3efe6;
      color: #1c1917;
      font: 18px/1.5 "Avenir Next", "Segoe UI", sans-serif;
    }
    main { max-width: 880px; margin: 0 auto; padding: 48px 24px 72px; }
    h1 { font-family: Palatino, "Palatino Linotype", Georgia, serif; font-size: 40px; line-height: 1.15; font-weight: 600; margin: 0 0 12px; }
    h2 { font-family: Palatino, Georgia, serif; font-size: 26px; margin: 36px 0 8px; }
    p { margin: 0 0 12px; }
    .bajada { font-size: 20px; max-width: 40em; }
    .cuando { color: #57534e; margin-bottom: 28px; }
    .tarjetas { display: grid; gap: 16px; }
    .tarjeta { background: #fffdf8; border: 1px solid #e7e0d4; border-top: 6px solid #0f3d3e; padding: 20px 22px 8px; }
    .tarjeta.mal { border-top-color: #9f2d2d; }
    .tarjeta.alerta { border-top-color: #9a6700; }
    .tarjeta.bien { border-top-color: #1f6b4a; }
    .etiqueta { text-transform: uppercase; letter-spacing: 0.06em; font-size: 13px; color: #57534e; margin-bottom: 4px; }
    .frase { font-size: 20px; }
    dl { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin: 16px 0; }
    dl div { border-top: 1px solid #e7e0d4; padding-top: 8px; }
    dt { font-size: 13px; color: #57534e; }
    dd { margin: 0; font-size: 22px; font-variant-numeric: tabular-nums; }
    ol { padding-left: 1.2em; }
    li { margin: 6px 0; }
    .nota { background: #fffdf8; border: 1px solid #e7e0d4; padding: 16px 18px; }
    @media (max-width: 640px) { dl { grid-template-columns: 1fr; } h1 { font-size: 32px; } }
  </style>
</head>
<body>
  <main>
    <p class="etiqueta">Informe para quien no trabaja con la herramienta</p>
    <h1>Qué pasó al crear productos muy rápido</h1>
    <p class="bajada">${apertura(cincuenta, cien)}</p>
    <p class="cuando">Prueba del ${cuando}.</p>

    <h2>Qué se pidió</h2>
    <p>Se simuló un alta de productos sobre el servicio público de práctica. Primero, 50 productos nuevos por segundo durante un minuto (3000 en total). Después, 100 por segundo durante otro minuto (6000 en total).</p>
    <ol>
      <li>La prueba pidió un pase de acceso y lo adjuntó en cada alta.</li>
      <li>Cada producto llevó un nombre distinto, porque el servicio no debe recibir títulos repetidos.</li>
      <li>Cada pedido incluyó un precio.</li>
    </ol>

    <h2>Cómo leer los números</h2>
    <p>El tiempo habitual es el del pedido que queda en el medio: la mitad fue más rápida y la mitad más lenta. La fila de “95 de cada 100” muestra una espera ya alta, sin dejarse llevar por un único caso extremo. Un error es un pedido que el servicio no aceptó.</p>

    <h2>Resultado de cada tanda</h2>
    <div class="tarjetas">
      ${tarjeta(cincuenta)}
      ${tarjeta(cien)}
    </div>

    <h2>Conclusión</h2>
    <p>${cierre(cincuenta, cien)}</p>
    <div class="nota">
      <p>Este informe describe el comportamiento medido en esta corrida. No es una proyección de un comercio real: el servicio probado es un simulador público. Los tiempos y los rechazos pueden cambiar si se corre de nuevo, porque dependen de la red y de cuánto esté limitando ese simulador en ese momento.</p>
    </div>
  </main>
</body>
</html>`;
}
