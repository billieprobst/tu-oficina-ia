// Motor 3D de la oficina (Three.js). Dibuja la oficina, los personajes y sus rutas por los pasillos,
// y reproduce los eventos que le pasa la página: el agente se mueve, camina si lleva algo a otro y habla en un globito.
// No sabe nada de la base de datos ni de la IA: solo dibuja.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export const AGENTES = {
  recepcion: { nombre: "Recepción", color: "#d9480f" },
  obra: { nombre: "Obra", color: "#e67700" },
  jefe: { nombre: "Jefe de oficina", color: "#2f52a0" },
};

const ROPA = {
  jefe: { ropa: "blazer", saco: "#2b3550", camisa: "#ffffff", corbata: "#e8590c", pant: "#2b2a27", piel: "#e9b38d", pelo: "#2b2420", peinado: "corto", acc: "" },
  recepcion: { ropa: "blusa", saco: "#f06a2a", camisa: "#f06a2a", pant: "#3d3a34", piel: "#c98e66", pelo: "#1f1a17", peinado: "cola", acc: "audifonos" },
  obra: { ropa: "camisa", saco: "#3f6fb0", camisa: "#3f6fb0", pant: "#3d3a34", piel: "#a86f4c", pelo: "#2a1b12", peinado: "corto", acc: "casco" },
};

// Puestos: dónde se sienta cada uno, desde qué nodo de pasillo llega y dónde se para quien lo visita.
const FILA1 = -3.4, FILA2 = 0.9;
const PUESTOS = {
  obra: { x: -3.6, z: FILA1 - 0.95, rot: 0, alto: 0.45, nodo: "a0_-3.6", visita: { x: -3.25, z: -2.25, rot: Math.PI, nodo: "a1_-3.6" } },
  recepcion: { x: -9.35, z: 4.6, rot: Math.PI / 2, alto: 0.45, nodo: "rB", visita: { x: -7.35, z: 4.4, rot: -Math.PI / 2, nodo: "rV" } },
  jefe: { x: 9.7, z: -7.1, rot: 0, alto: 0.45, nodo: "jC", visita: { x: 9.35, z: -5.05, rot: Math.PI, nodo: "jB" } },
};
const BARRA = { x: -10.0, z: -6.7, rot: Math.PI, nodo: "cE" };
const PRONTO = [
  { x: 0, z: FILA1, nombre: "Seguimiento · pronto" },
  { x: 3.6, z: FILA1, nombre: "Documentos · pronto" },
  { x: -3.6, z: FILA2, nombre: "Cotizaciones · pronto" },
  { x: 0, z: FILA2, nombre: "Analista · pronto" },
  { x: 3.6, z: FILA2, nombre: "Escritorio libre" },
];

