# Challenge performance — QA Engineer SR

Pruebas de performance con k6. La parte 1 es el criterio de qué pruebas hacer sobre un comercio de unas 1500 ventas por día. La parte 2 es el script que crea productos a 50 y a 100 por segundo, y el informe en lenguaje llano con el resultado de esa corrida.

## Parte 1

Está en [docs/parte-1-pruebas-recomendadas.md](docs/parte-1-pruebas-recomendadas.md).

La conclusión corta: 1500 ventas por día no son 1500 requests por segundo. Conviene probar, en este orden, la carga de un día normal, la carga de una fecha especial (x5), el golpe de la apertura, la resistencia de varias horas y, al final, el margen por encima de esa campaña.

## Parte 2 — cómo ejecutar y ver el reporte

### 1. Instalar k6

- macOS: `brew install k6`
- Windows: `winget install k6 --source winget` o `choco install k6`
- Linux (Debian/Ubuntu):

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

Comprobar:

```bash
k6 version
```

No hace falta Node ni otro paquete. El script usa la librería estándar de k6.

### 2. Ejecutar la prueba

Desde la raíz de este repositorio:

```bash
k6 run k6/crear-producto.js
```

Qué hace esa corrida:

1. Pide un JWT a `POST https://dummyjson.com/auth/login` con el usuario de demostración publicado por dummyjson (`emilys`).
2. Durante un minuto envía **50 requests por segundo** a `POST https://dummyjson.com/products/add`.
3. Espera a que esa tanda termine y, durante otro minuto, envía **100 requests por segundo** al mismo endpoint.
4. Cada request manda `Authorization: Bearer <jwt>`, `Content-Type: application/json` y un body `{ "title", "price" }` con un `title` distinto.

La corrida dura unos dos minutos y medio. k6 termina con código 99 si se cruza un umbral (más de 1 % de errores, o el percentil 95 por encima de 2 segundos). El informe se escribe igual. En la corrida que está en `reporte/`, el código fue 99 porque el servicio rechazó pedidos: a 50 por segundo se crearon 1.562 de 3.000, y a 100 por segundo 1.390 de 6.000. El detalle está en el HTML.

### 3. Ver el reporte

Al terminar, k6 deja dos archivos en `reporte/`:

| Archivo | Para quién |
| --- | --- |
| `reporte/informe.html` | Lectura no técnica: qué se pidió, cuántos pedidos salieron, cuántos fallaron y qué conviene concluir. |
| `reporte/resumen-k6.json` | Números crudos de k6, por si hay que reconstruir el informe. |

Abrir el informe:

```bash
open reporte/informe.html
```

En Windows: `start reporte/informe.html`. En Linux: `xdg-open reporte/informe.html`.

El HTML de `reporte/` que está en el repositorio corresponde a la corrida ya ejecutada. Volver a lanzar `k6 run` lo reemplaza con los números nuevos.

## Qué hay en el repositorio

- `docs/parte-1-pruebas-recomendadas.md` — parte 1.
- `k6/crear-producto.js` — script de la parte 2.
- `k6/informe.js` — arma el HTML para una lectura no técnica.
- `reporte/informe.html` — resultado de la corrida.
- `reporte/resumen-k6.json` — resumen numérico de esa misma corrida.

## Nombre

Marcelo Alejandro Ares
