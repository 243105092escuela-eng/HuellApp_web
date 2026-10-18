/**
 * detalle-solicitud.js — Revisión de una solicitud: datos del refugio, checklist por documento,
 * visor del archivo y decisión (aprobar, o rechazar con motivo obligatorio).
 * Los documentos son privados: se descargan con la sesión del administrador y se muestran desde
 * una URL temporal del navegador (blob), nunca desde una carpeta pública.
 */
import { requerirRol } from "../../core/router-guard.js";
import { montarNavbar, refrescarInsigniaSolicitudes } from "../../components/navbar.js";
import { obtenerSolicitud, aprobarRefugio, rechazarRefugio, marcarDocumento, descargarDocumento } from "../../core/servicios-admin.js";
import { crearElemento, ESTADOS_REFUGIO, ETIQUETAS_DOCUMENTO, formatearFecha, formatearTamano, limpiarErroresAlEscribir, marcarError, mostrarAlerta, ocultarAlerta } from "../../core/utils.js";

const sesion = requerirRol("admin");

const alerta = document.getElementById("alerta");
const lista = document.getElementById("lista-documentos");
const visor = document.getElementById("visor");
const visorTitulo = document.getElementById("visor-titulo");
const visorAbrir = document.getElementById("visor-abrir");
const progreso = document.getElementById("progreso");
const decision = document.getElementById("decision");
const botonAprobar = document.getElementById("boton-aprobar");
const modalAprobar = document.getElementById("modal-aprobar");
const modalRechazo = document.getElementById("modal-rechazo");
const formularioRechazo = document.getElementById("formulario-rechazo");
const campoMotivo = document.getElementById("campo-motivo");
const alertaRechazo = document.getElementById("alerta-rechazo");

let refugio = null;
let urlActual = null;   // URL temporal del documento que se está viendo
let pedidoVisor = 0;    // para ignorar respuestas viejas si se hace clic rápido en varios documentos

if (sesion) {
  montarNavbar({ sesion, activa: "solicitudes" });
  iniciar();
}

async function iniciar() {
  const id = new URLSearchParams(window.location.search).get("id");
  refugio = id ? await obtenerSolicitud(id) : null;
  if (!refugio) {
    document.querySelector(".revision").hidden = true;
    document.querySelector(".solicitud-cabecera").hidden = true;
    mostrarAlerta(alerta, "aviso", "Esa solicitud no existe. Vuelve a la lista para elegir otra.");
    return;
  }
  enlazarEventos();
  render();
}

/* ---------- Pantalla ---------- */

function render() {
  const estado = ESTADOS_REFUGIO[refugio.estado];
  document.title = `${refugio.nombre} · Solicitud · HuellApp`;
  document.getElementById("refugio-nombre").textContent = refugio.nombre;
  const insignia = document.getElementById("estado-insignia");
  insignia.textContent = estado.etiqueta;
  insignia.className = `insignia insignia--${estado.clase}`;

  const datos = {
    "dato-responsable": refugio.responsable, "dato-correo": refugio.correo, "dato-telefono": refugio.telefono,
    "dato-direccion": refugio.direccion, "dato-horario": refugio.horario, "dato-fecha": formatearFecha(refugio.fechaSolicitud),
  };
  Object.entries(datos).forEach(([idNodo, texto]) => { document.getElementById(idNodo).textContent = texto; });

  // Motivo de rechazo o de suspensión, si lo hay
  const motivo = document.getElementById("motivo");
  const etiquetaMotivo = { rechazado: "Motivo del rechazo", suspendido: "Motivo de la suspensión" }[refugio.estado];
  motivo.hidden = !(etiquetaMotivo && refugio.motivoRechazo);
  if (!motivo.hidden) motivo.textContent = `${etiquetaMotivo}: ${refugio.motivoRechazo}`;

  const pendiente = refugio.estado === "pendiente";
  decision.hidden = !pendiente;
  document.getElementById("ayuda-checklist").textContent = pendiente
    ? "Abre cada documento con «Ver», revísalo y márcalo cuando esté correcto. Para aprobar hay que revisar todos."
    : "Esta solicitud ya fue resuelta; la lista queda solo para consulta.";

  const fragmento = document.createDocumentFragment();
  refugio.documentos.forEach((d) => fragmento.append(crearDocumento(d, pendiente)));
  lista.replaceChildren(fragmento);
  actualizarProgreso();
}

function crearDocumento(d, editable) {
  const etiqueta = ETIQUETAS_DOCUMENTO[d.tipo] || d.tipo;
  return crearElemento("li", { clase: "documento-item", atributos: { "data-id": d.id } }, [
    crearElemento("label", { clase: "documento-item__check" }, [
      crearElemento("input", { atributos: { type: "checkbox", checked: d.verificado, disabled: !editable, "data-doc": d.id, "aria-label": `${etiqueta}: marcar como revisado` } }),
      crearElemento("span", { texto: "Revisado" }),
    ]),
    crearElemento("div", { clase: "documento-item__info" }, [
      crearElemento("strong", { texto: etiqueta }),
      crearElemento("span", { clase: "texto-suave texto-pequeno", texto: `${d.nombre} · ${formatearTamano(d.tamano)}` }),
    ]),
    crearElemento("button", { clase: "boton boton--contorno boton--pequeno", texto: "Ver", atributos: { type: "button", "data-ver": d.id, "aria-label": `Ver ${etiqueta}` } }),
  ]);
}

