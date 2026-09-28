# Lubricentro Esquiú

Aplicación estática de turnos. `index.html` es el acceso de clientes y `admin.html` contiene el panel administrativo completo. `assets/system.js` centraliza fechas, validaciones y operaciones de datos. `App.jsx` es un prototipo anterior y no se carga en las páginas actuales.

## Guardado del Libretito y rendimiento del administrador

Al pulsar **Guardar y abrir WhatsApp**, el administrador reserva una pestaña en ese mismo clic. Después de confirmar el guardado en Firebase, en computadora intenta abrir la aplicación de WhatsApp de escritorio con el mensaje preparado; ofrece botones para repetir la apertura o usar WhatsApp Web si el navegador o Windows no aceptan el enlace. En el celular usa el enlace universal de WhatsApp. Si falla el guardado, la pestaña reservada se cierra. WhatsApp exige que el operador pulse **Enviar** y que tenga una sesión vinculada; esta aplicación estática no puede confirmar ni automatizar la entrega. Un envío automático requeriría una integración de servidor con WhatsApp Business Platform.

Las lecturas de Firestore independientes ahora se ejecutan en paralelo. Cuando la base usa registros V2, completar o cambiar el estado de un turno usa una transacción sobre ese turno sin volver a descargar todas las colecciones. La creación de turnos sigue consultando los datos actuales para verificar disponibilidad. También se redujo el trabajo repetido al calcular recordatorios. Las mejoras están verificadas con pruebas locales; la latencia real depende de la conexión y de Firebase y debe medirse en el entorno publicado.

El administrador usa la misma identidad visual azul oscuro y naranja, el logo y los componentes de la vista de clientes. Se rediseñaron la entrada, el acceso, la cabecera, el panel, las tarjetas y los formularios para pantallas grandes y celulares. La autenticación conserva el mismo usuario y la misma contraseña de Firebase; no se modificaron las credenciales.

## Alcance de esta revisión

Se mantienen el catálogo de servicios, los intervalos de mantenimiento y el ingreso por patente por decisión del propietario. Se eliminó el generador de QR, conservando el historial y la apertura de enlaces antiguos del Libretito.

No se ejecutaron escrituras, eliminaciones, migraciones ni restauraciones en la base real durante el desarrollo. Tampoco se cambiaron las reglas de Firebase. La vista de prueba reemplaza Firebase por datos ficticios locales.

| Hallazgo original | Estado en esta versión |
| --- | --- |
| 1. Guardados que borraban registros de otras sesiones | Las acciones consultan datos actuales y escriben únicamente los documentos afectados. Las ediciones concurrentes del mismo registro se rechazan. |
| 2. Reservas simultáneas superpuestas | Pendiente de activar coordinación en Firebase. La configuración actual conserva la comprobación de disponibilidad, pero dos altas simultáneas todavía pueden coincidir. El modo coordinado está implementado y probado, pero desactivado. |
| 3. Acceso únicamente por patente | Conservado expresamente. No es autenticación: no garantiza privacidad del historial. |
| 4. Inserción de HTML desde campos | Se escapan los valores mostrados y los argumentos de eventos; se validan los datos nuevos. Las reglas del servidor permanecen sin cambios. |
| 5. QR / enlace del Libretito | Generador y visor de QR retirados. Corregido el acceso mediante enlaces antiguos. |
| 6. Registro duplicado y éxito falso | Se actualiza la sesión solo después del guardado, una sola vez, con manejo de errores y bloqueo de doble clic. |
| 7. Errores interpretados como base vacía | Las lecturas fallan de forma explícita y ofrecen reintentar; un fallo de lectura no restaura datos predeterminados. |
| 8. Cambios fallidos en memoria | El estado de pantalla cambia después de confirmar el guardado. Las operaciones relacionadas se envían en una transacción. |
| 9. Fecha UTC y horarios pasados | Fecha calculada para Argentina en cada uso; validación de fecha, hora, domingo, cierre y pausa del mediodía. |
| 10. WhatsApp mal normalizado | Normalización de formatos argentinos y rechazo de contenido no telefónico. |
| 11. Avisos masivos falsamente enviados | Apertura de una conversación por vez; el administrador marca el envío realizado y esa marca se guarda. |
| 12. Criterios de mantenimiento | Conservados por instrucción expresa. |
| 13. Patentes repetidas | Se verifica también al editar y con una lectura actual antes de crear. La garantía entre altas V2 simultáneas requiere el modo coordinado pendiente. |
| 14. Backup y migración parciales | Validación de formato, campos, IDs y relaciones; respaldo desde datos actualizados; escritura única y rechazo antes de escribir si supera 450 operaciones. La serialización frente a inserciones nuevas simultáneas necesita coordinación. |

## Límites de concurrencia pendientes

El modo publicado usa únicamente las colecciones y permisos ya utilizados por la aplicación. No consulta ni escribe `systemLocks`.

`Lubri.createStore(db, defaults, {coordinated: true})` habilita una versión compartida en `systemLocks/writes`. Su uso requiere una regla específica y una actualización coordinada de ambos clientes. **No activarlo sin configurar y verificar Firebase con autorización del propietario.** No hay archivos ni automatizaciones que desplieguen reglas en este repositorio.

Sin esa coordinación, las transacciones evitan modificaciones parciales y conflictos sobre documentos que se han leído; no detectan documentos nuevos que otra sesión inserta entre una consulta y su guardado. Esto afecta reservas simultáneas, unicidad de nuevas patentes y reemplazos/eliminaciones mientras se crean registros relacionados. Los tests incluyen explícitamente este límite, para no confundir los resultados del modo preparado con garantías del modo publicado.

Las restauraciones mayores a 450 operaciones se rechazan sin aplicar ninguna escritura. Requieren un procedimiento asistido; no se dividen en lotes que puedan quedar a medio completar. Conservar un respaldo anterior antes de usar restaurar.

## Pruebas

Requiere Node.js 20 o posterior; no necesita instalar dependencias.

```sh
node --test tests/*.test.cjs
```

Incluye pruebas del modo actual y del modo coordinado preparado, carreras entre sesiones, errores de red/escritura, backups, migraciones, fechas, teléfonos, escape de contenido y flujos de página. Se ejecutan también en GitHub Actions.

Vista aislada para revisar la interfaz:

```sh
node tests/preview.cjs
```

Abrir `http://127.0.0.1:4173/` o `http://127.0.0.1:4173/admin.html`. El cartel verde identifica los datos ficticios. Cliente de ejemplo: `AB123CD`. Administrador de prueba: `roger tassi`, cualquier contraseña no vacía. Estas credenciales solo funcionan en la simulación local; las páginas publicadas usan Firebase Authentication.

Los datos de la simulación se guardan en `sessionStorage` de esa pestaña, separados de la aplicación real. No usar el servidor de pruebas como servidor de producción.

## Publicación

El sitio existente se publica desde GitHub Pages. Los cambios en el código no ejecutan migraciones ni restauraciones: esas acciones requieren intervención explícita dentro del administrador. Mantener juntos los dos HTML y `assets/system.js` al publicar o revertir una versión.
