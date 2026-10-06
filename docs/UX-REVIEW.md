# Revisión de claridad y uso de TaskOrg

Revisión del 27 de septiembre de 2026. Se ha examinado el código de navegación, captura, tareas, proyectos, notas, revisión diaria y configuración. Es una evaluación heurística de los recorridos y del guardado; no un estudio con usuarios ni una prueba visual en teléfonos reales.

## Hallazgos y cambios aplicados

| Recorrido | Problema observado | Cambio |
| --- | --- | --- |
| Conservar datos | La copia estaba detrás de Apariencia y no explicaba cómo conservarla fuera de la app. | Apartado propio al principio de Configuración, botón «Exportar todos mis datos», listado de contenido e instrucciones de guardado. |
| Restaurar | Se pedía reemplazar datos sin mostrar qué archivo se iba a recuperar. | Nombre, fecha y recuentos antes de confirmar; validación previa de formato y rechazo de información que esta versión no pueda recuperar. |
| Escribir notas | El guardado diferido podía cancelarse al abandonar un proyecto o una revisión. | Escrituras ordenadas que continúan al salir, indicación de guardado/error y reintento. La exportación espera a estos cambios. |
| Inicio | Fecha, títulos y tarjetas grandes repetían información y retrasaban la captura. La bandeja tenía prioridad sobre tareas vencidas. | Cabecera con fecha, recomendación compacta que prioriza vencidas y tareas de hoy, captura más arriba y accesos reducidos. |
| Bandeja | Cada anotación mostraba número, separador y dos botones grandes de igual peso. | Tocar la anotación permite organizarla; eliminar queda como icono secundario con confirmación. |
| Vocabulario | Se mezclaban «Inbox», «bandeja» y mensajes poco concretos. | «Bandeja» en la navegación en español y textos que explican dónde se guarda cada captura. |
| Tareas | La revisión diaria precedía a la creación de tareas y las completadas ocupaban espacio. La fecha de la creación rápida era implícita. | Creación al principio, texto «Nueva tarea para hoy…», completadas plegables y acceso compacto a la revisión al final. |
| Acceso a ajustes | Configuración solo estaba accesible directamente desde Inicio. | Acceso también desde Tareas, Bandeja y Proyectos, con etiqueta para lectores de pantalla. |
| Crear contenido | Pulsaciones rápidas podían duplicar anotaciones o proyectos; un fallo podía quedar sin explicar. | Bloqueo durante el guardado y mensajes de error manteniendo el texto. |
| Crear proyectos | Personalizar un proyecto recién creado mediante una búsqueda por nombre podía modificar otro del mismo nombre. | Color e icono se guardan en la misma transacción que el nuevo proyecto. |
| Proyectos archivados | La lista vacía invitaba a crear proyectos en vez de explicar su estado. | Mensaje específico y etiquetas accesibles para el cambio de vista y pestañas. |

## Criterios mantenidos

Se conserva la navegación principal, la organización por proyectos y el funcionamiento local sin cuenta. Los cambios utilizan los componentes y temas existentes y mantienen los textos en español e inglés. El calendario de selección de fecha en la edición de tareas sigue disponible.

## Validación y siguiente revisión en móvil

Las pruebas automatizadas cubren la exportación/restauración con contenido en todas las tablas, texto multilínea y Unicode, archivados, preferencias, copias antiguas, archivos inválidos, escrituras pendientes y errores de guardado. Se comprueban además TypeScript y la generación de los paquetes JavaScript para Android e iOS.

Pendiente de validación manual: exportar a Archivos en iPhone y a una carpeta externa en Android; restaurar en una instalación de prueba; escribir y volver rápidamente; probar teclado, tamaños de letra grandes, VoiceOver/TalkBack y tema oscuro. Las siguientes mejoras deberían decidirse después de observar esos recorridos en uso real.