function actualizarProgreso() {
  const total = refugio.documentos.length;
  const revisados = refugio.documentos.filter((d) => d.verificado).length;
  progreso.textContent = `${revisados} de ${total} documentos revisados`;
  botonAprobar.disabled = total === 0 || revisados < total; // solo se aprueba con todo revisado
  botonAprobar.title = botonAprobar.disabled ? "Revisa todos los documentos para poder aprobar" : "";
}

/* ---------- Visor ---------- */

function limpiarVisor() {
  if (urlActual) URL.revokeObjectURL(urlActual);
  urlActual = null;
  visorAbrir.hidden = true;
}

async function verDocumento(id) {
  const documento = refugio.documentos.find((d) => d.id === id);
  if (!documento) return;
  const pedido = ++pedidoVisor;
  const etiqueta = ETIQUETAS_DOCUMENTO[documento.tipo] || documento.tipo;
  visorTitulo.textContent = `${etiqueta} — ${documento.nombre}`;
  visor.replaceChildren(crearElemento("p", { clase: "vacio", texto: "Cargando documento…" }));
  lista.querySelectorAll(".documento-item").forEach((li) => li.classList.toggle("documento-item--activo", li.dataset.id === id));

  try {
    const archivo = await descargarDocumento(id);
    if (pedido !== pedidoVisor) return; // se pidió otro documento mientras descargaba este
    limpiarVisor();
    urlActual = URL.createObjectURL(archivo);
    visor.replaceChildren(archivo.type === "application/pdf"
      ? crearElemento("iframe", { clase: "visor__marco", atributos: { src: urlActual, title: `Documento: ${etiqueta}` } })
      : crearElemento("img", { clase: "visor__imagen", atributos: { src: urlActual, alt: `Documento: ${etiqueta}` } }));
    visorAbrir.href = urlActual;
    visorAbrir.hidden = false;
  } catch (error) {
    if (pedido !== pedidoVisor) return;
    visor.replaceChildren(crearElemento("p", { clase: "vacio", texto: error.message || "No se pudo abrir el documento." }));
  }
}

/* ---------- Eventos ---------- */

function enlazarEventos() {
  limpiarErroresAlEscribir(formularioRechazo);
  window.addEventListener("pagehide", limpiarVisor);

  // Delegación: "Ver" y las casillas del checklist
  lista.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-ver]");
    if (boton) verDocumento(boton.dataset.ver);
  });
  lista.addEventListener("change", async (evento) => {
    const casilla = evento.target.closest("[data-doc]");
    if (!casilla) return;
    ocultarAlerta(alerta);
    const documento = refugio.documentos.find((d) => d.id === casilla.dataset.doc);
    const resultado = await marcarDocumento(documento.id, casilla.checked);
    if (resultado.ok) {
      documento.verificado = resultado.documento.verificado;
    } else {
      casilla.checked = documento.verificado; // se revierte si no se pudo guardar
      mostrarAlerta(alerta, "error", resultado.error);
    }
    actualizarProgreso();
  });

  // Aprobar (con confirmación)
  botonAprobar.addEventListener("click", () => modalAprobar.showModal());
  document.getElementById("cancelar-aprobar").addEventListener("click", () => modalAprobar.close());
  document.getElementById("confirmar-aprobar").addEventListener("click", async () => {
    modalAprobar.close();
    await resolver(aprobarRefugio(refugio.id), `«${refugio.nombre}» fue aprobado: ya puede usar su panel y es visible para los usuarios.`);
  });

  // Rechazar (motivo obligatorio)
  document.getElementById("boton-rechazar").addEventListener("click", () => {
    formularioRechazo.reset();
    marcarError(campoMotivo, "");
    ocultarAlerta(alertaRechazo);
    modalRechazo.showModal();
    formularioRechazo.elements.motivo.focus();
  });
  document.getElementById("cancelar-rechazo").addEventListener("click", () => modalRechazo.close());
  formularioRechazo.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const motivo = formularioRechazo.elements.motivo.value.trim();
    if (motivo.length < 10) {
      marcarError(campoMotivo, "Escribe el motivo del rechazo (al menos 10 caracteres): el refugio lo verá.");
      formularioRechazo.elements.motivo.focus();
      return;
    }
    const resultado = await rechazarRefugio(refugio.id, motivo);
    if (!resultado.ok) { mostrarAlerta(alertaRechazo, "error", resultado.error); return; }
    modalRechazo.close();
    await aplicarResultado(resultado, `La solicitud de «${refugio.nombre}» fue rechazada.`);
  });
}

async function resolver(promesa, mensajeExito) {
  const resultado = await promesa;
  if (!resultado.ok) { mostrarAlerta(alerta, "error", resultado.error); return; }
  await aplicarResultado(resultado, mensajeExito);
}

async function aplicarResultado(resultado, mensajeExito) {
  refugio = resultado.refugio;
  render();
  mostrarAlerta(alerta, "exito", mensajeExito);
  refrescarInsigniaSolicitudes(); // baja el número de pendientes del menú
  window.scrollTo({ top: 0, behavior: "smooth" });
}
