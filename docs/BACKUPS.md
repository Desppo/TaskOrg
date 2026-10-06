# Conservar tus datos al actualizar TaskOrg

1. En la versión instalada, abre **Configuración → Copia de seguridad → Exportar todos mis datos**. En versiones anteriores, la opción se llama **Exportar copia de seguridad**.
2. Guarda el archivo `taskorg-backup-….json` fuera de TaskOrg. En iPhone puedes elegir **Guardar en Archivos** en el menú de compartir; en Android elige una aplicación que guarde el archivo o envíalo a tu ordenador.
3. Comprueba que el archivo está en el destino elegido. Cerrar el menú de compartir no confirma que se haya guardado. La copia temporal dentro de TaskOrg no sustituye este paso.
4. Instala la actualización sobre la aplicación existente. Conserva la copia externa y evita desinstalar la aplicación o borrar sus datos antes de comprobarla.
5. Si necesitas recuperar los datos o cambiar de móvil, abre **Importar copia de seguridad**, selecciona el JSON y revisa el nombre, la fecha y los recuentos antes de confirmar.

La importación **sustituye** el contenido del dispositivo; no combina dos bases de datos. Exporta primero el contenido actual si quieres conservar ambas versiones. Una actualización normal de la misma aplicación debería mantener sus datos: restaurar la copia solo es necesario si faltan o cambias de dispositivo. La instalación nativa debe conservar el identificador de aplicación y la firma correspondiente; Expo Go y una aplicación independiente usan almacenamientos distintos.

## Qué incluye

- Proyectos y sus notas, colores, iconos, orden, fijados y estado archivado.
- Columnas, hitos, tareas y todas sus relaciones.
- Notas de tareas, fechas, prioridades, completadas y archivadas.
- Reglas de repetición e historial de ocurrencias completadas u omitidas.
- Anotaciones de la bandeja, eventos y las tres secciones de cada revisión diaria.
- Áreas, identificadores y marcas de tiempo de todos los registros, incluso registros ocultos que permanezcan en la base de datos.
- Idioma y tema en las copias creadas desde Configuración con esta versión. Las copias antiguas que no incluyen preferencias mantienen las del dispositivo de destino.

El archivo es JSON legible, sin cifrado. No es una sincronización automática entre dispositivos.

## Comprobaciones de integridad

La exportación espera a los guardados pendientes de notas y lee todas las tablas dentro de una transacción. Cada archivo recibe un nombre con fecha y hora para evitar sobrescribir otra copia del mismo día.

La restauración valida el formato, rechaza versiones o campos que no puede interpretar y comprueba las relaciones de la base de datos. Si falla alguna inserción o relación, se revierte la transacción completa. Las copias antiguas reciben valores compatibles para los campos añadidos posteriormente.

Los archivos se procesan en memoria: las copias excepcionalmente grandes necesitan memoria disponible en el móvil. Las pruebas automatizadas comprueban datos y relaciones; la selección de archivos y el menú de compartir también deben verificarse en dispositivos reales.
