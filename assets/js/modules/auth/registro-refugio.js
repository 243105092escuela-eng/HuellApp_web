/**
 * registro-refugio.js — Alta de refugio con carga de documentos.
 * Al enviarse, el refugio queda en estado "Pendiente de verificación".
 */
import { registrarRefugio } from "../../core/auth.js";
import { redirigirSiHaySesion } from "../../core/router-guard.js";
import { irA, esCorreoValido, mostrarAlerta, ocultarAlerta, marcarError, formatearTamano, leerComoDataUrl } from "../../core/utils.js";

const TAMANO_MAX = 5 * 1024 * 1024; // 5 MB
const TIPOS_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png"];

/** Documentos que pide el formulario: [campo, tipo guardado, obligatorio] */
const DOCUMENTOS = [
  ["acta", "acta", true],
  ["domicilio", "domicilio", true],
  ["identificacion", "identificacion", true],
  ["permiso", "permiso", false],
];

if (!redirigirSiHaySesion()) {
  const formulario = document.getElementById("form-registro");
  const alerta = document.getElementById("alerta");
  const boton = document.getElementById("boton-enviar");
  const campo = (nombre) => formulario.elements[nombre].closest(".campo");

  /** Valida un archivo; devuelve texto de error o "". */
  function validarArchivo(archivo, obligatorio) {
    if (!archivo) return obligatorio ? "Sube este documento (PDF, JPG o PNG)." : "";
    if (!TIPOS_PERMITIDOS.includes(archivo.type)) return "Formato no permitido. Usa PDF, JPG o PNG.";
    if (archivo.size > TAMANO_MAX) return `El archivo pesa ${formatearTamano(archivo.size)}. El máximo es 5 MB.`;
    return "";
  }

  formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    ocultarAlerta(alerta);
    const f = formulario.elements;

    const errores = {
      nombreRefugio: f.nombreRefugio.value.trim().length < 3 ? "Escribe el nombre del refugio." : "",
      responsable: f.responsable.value.trim().length < 3 ? "Escribe el nombre del responsable." : "",
      correo: !esCorreoValido(f.correo.value.trim()) ? "Escribe un correo válido, por ejemplo refugio@correo.com." : "",
      telefono: !/^[\d\s+()-]{8,}$/.test(f.telefono.value) ? "Escribe un teléfono de al menos 8 dígitos." : "",
      direccion: f.direccion.value.trim().length < 8 ? "Escribe la dirección completa del refugio." : "",
      horaApertura: !f.horaApertura.value || !f.horaCierre.value ? "Indica el horario de atención." : (f.horaCierre.value <= f.horaApertura.value ? "La hora de cierre debe ser posterior a la de apertura." : ""),
      password: f.password.value.length < 8 ? "Usa al menos 8 caracteres." : "",
    };
    DOCUMENTOS.forEach(([nombre, , obligatorio]) => {
      errores[nombre] = validarArchivo(f[nombre].files[0], obligatorio);
    });

    Object.entries(errores).forEach(([nombre, msg]) => marcarError(campo(nombre), msg));
    if (Object.values(errores).some(Boolean)) {
      mostrarAlerta(alerta, "error", "Hay campos por corregir. Revisa los mensajes en rojo.");
      return;
    }

    boton.disabled = true;
    // Los archivos reales viajan al servidor en base64 (data URL); él los valida y los guarda
    let documentos;
    try {
      documentos = await Promise.all(DOCUMENTOS
        .filter(([nombre]) => f[nombre].files[0])
        .map(async ([nombre, tipo]) => ({ tipo, nombre: f[nombre].files[0].name, dataUrl: await leerComoDataUrl(f[nombre].files[0]) })));
    } catch {
      boton.disabled = false;
      mostrarAlerta(alerta, "error", "No pudimos leer uno de los archivos. Vuelve a seleccionarlo e inténtalo de nuevo.");
      return;
    }
    const r = await registrarRefugio({
      nombreRefugio: f.nombreRefugio.value.trim(),
      responsable: f.responsable.value.trim(),
      correo: f.correo.value.trim(),
      telefono: f.telefono.value.trim(),
      direccion: f.direccion.value.trim(),
      horario: `${f.horaApertura.value} - ${f.horaCierre.value}`,
      password: f.password.value,
      documentos,
    });
    boton.disabled = false;

    if (!r.ok) { mostrarAlerta(alerta, "error", r.error); return; }
    mostrarAlerta(alerta, "exito", "Solicitud enviada. Tu refugio queda en estado Pendiente de verificación. Te llevamos al inicio de sesión…");
    setTimeout(() => irA("pages/login.html"), 2200);
  });
}
