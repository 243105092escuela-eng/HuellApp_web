/**
 * servicios-admin.js — Datos de las pantallas del administrador (solo el rol "admin" puede usarlos;
 * el servidor lo comprueba en cada petición).
 */
import { get, post, patch, descargar, intentar } from "./api.js";

/** { pendientes, aprobados, rechazados, suspendidos } */
export const obtenerResumenAdmin = () => get("/admin/resumen");

/** @param {""|"pendiente"|"aprobado"|"rechazado"|"suspendido"} estado  Vacío = todos */
export async function listarRefugios(estado = "") {
  return (await get(`/admin/refugios${estado ? `?estado=${encodeURIComponent(estado)}` : ""}`)).refugios;
}

/** Refugio con sus documentos. @returns {Promise<object|null>} null si no existe */
export async function obtenerSolicitud(id) {
  try {
    return (await get(`/admin/refugios/${encodeURIComponent(id)}`)).refugio;
  } catch (error) {
    if (error.estado === 404) return null;
    throw error;
  }
}

const cambiarEstado = (id, accion, cuerpo = {}) => intentar(async () => {
  const r = await post(`/admin/refugios/${encodeURIComponent(id)}/${accion}`, cuerpo);
  return { ok: true, refugio: r.refugio };
});

export const aprobarRefugio = (id) => cambiarEstado(id, "aprobar");
/** El motivo es obligatorio (mínimo 10 caracteres). */
export const rechazarRefugio = (id, motivo) => cambiarEstado(id, "rechazar", { motivo });
export const suspenderRefugio = (id, motivo = "") => cambiarEstado(id, "suspender", { motivo });
export const reactivarRefugio = (id) => cambiarEstado(id, "reactivar");

/** Casilla del checklist de revisión de un documento. */
export const marcarDocumento = (id, verificado) => intentar(async () => {
  const r = await patch(`/admin/documentos/${encodeURIComponent(id)}`, { verificado });
  return { ok: true, documento: r.documento };
});

/** Contenido del documento (PDF o imagen) como Blob. */
export const descargarDocumento = (id) => descargar(`/admin/documentos/${encodeURIComponent(id)}/archivo`);
