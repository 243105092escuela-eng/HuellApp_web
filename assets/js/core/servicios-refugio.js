/**
 * servicios-refugio.js — Datos del panel de refugio (inventario, publicaciones, perfil, resumen).
 * El servidor sabe de qué refugio se trata por la sesión: aquí nunca se envía un id de refugio.
 */
import { get, post, put, patch, del, intentar } from "./api.js";

/* ---------- Resumen ---------- */
export const obtenerResumen = () => get("/refugio/resumen");

/* ---------- Inventario (CRUD) ---------- */

export async function listarMascotas() {
  return (await get("/refugio/mascotas")).mascotas;
}

/**
 * Crea (sin `id`) o edita (con `id`) una mascota.
 * @param {object} datos  nombre, especie, raza, edadMeses, sexo, tamano, salud, descripcion, foto, estatus
 */
export const guardarMascota = (datos, id = null) => intentar(async () => {
  const r = id ? await put(`/refugio/mascotas/${id}`, datos) : await post("/refugio/mascotas", datos);
  return { ok: true, mascota: r.mascota };
});

export const cambiarEstatus = (id, estatus) => intentar(async () => {
  const r = await patch(`/refugio/mascotas/${id}/estatus`, { estatus });
  return { ok: true, mascota: r.mascota };
});

/** Cantidad de publicaciones que se borrarían junto con la mascota. */
export async function contarPublicacionesDeMascota(id) {
  return (await get(`/refugio/mascotas/${id}/publicaciones/conteo`)).total;
}

/** Elimina la mascota y también las publicaciones que la mostraban. */
export const eliminarMascota = (id) => intentar(async () => {
  const r = await del(`/refugio/mascotas/${id}`);
  return { ok: true, publicacionesEliminadas: r.publicacionesEliminadas };
});

/* ---------- Publicaciones ---------- */

/** Publicaciones del refugio con el nombre y estatus de la mascota asociada. */
export async function listarPublicaciones() {
  return (await get("/refugio/publicaciones")).publicaciones;
}

/** @param {{mascotaId:string, texto:string, foto?:string}} datos  Sin `foto` se usa la de la mascota. */
export const crearPublicacionRefugio = ({ mascotaId, texto, foto = "" }) => intentar(async () => {
  const r = await post("/refugio/publicaciones", { mascotaId, texto, foto });
  return { ok: true, publicacion: r.publicacion };
});

export const eliminarPublicacionRefugio = (id) => intentar(async () => {
  await del(`/refugio/publicaciones/${id}`);
  return { ok: true };
});

/* ---------- Perfil ---------- */

/** Solo se pueden editar: telefono, direccion, horario y descripcion. */
export const actualizarPerfil = (cambios) => intentar(async () => {
  const r = await put("/refugio/perfil", cambios);
  return { ok: true, refugio: r.refugio };
});
