/** solicitudes.js — Contadores y cola de refugios pendientes de revisión (las más antiguas primero). */
import { requerirRol } from "../../core/router-guard.js";
import { montarNavbar } from "../../components/navbar.js";
import { listarRefugios, obtenerResumenAdmin } from "../../core/servicios-admin.js";
import { crearElemento, formatearFecha, tiempoRelativo } from "../../core/utils.js";

const sesion = requerirRol("admin");

if (sesion) {
  montarNavbar({ sesion, activa: "solicitudes" });
  iniciar();
}

async function iniciar() {
  const [resumen, pendientes] = await Promise.all([obtenerResumenAdmin(), listarRefugios("pendiente")]);
  document.querySelectorAll("[data-resumen]").forEach((nodo) => { nodo.textContent = String(resumen[nodo.dataset.resumen]); });

  // El servidor entrega las más nuevas primero; para revisar conviene atender primero las más antiguas
  pendientes.sort((a, b) => new Date(a.fechaSolicitud) - new Date(b.fechaSolicitud));

  document.getElementById("conteo").textContent = pendientes.length === 1 ? "1 solicitud pendiente" : `${pendientes.length} solicitudes pendientes`;
  document.getElementById("sin-solicitudes").hidden = pendientes.length > 0;
  document.getElementById("contenedor-tabla").hidden = pendientes.length === 0;

  const fragmento = document.createDocumentFragment();
  pendientes.forEach((r) => {
    const revisados = r.documentos.filter((d) => d.verificado).length;
    fragmento.append(crearElemento("tr", { atributos: { "data-id": r.id } }, [
      crearElemento("th", { texto: r.nombre, atributos: { scope: "row" } }),
      crearElemento("td", { texto: r.responsable }),
      crearElemento("td", { texto: r.correo }),
      crearElemento("td", { texto: `${formatearFecha(r.fechaSolicitud)} (${tiempoRelativo(r.fechaSolicitud)})` }),
      crearElemento("td", { texto: `${revisados} de ${r.documentos.length} revisados` }),
      crearElemento("td", {}, crearElemento("a", {
        clase: "boton boton--primario boton--pequeno", texto: "Revisar",
        atributos: { href: `detalle-solicitud.html?id=${encodeURIComponent(r.id)}`, "aria-label": `Revisar la solicitud de ${r.nombre}` },
      })),
    ]));
  });
  document.getElementById("cuerpo-tabla").replaceChildren(fragmento);
}
