import http from 'k6/http';
import { check } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { construirInforme } from './informe.js';

const LOGIN_URL = 'https://dummyjson.com/auth/login';
const CREATE_URL = 'https://dummyjson.com/products/add';

const CREDENCIALES = {
  username: 'emilys',
  password: 'emilyspass',
  expiresInMins: 30,
};

export const options = {
  scenarios: {
    cincuenta_tps: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 150,
      maxVUs: 500,
      gracefulStop: '10s',
      exec: 'crearProducto',
    },
    cien_tps: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 300,
      maxVUs: 800,
      startTime: '80s',
      gracefulStop: '10s',
      exec: 'crearProducto',
    },
  },
  thresholds: {
    'http_req_failed{scenario:cincuenta_tps}': ['rate<0.01'],
    'http_req_failed{scenario:cien_tps}': ['rate<0.01'],
    'http_req_duration{scenario:cincuenta_tps}': ['p(95)<2000'],
    'http_req_duration{scenario:cien_tps}': ['p(95)<2000'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export function setup() {
  const response = http.post(LOGIN_URL, JSON.stringify(CREDENCIALES), {
    headers: { 'Content-Type': 'application/json' },
  });

  const loginOk = check(response, {
    'login responde 200': (res) => res.status === 200,
  });
  if (!loginOk) {
    throw new Error(`No se pudo obtener el JWT. Status ${response.status}.`);
  }

  const token = response.json('accessToken');
  if (!token) {
    throw new Error('La respuesta de login no incluye accessToken.');
  }

  return { token };
}

export function crearProducto(data) {
  const title = `producto-${__VU}-${__ITER}-${Date.now()}`;
  const price = Number((((__ITER % 200) + 1) + (__VU % 10) / 10).toFixed(2));

  const response = http.post(CREATE_URL, JSON.stringify({ title, price }), {
    headers: {
      Authorization: `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    },
    tags: { nombre: 'POST /products/add' },
  });

  const payload = leerJson(response);

  check(response, {
    'el alta responde 200 o 201': (res) => res.status === 200 || res.status === 201,
    'vuelve el mismo title': () => payload.title === title,
    'vuelve un id numérico': () => typeof payload.id === 'number',
  });
}

function leerJson(response) {
  try {
    return response.json();
  } catch (error) {
    return {};
  }
}

export function handleSummary(data) {
  const resumen = {};
  Object.keys(data).forEach((key) => {
    if (key !== 'setup_data') resumen[key] = data[key];
  });

  return {
    'reporte/resumen-k6.json': JSON.stringify(resumen, null, 2),
    'reporte/informe.html': construirInforme(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
