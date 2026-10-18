/**
 * publicaciones.js — El refugio publica mascotas del inventario en su página pública.
 * Formulario (mascota + texto + foto opcional) y lista de publicaciones con opción de eliminar.
 */
import { requerirRol } from "../../core/router-guard.js";
import { montarNavbar } from "../../components/navbar.js";
import { crearTarjetaPublicacion } from "../../components/tarjeta-publicacion.js";
import { listarMascotas, listarPublicaciones, crearPublicacionRefugio, eliminarPublicacionRefugio } from "../../core/servicios-refugio.js";
import { crearElemento, limpiarErroresAlEscribir, marcarError, mostrarAlerta, ocultarAlerta, redimensionarImagen, resolverImagen, validarImagen, ESTATUS_MASCOTA } from "../../core/utils.js";

const sesion = requerirRol("refugio");

const formulario = document.getElementById("formulario-publicacion");
const selector = document.getElementById("pub-mascota");
const entradaTexto = document.getElementById("pub-texto");
const entradaFoto = document.getElementById("pub-foto");
const contador = document.getElementById("pub-contador");
const vista = document.getElementById("pub-vista");
const vistaImg = vista.querySelector("img");
const botonUsarOriginal = document.getElementById("pub-foto-original");
const alerta = document.getElementById("alerta-publicacion");
const botonPublicar = document.getElementById("boton-publicar");
const avisoSinMascotas = document.getElementById("sin-mascotas");
const lista = document.getElementById("lista-publicaciones");
const vacio = document.getElementById("sin-publicaciones");
const anuncio = document.getElementById("anuncio");
const modalBorrar = document.getElementById("modal-borrar");

let mascotas = [];
let fotoPersonalizada = ""; // data URL si el refugio sube otra foto distinta a la de la mascota
let borrandoId = null;

if (sesion) {
  montarNavbar({ sesion, activa: "publicaciones" });
  iniciar();
}

async function iniciar() {
  // Solo se publican mascotas que siguen buscando hogar
  mascotas = (await listarMascotas()).filter((m) => m.estatus !== "adoptado");
  const opciones = mascotas.map((m) => crearElemento("option", { texto: `${m.nombre} · ${m.especie === "perro" ? "Perro" : "Gato"} · ${ESTATUS_MASCOTA[m.estatus].etiqueta}`, atributos: { value: m.id } }));
  selector.append(...opciones);

  if (mascotas.length === 0) {
    avisoSinMascotas.hidden = false;
    formulario.querySelectorAll("input, select, textarea, button").forEach((c) => { c.disabled = true; });
  }
  enlazarEventos();
  await renderLista();
}

/* ---------- Vista previa de la foto ---------- */

function actualizarVista() {
  const mascota = mascotas.find((m) => m.id === selector.value);
  const origen = fotoPersonalizada || mascota?.foto || "";
  vista.hidden = !origen;
  if (origen) vistaImg.src = resolverImagen(origen);
  botonUsarOriginal.hidden = !fotoPersonalizada;
}

/* ---------- Lista de publicaciones ---------- */

async function renderLista() {
  const publicaciones = await listarPublicaciones();
  vacio.hidden = publicaciones.length > 0;
  const fragmento = document.createDocumentFragment();
  publicaciones.forEach((p) => {
    const estatus = ESTATUS_MASCOTA[p.mascotaEstatus];
    const tarjeta = crearTarjetaPublicacion({ ...p, likes: 0, comentarios: [], etiqueta: `Mascota: ${p.mascotaNombre}` }, { conLikes: false, conComentarios: false });
    fragmento.append(crearElemento("li", { clase: "publicacion-item", atributos: { "data-id": p.id } }, [
      tarjeta,
      crearElemento("div", { clase: "publicacion-item__acciones" }, [
        crearElemento("span", { clase: `insignia insignia--${estatus ? estatus.clase : "rechazado"}`, texto: estatus ? estatus.etiqueta : "Sin mascota" }),
        ...(p.mascotaEstatus === "adoptado" ? [crearElemento("span", { clase: "texto-pequeno texto-suave", texto: "No se muestra a los usuarios porque ya fue adoptada." })] : []),
        crearElemento("button", { clase: "boton boton--peligro boton--pequeno", texto: "Eliminar", atributos: { type: "button", "data-accion": "eliminar", "aria-label": `Eliminar publicación de ${p.mascotaNombre}` } }),
      ]),
    ]));
  });
  lista.replaceChildren(fragmento);
}

/* ---------- Eventos ---------- */

function enlazarEventos() {
  limpiarErroresAlEscribir(formulario);
  selector.addEventListener("change", () => { marcarError(selector.closest(".campo"), ""); actualizarVista(); });
  entradaTexto.addEventListener("input", () => { contador.textContent = `${entradaTexto.value.length}/500`; });

  entradaFoto.addEventListener("change", async () => {
    const archivo = entradaFoto.files[0];
    const zona = entradaFoto.closest(".campo");
    if (!archivo) return;
    const error = validarImagen(archivo);
    if (error) { marcarError(zona, error); entradaFoto.value = ""; return; }
    try {
      fotoPersonalizada = await redimensionarImagen(archivo);
      marcarError(zona, "");
      actualizarVista();
    } catch {
      marcarError(zona, "No pudimos leer esa imagen. Prueba con otra.");
    }
  });
  botonUsarOriginal.addEventListener("click", () => { fotoPersonalizada = ""; entradaFoto.value = ""; actualizarVista(); });

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    ocultarAlerta(alerta);
    const texto = entradaTexto.value.trim();
    const errorMascota = selector.value ? "" : "Elige una mascota de tu inventario.";
    const errorTexto = texto.length < 10 ? "Escribe al menos 10 caracteres." : "";
    marcarError(selector.closest(".campo"), errorMascota);
    marcarError(entradaTexto.closest(".campo"), errorTexto);
    if (errorMascota || errorTexto) { (errorMascota ? selector : entradaTexto).focus(); return; }

    botonPublicar.disabled = true;
    const resultado = await crearPublicacionRefugio({ mascotaId: selector.value, texto, foto: fotoPersonalizada });
    botonPublicar.disabled = false;

    if (!resultado.ok) { mostrarAlerta(alerta, "error", resultado.error); return; }
    formulario.reset();
    fotoPersonalizada = "";
    contador.textContent = "0/500";
    actualizarVista();
    mostrarAlerta(alerta, "exito", "¡Publicación creada! Ya aparece en la página pública de tu refugio.");
    await renderLista();
  });

  lista.addEventListener("click", (evento) => {
    const boton = evento.target.closest('[data-accion="eliminar"]');
    if (!boton) return;
    borrandoId = boton.closest("li").dataset.id;
    modalBorrar.showModal();
  });
  document.getElementById("cancelar-borrar").addEventListener("click", () => modalBorrar.close());
  document.getElementById("confirmar-borrar").addEventListener("click", async () => {
    modalBorrar.close();
    const resultado = await eliminarPublicacionRefugio(borrandoId);
    anuncio.textContent = resultado.ok ? "Publicación eliminada." : resultado.error;
    await renderLista();
  });
}