export function crearOficina(contenedor, capa, opciones = {}) {
  const movil = matchMedia("(max-width: 820px)").matches;
  const calma = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, movil ? 1.75 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  contenedor.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environmentIntensity = 0.45;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, enablePan: false, minDistance: 10, maxDistance: 62, minPolarAngle: 0.42, maxPolarAngle: 1.22, minAzimuthAngle: 0.08, maxAzimuthAngle: 1.5 });
  const centro = new THREE.Vector3(0, 0.6, 0);
  controls.target.copy(centro);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9cbb6, 0.55));
  const sol = new THREE.DirectionalLight(0xfff1e0, 2.3);
  sol.position.set(9, 18, 11);
  sol.castShadow = true;
  sol.shadow.mapSize.set(movil ? 1024 : 2048, movil ? 1024 : 2048);
  Object.assign(sol.shadow.camera, { left: -17, right: 17, top: 14, bottom: -14, near: 1, far: 50 });
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.02;
  scene.add(sol);

  // ---------- Ayudantes ----------
  const mats = new Map();
  const mat = (color, rough = 0.6, extra = {}) => {
    const k = color + rough + JSON.stringify(extra);
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra }));
    return mats.get(k);
  };
  const malla = (geo, material, x = 0, y = 0, z = 0, padre = scene) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    padre.add(m);
    return m;
  };
  const caja = (w, h, d, material, x, y, z, padre, r = 0) => malla(r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d), material, x, y, z, padre);
  const cil = (rt, rb, h, material, x, y, z, padre, seg = 24) => malla(new THREE.CylinderGeometry(rt, rb, h, seg), material, x, y, z, padre);
  const esfera = (r, material, x, y, z, padre, seg = 24) => malla(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.66)), material, x, y, z, padre);
  const lienzo = (w, h, dibujar) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    dibujar(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  const placa = (texto, fondo, color, w, h, padre, x, y, z, rotY = 0, tam = 0.42) => {
    const tex = lienzo(512, Math.round((512 * h) / w), (g, W, H) => {
      g.fillStyle = fondo;
      g.fillRect(0, 0, W, H);
      g.fillStyle = color;
      g.font = `600 ${Math.round(H * tam)}px Geist, system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(texto, W / 2, H / 2 + 2);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.receiveShadow = true;
    padre.add(m);
    return m;
  };

  // ---------- La oficina ----------
  const W = 24, D = 16;
  const madera = lienzo(2048, 1365, (g, w, h) => {
    g.fillStyle = "#d8c2a2";
    g.fillRect(0, 0, w, h);
    const filas = 64, alto = h / filas, pxm = w / W;
    let semilla = 7;
    const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280);
    for (let f = 0; f < filas; f++) {
      let x = -azar() * 90;
      while (x < w) {
        const largo = pxm * (1.3 + azar() * 1.3), tono = 196 + azar() * 26;
        g.fillStyle = `rgb(${tono + 22},${tono},${tono - 34})`;
        g.fillRect(x, f * alto, largo, alto);
        g.fillStyle = "rgba(120,88,52,.35)";
        g.fillRect(x, f * alto, 1.5, alto);
        x += largo;
      }
      g.fillStyle = "rgba(120,88,52,.28)";
      g.fillRect(0, f * alto, w, 1.2);
    }
  });
  const piso = new THREE.Mesh(new THREE.BoxGeometry(W, 0.24, D), [mat("#cdb99c"), mat("#cdb99c"), new THREE.MeshStandardMaterial({ map: madera, roughness: 0.62 }), mat("#bfae93"), mat("#c9b597"), mat("#c9b597")]);
  piso.position.y = -0.12;
  piso.receiveShadow = true;
  scene.add(piso);

  const pared = mat("#f3efe9", 0.9), pared2 = mat("#ece6dd", 0.9), zocalo = mat("#d6ccbe", 0.7), marco = mat("#2b2a27", 0.5);
  caja(W + 0.3, 3.2, 0.25, pared, 0.15, 1.6, -8.125);
  caja(0.25, 3.2, D, pared2, -12.125, 1.6, 0);
  caja(W, 0.12, 0.04, zocalo, 0, 0.06, -7.98);
  caja(0.04, 0.12, D, zocalo, -11.98, 0.06, 0);
  const vidrio = new THREE.MeshStandardMaterial({ color: "#cfe2f0", emissive: "#bcd5ea", emissiveIntensity: 0.45, roughness: 0.08 });
  for (const x of [-2.6, 1.6, 9.7]) {
    caja(2.5, 1.6, 0.06, marco, x, 1.75, -7.97);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(2.32, 1.42), vidrio);
    v.position.set(x, 1.75, -7.935);
    scene.add(v);
    caja(0.05, 1.42, 0.03, marco, x, 1.75, -7.92);
    caja(2.32, 0.05, 0.03, marco, x, 1.75, -7.92);
  }
  const nombreNegocio = (opciones.negocio || "Mi oficina").toUpperCase().slice(0, 26);
  const logo = lienzo(1024, 256, (g, w, h) => {
    g.fillStyle = "#1a1917";
    g.beginPath();
    g.roundRect(0, 0, w, h, 28);
    g.fill();
    let tam = 92;
    g.font = `700 ${tam}px Geist, system-ui, sans-serif`;
    while (g.measureText(nombreNegocio).width > w - 80 && tam > 40) g.font = `700 ${(tam -= 4)}px Geist, system-ui, sans-serif`;
    g.textBaseline = "middle";
    g.textAlign = "center";
    g.fillStyle = "#ffffff";
    g.fillText(nombreNegocio, w / 2, h / 2 + 4);
    g.fillStyle = "#fe5a00";
    g.fillRect(w / 2 - 60, h - 30, 120, 8);
  });
  const letrero = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshStandardMaterial({ map: logo, roughness: 0.5, transparent: true }));
  letrero.position.set(-11.99, 2.05, 0.4);
  letrero.rotation.y = Math.PI / 2;
  scene.add(letrero);
  caja(0.06, 2.3, 1.3, marco, -11.97, 1.15, 6.3);
  caja(0.05, 2.18, 1.14, mat("#c9ad89", 0.55), -11.94, 1.1, 6.3);
  caja(1.1, 0.02, 1.5, mat("#5b4636", 0.95), -11.3, 0.01, 6.3);

  // Reloj de pared
  const relojG = new THREE.Group();
  relojG.position.set(-6.3, 2.35, -7.97);
  scene.add(relojG);
  const cara = lienzo(256, 256, (g, w) => {
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(w / 2, w / 2, w / 2, 0, 7);
    g.fill();
    g.fillStyle = "#1a1917";
    for (let i = 0; i < 12; i++) {
      const r1 = w * 0.4, r2 = w * (i % 3 ? 0.44 : 0.46);
      g.save();
      g.translate(w / 2, w / 2);
      g.rotate((i / 12) * Math.PI * 2);
      g.fillRect(-3, -r2, 6, r2 - r1);
      g.restore();
    }
  });
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 40), [mat("#1a1917", 0.4), new THREE.MeshStandardMaterial({ map: cara, roughness: 0.5 }), mat("#1a1917", 0.4)]);
  disco.rotation.x = Math.PI / 2;
  disco.position.z = 0.03;
  relojG.add(disco);
  const aguja = (largo, ancho) => {
    const g = new THREE.Group();
    g.position.z = 0.065;
    relojG.add(g);
    const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, largo, 0.01), mat("#1a1917", 0.4));
    m.position.y = largo / 2 - 0.03;
    g.add(m);
    return g;
  };
  const agujaH = aguja(0.19, 0.03), agujaM = aguja(0.27, 0.02);
  const ponerReloj = () => {
    const ahora = new Date();
    agujaH.rotation.z = -((ahora.getHours() % 12) + ahora.getMinutes() / 60) / 12 * Math.PI * 2;
    agujaM.rotation.z = -(ahora.getMinutes() / 60) * Math.PI * 2;
  };
  ponerReloj();

  const planta = (x, z, s = 1) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    scene.add(g);
    cil(0.24, 0.18, 0.46, mat("#d8c6ae", 0.8), 0, 0.23, 0, g);
    cil(0.21, 0.21, 0.04, mat("#5b4636", 0.95), 0, 0.44, 0, g);
    const hojas = [mat("#3f7d4f", 0.75), mat("#5a9a62", 0.75), mat("#2f6b43", 0.75)];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, r = 0.12 + (i % 3) * 0.06;
      const h = malla(new THREE.IcosahedronGeometry(0.2 + (i % 3) * 0.05, 0), hojas[i % 3], Math.cos(a) * r, 0.62 + (i % 4) * 0.17, Math.sin(a) * r, g);
      h.rotation.set(i, i * 2, 0);
    }
  };
  planta(-11.3, 7.3, 1.2); planta(-6.0, -7.4, 1.1); planta(11.3, -2.6); planta(11.4, -7.4); planta(11.3, 7.3, 1.3); planta(6.6, 7.0); planta(-1.8, 5.2, 0.9);

  const libro = ["#2f52a0", "#fe5a00", "#1f8a4c", "#b7791f", "#6b4fa0", "#e8e6e1"].map((c) => mat(c, 0.7));
  {
    const g = new THREE.Group();
    g.position.set(4.4, 0, -7.72);
    scene.add(g);
    const m = mat("#f7f5f1", 0.6);
    caja(1.5, 1.9, 0.05, m, 0, 0.95, -0.17, g);
    caja(0.05, 1.9, 0.4, m, -0.73, 0.95, 0, g);
    caja(0.05, 1.9, 0.4, m, 0.73, 0.95, 0, g);
    for (const y of [0.03, 0.66, 1.29, 1.88]) caja(1.5, 0.04, 0.4, m, 0, y, 0, g);
    [0.05, 0.68, 1.31].forEach((y, f) => {
      let bx = -0.66;
      for (let i = 0; i < 9 && bx < 0.6; i++) {
        const ancho = 0.06 + ((i * 7 + f) % 4) * 0.025, alto = 0.34 + ((i + f) % 3) * 0.06;
        caja(ancho, alto, 0.26, libro[(i + f * 2) % libro.length], bx + ancho / 2, y + alto / 2, 0.02, g);
        bx += ancho + 0.012;
      }
    });
  }

  // ---------- Muebles de trabajo ----------
  const blanco = mat("#f7f5f1", 0.5), grafito = mat("#3d3a34", 0.55), negro = mat("#1f1d1a", 0.45);
  const silla = (x, z, rotY = 0, color = "#8f8a82") => {
    const tela = mat(color, 0.85);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    caja(0.52, 0.09, 0.5, tela, 0, 0.41, 0, g, 0.04);
    caja(0.5, 0.56, 0.08, tela, 0, 0.8, -0.24, g, 0.04);
    cil(0.03, 0.03, 0.34, grafito, 0, 0.2, 0, g, 10);
    cil(0.26, 0.26, 0.04, grafito, 0, 0.04, 0, g, 18);
  };
  const pantallas = {};
  const escritorio = (x, z, color, nombre, ancho = 2.0) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    caja(ancho, 0.06, 0.95, blanco, 0, 0.75, 0, g, 0.025);
    caja(0.05, 0.72, 0.85, grafito, -ancho / 2 + 0.08, 0.36, 0, g);
    caja(0.05, 0.72, 0.85, grafito, ancho / 2 - 0.08, 0.36, 0, g);
    caja(ancho - 0.2, 0.42, 0.03, blanco, 0, 0.47, 0.43, g);
    placa(nombre, color, "#ffffff", 1.25, 0.28, g, 0, 0.5, 0.452, 0, nombre.length > 16 ? 0.34 : 0.46);
    const lap = new THREE.Group();
    lap.position.set(-0.45, 0.78, -0.08);
    lap.rotation.y = 0.25;
    g.add(lap);
    const aluminio = mat("#c9ccd1", 0.35);
    caja(0.44, 0.022, 0.3, aluminio, 0, 0.011, 0, lap, 0.008);
    const tapa = new THREE.Group();
    tapa.position.set(0, 0.02, 0.15);
    tapa.rotation.x = 0.28;
    lap.add(tapa);
    caja(0.44, 0.29, 0.016, aluminio, 0, 0.145, 0, tapa, 0.008);
    const pantalla = new THREE.Mesh(new THREE.CircleGeometry(0.035, 20), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.4 }));
    pantalla.position.set(0, 0.15, 0.0095);
    tapa.add(pantalla);
    cil(0.045, 0.04, 0.1, mat(color, 0.5), 0.72, 0.83, 0.05, g, 16);
    caja(0.3, 0.012, 0.22, mat("#ffffff", 0.9), 0.4, 0.785, 0.12, g).rotation.y = 0.2;
    return pantalla;
  };

  // Cafetería
  const azulejo = lienzo(512, 512, (g, w) => {
    const n = 11, t = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? "#e6dccc" : "#f3ede3"; g.fillRect(i * t, j * t, t, t); }
  });
  const pisoCafe = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.4), new THREE.MeshStandardMaterial({ map: azulejo, roughness: 0.4 }));
  pisoCafe.rotation.x = -Math.PI / 2;
  pisoCafe.position.set(-9.2, 0.006, -5.3);
  pisoCafe.receiveShadow = true;
  scene.add(pisoCafe);
  caja(3.6, 0.88, 0.62, mat("#2f3a3a", 0.6), -10.0, 0.44, -7.6, scene, 0.02);
  caja(3.7, 0.05, 0.68, mat("#ece7df", 0.35), -10.0, 0.905, -7.6);
  caja(3.6, 0.72, 0.34, mat("#ffffff", 0.55), -10.0, 2.35, -7.82, scene, 0.02);
  caja(0.46, 0.52, 0.4, negro, -10.6, 1.19, -7.62, scene, 0.04);
  esfera(0.025, mat("#fe5a00", 0.4, { emissive: "#fe5a00", emissiveIntensity: 1.2 }), -10.45, 1.35, -7.415, scene, 10);
  cil(0.13, 0.13, 0.32, mat("#d9cfc0", 0.5), -9.4, 1.09, -7.6, scene, 20);
  caja(0.85, 1.95, 0.72, mat("#e9edf0", 0.35), -7.8, 0.975, -7.55, scene, 0.05);
  placa("Cafetería", "#2f3a3a", "#ffffff", 1.6, 0.42, scene, -11.98, 2.35, -5.3, Math.PI / 2, 0.5);
  cil(0.6, 0.6, 0.05, blanco, -8.6, 0.74, -4.0, scene, 40);
  cil(0.035, 0.035, 0.72, grafito, -8.6, 0.37, -4.0, scene, 10);
  cil(0.28, 0.28, 0.03, grafito, -8.6, 0.015, -4.0, scene, 24);
  for (const [x, z] of [[-7.75, -4.0], [-9.45, -4.0], [-8.6, -3.15]]) {
    cil(0.21, 0.21, 0.06, mat("#c98a4b", 0.6), x, 0.56, z, scene, 20);
    cil(0.025, 0.025, 0.54, grafito, x, 0.27, z, scene, 8);
    cil(0.17, 0.17, 0.03, grafito, x, 0.015, z, scene, 18);
  }

  // Sala de descanso
  caja(4.6, 0.02, 3.2, mat("#e3c9b2", 0.95), 9.2, 0.01, 4.5, scene, 0.008);
  const sofaTela = mat("#2f52a0", 0.85);
  caja(3.0, 0.42, 0.95, sofaTela, 9.2, 0.25, 3.0, scene, 0.1);
  caja(3.0, 0.62, 0.28, sofaTela, 9.2, 0.62, 2.62, scene, 0.1);
  caja(0.28, 0.6, 0.95, sofaTela, 7.62, 0.38, 3.0, scene, 0.1);
  caja(0.28, 0.6, 0.95, sofaTela, 10.78, 0.38, 3.0, scene, 0.1);
  for (const x of [8.3, 9.2, 10.1]) caja(0.86, 0.12, 0.78, mat("#3b5fb0", 0.85), x, 0.5, 3.08, scene, 0.05);
  caja(1.3, 0.05, 0.7, mat("#c98a4b", 0.5), 9.2, 0.42, 5.1, scene, 0.02);
  for (const [x, z] of [[8.65, 4.85], [9.75, 4.85], [8.65, 5.35], [9.75, 5.35]]) cil(0.025, 0.025, 0.4, grafito, x, 0.2, z);
  cil(0.012, 0.012, 1.6, grafito, 11.2, 0.8, 2.7, scene, 8);
  cil(0.2, 0.26, 0.3, mat("#f3e9d8", 0.8, { emissive: "#ffe2b8", emissiveIntensity: 0.35 }), 11.2, 1.7, 2.7, scene, 20);

  // Recepción
  const recep = new THREE.Group();
  recep.position.set(-8.3, 0, 4.6);
  scene.add(recep);
  caja(0.5, 1.08, 2.6, mat("#ffffff", 0.5), 0, 0.54, 0, recep, 0.04);
  caja(0.62, 0.05, 2.7, mat("#c98a4b", 0.5), 0, 1.1, 0, recep, 0.02);
  caja(0.03, 0.42, 1.6, mat("#fe5a00", 0.6), 0.265, 0.55, 0, recep);
  placa("Recepción", "#1a1917", "#ffffff", 1.2, 0.26, recep, 0.282, 0.55, 0, Math.PI / 2, 0.5);
  caja(1.1, 0.05, 0.9, blanco, -0.75, 0.74, 0, recep, 0.02);
  const monRecep = new THREE.Group();
  monRecep.position.set(-0.55, 0.77, 0.45);
  monRecep.rotation.y = -Math.PI / 2 - 0.4;
  recep.add(monRecep);
  caja(0.6, 0.38, 0.035, negro, 0, 0.33, 0, monRecep, 0.012);
  cil(0.012, 0.012, 0.2, grafito, 0, 0.1, 0, monRecep, 8);

  // Oficina del jefe (vidrio)
  const vidrioPared = new THREE.MeshStandardMaterial({ color: "#d7e9f3", transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false });
  const panelVidrio = (x, z, largo, alongX) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(alongX ? largo : 0.04, 2.5, alongX ? 0.04 : largo), vidrioPared);
    m.position.set(x, 1.25, z);
    scene.add(m);
    caja(alongX ? largo : 0.07, 0.07, alongX ? 0.07 : largo, marco, x, 2.5, z);
    caja(alongX ? largo : 0.07, 0.05, alongX ? 0.07 : largo, marco, x, 0.025, z);
  };
  panelVidrio(9.7, -3.2, 4.6, true);
  panelVidrio(7.4, -6.1, 3.8, false);
  caja(0.07, 2.5, 0.07, marco, 7.4, 1.25, -3.2);
  caja(0.07, 2.5, 0.07, marco, 7.4, 1.25, -4.2);
  caja(0.07, 0.07, 1.0, marco, 7.4, 2.5, -3.7);
  caja(3.6, 0.02, 2.4, mat("#d7cfc4", 0.95), 9.7, 0.01, -5.9, scene, 0.008);

  // Escritorios de los agentes y los que vienen pronto
  pantallas.obra = escritorio(PUESTOS.obra.x, PUESTOS.obra.z + 0.95, AGENTES.obra.color, "Obra");
  silla(PUESTOS.obra.x, PUESTOS.obra.z, 0, AGENTES.obra.color);
  pantallas.jefe = escritorio(9.7, -6.2, AGENTES.jefe.color, "Jefe de oficina", 2.3);
  silla(PUESTOS.jefe.x, PUESTOS.jefe.z, 0, AGENTES.jefe.color);
  silla(PUESTOS.recepcion.x, PUESTOS.recepcion.z, PUESTOS.recepcion.rot, AGENTES.recepcion.color);
  for (const p of PRONTO) {
    escritorio(p.x, p.z, "#a49e93", p.nombre);
    silla(p.x, p.z - 0.95);
  }

  // ---------- Pasillos ----------
  const NODOS = {}, VECINOS = {};
  const nodo = (id, x, z) => { NODOS[id] = { x, z }; VECINOS[id] = VECINOS[id] || []; };
  const unir = (a, b) => { VECINOS[a].push(b); VECINOS[b].push(a); };
  const XS = [-5.6, -3.6, -1.8, 0, 1.8, 3.6, 5.6], ZS = [-5.3, -1.5, 2.6], CRUCES = [-5.6, -1.8, 1.8, 5.6];
  ZS.forEach((z, j) => XS.forEach((x) => nodo(`a${j}_${x}`, x, z)));
  ZS.forEach((z, j) => XS.slice(1).forEach((x, i) => unir(`a${j}_${XS[i]}`, `a${j}_${x}`)));
  CRUCES.forEach((x) => { unir(`a0_${x}`, `a1_${x}`); unir(`a1_${x}`, `a2_${x}`); });
  nodo("cE", -6.9, -5.3); unir("cE", "a0_-5.6");
  nodo("rA", -6.9, 2.6); unir("rA", "a2_-5.6");
  nodo("rB", -9.35, 3.0); unir("rB", "rA");
  nodo("rV", -6.6, 3.5); unir("rV", "a2_-5.6");
  nodo("jA", 6.5, -3.75); unir("jA", "a1_5.6"); unir("jA", "a0_5.6");
  nodo("jB", 8.2, -3.75); unir("jB", "jA");
  nodo("jC", 8.2, -7.1); unir("jC", "jB");
  const ruta = (desde, hasta) => {
    const dist = { [desde]: 0 }, prev = {}, abiertos = new Set(Object.keys(NODOS));
    while (abiertos.size) {
      let u = null;
      for (const n of abiertos) if (dist[n] !== undefined && (u === null || dist[n] < dist[u])) u = n;
      if (u === null || u === hasta) break;
      abiertos.delete(u);
      for (const v of VECINOS[u]) {
        const d = dist[u] + Math.hypot(NODOS[u].x - NODOS[v].x, NODOS[u].z - NODOS[v].z);
        if (dist[v] === undefined || d < dist[v]) { dist[v] = d; prev[v] = u; }
      }
    }
    const camino = [hasta];
    while (camino[0] !== desde && prev[camino[0]]) camino.unshift(prev[camino[0]]);
    return camino.map((id) => NODOS[id]);
  };

  // ---------- Personajes ----------
  const ALTO_CADERA = 0.46, TAM = 1.12;
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const orbeMat = mat("#fe5a00", 0.3, { emissive: "#fe5a00", emissiveIntensity: 1.3 });
  const geoTorso = new THREE.LatheGeometry([[0, 0], [0.165, 0], [0.2, 0.05], [0.207, 0.16], [0.197, 0.27], [0.165, 0.35], [0.1, 0.395], [0, 0.405]].map(([x, y]) => new THREE.Vector2(x, y)), 28);

  const crearPersonaje = (id) => {
    const R = ROPA[id];
    const raiz = new THREE.Group(), cuerpo = new THREE.Group();
    raiz.add(cuerpo);
    raiz.scale.setScalar(TAM);
    const piel = mat(R.piel, 0.55), pelo = mat(R.pelo, 0.7), pant = mat(R.pant, 0.75), zap = mat("#2a2622", 0.45);
    const saco = mat(R.saco, 0.7), camisa = mat(R.camisa, 0.65), oscuro = mat("#1a1917", 0.3);
    const pierna = (lado) => {
      const cadera = new THREE.Group();
      cadera.position.set(lado * 0.1, ALTO_CADERA, 0);
      cuerpo.add(cadera);
      malla(new THREE.CapsuleGeometry(0.092, 0.12, 6, 14), pant, 0, -0.12, 0, cadera);
      const rodilla = new THREE.Group();
      rodilla.position.y = -0.23;
      cadera.add(rodilla);
      malla(new THREE.CapsuleGeometry(0.085, 0.1, 6, 14), pant, 0, -0.09, 0, rodilla);
      malla(new RoundedBoxGeometry(0.15, 0.09, 0.25, 3, 0.04), zap, 0, -0.19, 0.045, rodilla);
      return { cadera, rodilla };
    };
    const pi = pierna(-1), pd = pierna(1);
    malla(geoTorso, saco, 0, 0.43, 0, cuerpo).scale.set(1, 1, 0.8);
    if (R.ropa === "blazer") {
      const v = malla(new THREE.CylinderGeometry(0.075, 0.005, 0.2, 3), camisa, 0, 0.73, 0.152, cuerpo);
      v.rotation.set(0.12, Math.PI, 0);
      v.scale.z = 0.35;
      if (R.corbata) malla(new RoundedBoxGeometry(0.045, 0.17, 0.02, 2, 0.008), mat(R.corbata, 0.5), 0, 0.71, 0.168, cuerpo).rotation.x = 0.12;
    }
    if (R.ropa === "camisa" || R.ropa === "blusa") {
      for (const l of [-1, 1]) {
        const cu = malla(new RoundedBoxGeometry(0.1, 0.035, 0.07, 2, 0.015), mat(R.ropa === "camisa" ? "#ffffff" : R.saco, 0.6), l * 0.055, 0.815, 0.11, cuerpo);
        cu.rotation.set(0.5, 0, l * -0.5);
      }
    }
    if (R.acc === "casco") {
      // chaleco de obra con franjas reflectivas
      const chaleco = malla(geoTorso, mat("#ff8a00", 0.6), 0, 0.45, 0, cuerpo);
      chaleco.scale.set(1.06, 0.82, 0.86);
      for (const y of [0.56, 0.66]) {
        const franja = malla(new THREE.CylinderGeometry(0.218, 0.218, 0.025, 28, 1, true), mat("#e8e6e1", 0.3), 0, y, 0, cuerpo);
        franja.scale.z = 0.86;
      }
    }
    const brazo = (lado) => {
      const hombro = new THREE.Group();
      hombro.position.set(lado * 0.215, 0.79, 0);
      hombro.rotation.z = lado * 0.1;
      cuerpo.add(hombro);
      malla(new THREE.CapsuleGeometry(0.064, 0.19, 6, 14), saco, 0, -0.13, 0, hombro);
      malla(new THREE.SphereGeometry(0.068, 16, 12), piel, 0, -0.3, 0.005, hombro).scale.set(0.95, 1.1, 0.85);
      return { hombro };
    };
    const bi = brazo(-1), bd = brazo(1);
    malla(new THREE.CylinderGeometry(0.062, 0.068, 0.08, 16), piel, 0, 0.86, 0, cuerpo);
    const cabeza = new THREE.Group();
    cabeza.position.y = 1.12;
    cuerpo.add(cabeza);
    malla(new THREE.SphereGeometry(0.26, 36, 28), piel, 0, 0, 0, cabeza).scale.set(1, 0.96, 0.94);
    for (const l of [-1, 1]) malla(new THREE.SphereGeometry(0.055, 14, 10), piel, l * 0.25, -0.01, -0.01, cabeza).scale.set(0.6, 1, 1);
    const casco = (inclinacion = -0.36, alcance = 0.52) => {
      const c = malla(new THREE.SphereGeometry(0.272, 36, 20, 0, Math.PI * 2, 0, Math.PI * alcance), pelo, 0, 0.005, 0, cabeza);
      c.rotation.x = inclinacion;
      c.scale.set(1.01, 0.98, 0.97);
    };
    if (R.peinado === "corto") {
      casco();
      for (const [x, y, z, r] of [[-0.1, 0.19, 0.15, 0.08], [0, 0.215, 0.14, 0.085], [0.1, 0.19, 0.15, 0.075]]) malla(new THREE.SphereGeometry(r, 14, 10), pelo, x, y, z, cabeza);
    } else if (R.peinado === "cola") {
      casco(-0.4, 0.52);
      malla(new THREE.CapsuleGeometry(0.07, 0.24, 6, 12), pelo, 0, -0.06, -0.3, cabeza).rotation.x = 0.5;
      malla(new THREE.TorusGeometry(0.045, 0.015, 8, 16), mat("#fe5a00", 0.5), 0, 0.07, -0.27, cabeza).rotation.x = 1.1;
    }
    const ojos = [-1, 1].map((l) => {
      const o = malla(new THREE.SphereGeometry(0.038, 18, 14), oscuro, l * 0.088, 0.005, 0.232, cabeza);
      o.scale.set(0.85, 1.25, 0.55);
      const b = malla(new THREE.SphereGeometry(0.012, 10, 8), mat("#ffffff", 0.2), 0.014, 0.012, 0.045, o);
      b.scale.set(1 / 0.85, 1 / 1.25, 1 / 0.55);
      b.castShadow = false;
      return o;
    });
    for (const l of [-1, 1]) malla(new THREE.CapsuleGeometry(0.011, 0.045, 4, 8), pelo, l * 0.09, 0.083, 0.226, cabeza).rotation.z = Math.PI / 2 + l * 0.12;
    malla(new THREE.SphereGeometry(0.022, 12, 10), piel, 0, -0.03, 0.247, cabeza).scale.z = 0.7;
    const boca = malla(new THREE.TorusGeometry(0.036, 0.01, 8, 16, Math.PI), mat("#8a3324", 0.5), 0, -0.078, 0.232, cabeza);
    boca.rotation.z = Math.PI;
    for (const l of [-1, 1]) {
      const c = malla(new THREE.SphereGeometry(0.04, 12, 10), mat("#ff7f66", 0.7, { transparent: true, opacity: 0.38 }), l * 0.15, -0.05, 0.205, cabeza);
      c.scale.z = 0.3;
      c.castShadow = false;
    }
    if (R.acc === "audifonos") {
      malla(new THREE.TorusGeometry(0.285, 0.02, 8, 30, Math.PI), oscuro, 0, 0.01, 0, cabeza);
      for (const l of [-1, 1]) malla(new THREE.CylinderGeometry(0.068, 0.068, 0.06, 18), oscuro, l * 0.275, -0.01, 0, cabeza).rotation.z = Math.PI / 2;
      malla(new THREE.SphereGeometry(0.024, 10, 8), mat("#fe5a00", 0.4), -0.17, -0.12, 0.2, cabeza);
    }
    if (R.acc === "casco") {
      const amarillo = mat("#ffc21a", 0.35);
      const domo = malla(new THREE.SphereGeometry(0.29, 30, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), amarillo, 0, 0.04, 0, cabeza);
      domo.scale.set(1, 0.92, 1);
      malla(new THREE.CylinderGeometry(0.33, 0.33, 0.025, 30), amarillo, 0, 0.04, 0.03, cabeza).scale.set(1, 1, 1.05);
      malla(new THREE.BoxGeometry(0.05, 0.03, 0.5), amarillo, 0, 0.32, 0, cabeza);
    }
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.5, 10), hitMat);
    hit.position.y = 0.75;
    hit.userData.pid = id;
    raiz.add(hit);
    const orbe = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), orbeMat);
    raiz.add(orbe);
    const taza = malla(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 14), mat(AGENTES[id].color, 0.5), 0, -0.36, 0.05, bd.hombro);
    taza.visible = false;
    scene.add(raiz);
    return { raiz, cuerpo, pi, pd, bi, bd, cabeza, ojos, boca, orbe, taza, hit, semilla: Math.random() * 10 };
  };

  const AG = {};
  const sentarEn = (a, s) => {
    a.raiz.position.set(s.x, s.alto + 0.09 - ALTO_CADERA * TAM, s.z);
    a.raiz.rotation.y = s.rot;
    a.rotObjetivo = s.rot;
    a.estado = "sentado";
    a.nodo = s.nodo;
  };
  for (const id of Object.keys(AGENTES)) {
    const s = PUESTOS[id];
    AG[id] = { id, ...crearPersonaje(id), casa: s, estado: "sentado", nodo: s.nodo, rotObjetivo: s.rot, camino: [], fin: null, alLlegar: null, fase: 0, parpadeo: 2 + Math.random() * 3, hablando: false, libre: Date.now() };
    sentarEn(AG[id], s);
  }

  const ir = (a, destino) => {
    if (a.alLlegar) a.alLlegar();
    a.camino = ruta(a.nodo, destino.nodo).concat([{ x: destino.x, z: destino.z }]);
    a.fin = destino;
    a.estado = "camina";
    a.raiz.position.y = 0;
    return new Promise((res) => { a.alLlegar = () => { a.alLlegar = null; res(); }; });
  };
  const angCerca = (actual, objetivo, k) => {
    let d = objetivo - actual;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return actual + d * k;
  };
  const lerp = (a, b, k) => a + (b - a) * k;
  const VEL = calma ? 6 : 2.0;

  const actualizar = (a, dt, t) => {
    const r = a.raiz;
    let cadI = 0, cadD = 0, rodI = 0, rodD = 0, brI = 0, brD = 0, brZ = 0.1, bob = 0, inclina = 0;
    if (a.estado === "camina") {
      const p = a.camino[0];
      if (p) {
        const dx = p.x - r.position.x, dz = p.z - r.position.z, d = Math.hypot(dx, dz), paso = VEL * dt;
        if (d <= paso) { r.position.x = p.x; r.position.z = p.z; a.camino.shift(); }
        else { r.position.x += (dx / d) * paso; r.position.z += (dz / d) * paso; a.rotObjetivo = Math.atan2(dx, dz); }
      }
      if (!a.camino.length) {
        a.nodo = a.fin.nodo;
        if (a.fin.alto) sentarEn(a, a.fin);
        else { a.estado = "parado"; a.rotObjetivo = a.fin.rot; }
        if (a.alLlegar) a.alLlegar();
      }
      a.fase += dt * VEL * 4.6;
      const s = Math.sin(a.fase);
      cadI = s * 0.5; cadD = -s * 0.5;
      rodI = Math.max(0, s) * 0.8; rodD = Math.max(0, -s) * 0.8;
      brI = -s * 0.5; brD = a.taza.visible ? -1.2 : s * 0.5;
      bob = Math.abs(Math.cos(a.fase)) * 0.03;
      inclina = 0.05;
    } else if (a.estado === "sentado") {
      cadI = cadD = -1.52; rodI = rodD = 1.45;
      if (a.hablando) { brI = -0.95; brD = -1.35 + Math.sin(t * 7) * 0.2; }
      else { brI = -1.1 + Math.sin(t * 15 + 1) * 0.06; brD = -1.1 + Math.sin(t * 15) * 0.06; brZ = 0.18; }
      inclina = 0.02;
    } else {
      if (a.hablando) { brD = -1.05 + Math.sin(t * 6) * 0.22; brI = -0.2; }
      if (a.taza.visible) brD = -1.2;
      bob = Math.sin(t * 2.1 + a.semilla) * 0.006;
    }
    const k = Math.min(1, dt * 12);
    a.pi.cadera.rotation.x = lerp(a.pi.cadera.rotation.x, cadI, k);
    a.pd.cadera.rotation.x = lerp(a.pd.cadera.rotation.x, cadD, k);
    a.pi.rodilla.rotation.x = lerp(a.pi.rodilla.rotation.x, rodI, k);
    a.pd.rodilla.rotation.x = lerp(a.pd.rodilla.rotation.x, rodD, k);
    a.bi.hombro.rotation.x = lerp(a.bi.hombro.rotation.x, brI, k);
    a.bd.hombro.rotation.x = lerp(a.bd.hombro.rotation.x, brD, k);
    a.bi.hombro.rotation.z = lerp(a.bi.hombro.rotation.z, -brZ, k);
    a.bd.hombro.rotation.z = lerp(a.bd.hombro.rotation.z, brZ, k);
    a.cuerpo.position.y = bob;
    a.cuerpo.rotation.x = lerp(a.cuerpo.rotation.x, inclina, k);
    r.rotation.y = angCerca(r.rotation.y, a.rotObjetivo, Math.min(1, dt * 9));
    const mira = a.estado === "camina" ? 0 : Math.sin(t * 0.45 + a.semilla) * 0.3 * (Math.sin(t * 0.2 + a.semilla) > 0.3 ? 1 : 0.15);
    a.cabeza.rotation.y = lerp(a.cabeza.rotation.y, a.hablando ? 0 : mira, k * 0.3);
    a.cabeza.rotation.x = lerp(a.cabeza.rotation.x, a.hablando ? Math.sin(t * 5) * 0.07 : -0.06, k);
    a.boca.scale.y = a.hablando ? 1 + Math.abs(Math.sin(t * 11)) * 1.6 : 1;
    a.parpadeo -= dt;
    a.ojos.forEach((o) => { o.scale.y = a.parpadeo < 0.11 ? 0.12 : 1.25; });
    if (a.parpadeo < 0) a.parpadeo = 2.5 + Math.random() * 3.5;
    a.orbe.rotation.y += dt * 1.6;
    a.orbe.position.y = (a.estado === "sentado" ? 1.56 : 1.62) + Math.sin(t * 2.2 + a.semilla) * 0.035;
    const pant = pantallas[a.id];
    if (pant) pant.material.emissiveIntensity = a.hablando ? 1.4 + Math.sin(t * 8) * 0.5 : 0.9;
  };

  // ---------- Globitos ----------
  const v3 = new THREE.Vector3();
  const colocar = (el, a) => {
    v3.set(a.raiz.position.x, a.raiz.position.y + 1.55 * TAM, a.raiz.position.z).project(camera);
    if (v3.z > 1) { el.style.visibility = "hidden"; return; }
    el.style.visibility = "visible";
    const W2 = contenedor.clientWidth, H2 = contenedor.clientHeight;
    const px = ((v3.x + 1) / 2) * W2, py = ((1 - v3.y) / 2) * H2;
    const w = el.offsetWidth, h = el.offsetHeight;
    const xc = Math.max(8, Math.min(W2 - w - 8, px - w / 2));
    el.style.setProperty("--cola", `${Math.max(14, Math.min(w - 14, px - xc))}px`);
    el.style.transform = `translate(${Math.round(xc)}px, ${Math.round(Math.max(6, py - h - 10))}px)`;
  };
  const mostrarGlobo = (a, texto) => {
    quitarGlobo(a);
    const el = document.createElement("div");
    el.className = "globo";
    const q = document.createElement("span");
    q.className = "globo-quien";
    q.textContent = AGENTES[a.id].nombre;
    el.append(q, document.createTextNode(texto));
    capa.append(el);
    a.globo = el;
  };
  const quitarGlobo = (a) => { if (a.globo) { a.globo.remove(); a.globo = null; } };

  // ---------- Cola de eventos ----------
  const cola = [];
  let corriendo = false, vivo = true;
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const reproducir = async () => {
    if (corriendo) return;
    corriendo = true;
    while (vivo && cola.length) {
      const ev = cola.shift();
      const a = AG[ev.agente];
      if (!a) continue;
      while (a.estado === "camina" && vivo) await esperar(200);
      const visita = ev.visita && ev.visita !== ev.agente && PUESTOS[ev.visita] ? PUESTOS[ev.visita].visita : null;
      if (visita) await ir(a, visita);
      a.hablando = true;
      mostrarGlobo(a, ev.texto);
      await esperar(4800);
      a.hablando = false;
      quitarGlobo(a);
      if (visita) ir(a, a.casa);
      a.libre = Date.now();
      await esperar(500);
    }
    corriendo = false;
  };

  // Vida sin eventos: de vez en cuando alguien va por un café. No es un evento: no dice nada.
  const cafe = setInterval(async () => {
    if (!vivo || corriendo || calma) return;
    const libres = Object.values(AG).filter((a) => a.estado === "sentado" && Date.now() - a.libre > 180_000);
    if (!libres.length || Math.random() > 0.5) return;
    const a = libres[Math.floor(Math.random() * libres.length)];
    a.libre = Date.now();
    await ir(a, BARRA);
    a.taza.visible = true;
    await esperar(3500);
    await ir(a, a.casa);
    a.taza.visible = false;
  }, 45_000);

  // ---------- Tocar a un personaje ----------
  const ray = new THREE.Raycaster(), puntero = new THREE.Vector2();
  const golpes = Object.values(AG).map((a) => a.hit);
  let abajo = null;
  const quien = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(puntero, camera);
    const hit = ray.intersectObjects(golpes, false)[0];
    return hit ? hit.object.userData.pid : null;
  };
  const alBajar = (e) => { abajo = { x: e.clientX, y: e.clientY }; };
  const alSubir = (e) => {
    if (!abajo || Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) > 6) return;
    opciones.alElegir?.(quien(e));
  };
  const alMover = (e) => { if (e.pointerType === "mouse") renderer.domElement.style.cursor = quien(e) ? "pointer" : "grab"; };
  renderer.domElement.addEventListener("pointerdown", alBajar);
  renderer.domElement.addEventListener("pointerup", alSubir);
  renderer.domElement.addEventListener("pointermove", alMover);

  // ---------- Cámara y bucle ----------
  const anillo = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), new THREE.MeshBasicMaterial({ color: "#fe5a00", transparent: true, opacity: 0.9 }));
  anillo.rotation.x = -Math.PI / 2;
  anillo.visible = false;
  scene.add(anillo);
  let seleccion = null;

  const encuadrar = () => {
    const w = contenedor.clientWidth, h = contenedor.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const posicionInicial = () => {
    const asp = contenedor.clientWidth / Math.max(1, contenedor.clientHeight);
    const dist = asp >= 1.3 ? 35 : asp >= 0.9 ? 40 : asp >= 0.7 ? 54 : 62;
    const pol = 0.98, az = Math.PI / 4;
    camera.position.set(centro.x + dist * Math.sin(pol) * Math.sin(az), centro.y + dist * Math.cos(pol), centro.z + dist * Math.sin(pol) * Math.cos(az));
    controls.update();
  };
  const obs = new ResizeObserver(encuadrar);
  obs.observe(contenedor);
  encuadrar();
  posicionInicial();

  const reloj = new THREE.Clock();
  const objetivo = new THREE.Vector3();
  let pausado = document.visibilityState === "hidden";
  const alVisibilidad = () => { pausado = document.visibilityState === "hidden"; };
  document.addEventListener("visibilitychange", alVisibilidad);
  let cuadro = 0;
  const bucle = () => {
    if (!vivo) return;
    cuadro = requestAnimationFrame(bucle);
    const dt = Math.min(0.1, reloj.getDelta()), t = reloj.elapsedTime;
    if (pausado) return;
    for (const a of Object.values(AG)) actualizar(a, dt, t);
    const sel = seleccion ? AG[seleccion] : null;
    objetivo.copy(sel ? sel.raiz.position : centro);
    objetivo.y = sel ? 0.8 : centro.y;
    const antes = controls.target.clone();
    controls.target.lerp(objetivo, Math.min(1, dt * 2.5));
    camera.position.add(controls.target.clone().sub(antes));
    controls.update();
    if (sel) { anillo.position.set(sel.raiz.position.x, 0.02, sel.raiz.position.z); anillo.rotation.z += dt; }
    if (Math.round(t) % 30 === 0) ponerReloj();
    renderer.render(scene, camera);
    for (const a of Object.values(AG)) if (a.globo) colocar(a.globo, a);
  };
  bucle();

  return {
    /** Agrega eventos a la cola: el agente los cuenta uno por uno. */
    mostrar(eventos) {
      for (const ev of eventos) cola.push(ev);
      reproducir();
    },
    elegir(id) {
      seleccion = id && AG[id] ? id : null;
      anillo.visible = Boolean(seleccion);
    },
    destruir() {
      vivo = false;
      cancelAnimationFrame(cuadro);
      clearInterval(cafe);
      obs.disconnect();
      document.removeEventListener("visibilitychange", alVisibilidad);
      renderer.domElement.removeEventListener("pointerdown", alBajar);
      renderer.domElement.removeEventListener("pointerup", alSubir);
      renderer.domElement.removeEventListener("pointermove", alMover);
      for (const a of Object.values(AG)) quitarGlobo(a);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const m = o.material;
        for (const x of Array.isArray(m) ? m : m ? [m] : []) { x.map?.dispose(); x.dispose(); }
      });
      pmrem.dispose();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
