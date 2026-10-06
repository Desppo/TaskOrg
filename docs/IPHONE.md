# Probar TaskOrg en un iPhone

TaskOrg comparte la misma aplicación Expo / React Native en Android e iOS. Las tareas, proyectos, hitos, repeticiones, calendario y revisión diaria se guardan en SQLite en el dispositivo. No hace falta registrarse en TaskOrg.

## Opción para probar sin publicar ni pagar Apple Developer

1. Instala **Expo Go** desde la App Store y ábrelo una vez.
2. Conecta el iPhone y el ordenador a la misma red Wi-Fi.
3. En el ordenador, desde la carpeta del proyecto, ejecuta:

   ```powershell
   npm ci
   npm run dev:iphone
   ```

   Si ya tienes las dependencias instaladas, basta con el segundo comando.

4. Escanea el QR de la terminal usando **Cámara** del iPhone y pulsa **Abrir en Expo Go**.
5. Permite el acceso a la **red local** si iOS lo pregunta y espera a que se cargue la aplicación.

Puedes hacerlo desde Windows. No necesitas un Mac, Xcode, TestFlight ni una cuenta de Apple Developer. Mantén la terminal en ejecución mientras pruebas; se detiene con `Ctrl+C`. Los cambios de código se recargan en el teléfono.

El proyecto utiliza **Expo SDK 54**. La [documentación de compatibilidad de Expo](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/) confirma que SDK 54 dispone de Expo Go en la App Store para iPhone. No actualices a otro SDK sin revisar la compatibilidad del cliente instalado.

Esta modalidad abre TaskOrg dentro de Expo Go. No instala una app independiente y no ofrece una instalación permanente equivalente a un APK. Exporta una copia antes de borrar Expo Go, sus datos o cambiar a una instalación nativa; sus bases de datos no se comparten automáticamente.

## Si el QR no conecta

- Comprueba que ambos dispositivos están en la misma Wi-Fi, sin VPN ni aislamiento de clientes de una red de invitados.
- Revisa el permiso **Red local** de Expo Go en los ajustes del iPhone.
- Permite el acceso de Node.js a la red privada en el firewall de Windows si aparece el aviso.
- Si el ordenador tiene varias tarjetas de red, puedes indicar su IPv4 de Wi-Fi manualmente:

  ```powershell
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = '192.168.1.25'
  npx expo start --lan --go --clear
  ```

  Sustituye la IP de ejemplo por la de tu ordenador. Cierra esa terminal cuando termines o elimina la variable con `Remove-Item Env:REACT_NATIVE_PACKAGER_HOSTNAME`.

- Si aparece una incompatibilidad de SDK, comprueba primero la versión de Expo Go y consulta el enlace de compatibilidad anterior.

## Pasar tus datos desde Android

1. En Android, entra en **Ajustes → Exportar copia** y guarda o comparte el archivo JSON.
2. Lleva ese archivo al iPhone, por ejemplo mediante Archivos.
3. En TaskOrg del iPhone, entra en **Ajustes → Importar copia**, selecciona el JSON y confirma.

La importación **sustituye los datos del dispositivo de destino**. Si el iPhone ya tiene datos, exporta antes su copia. Se conservan tareas, proyectos, columnas, hitos, repeticiones, eventos, bandeja y revisiones. Las preferencias de tema e idioma son propias de cada dispositivo. No hay sincronización automática entre teléfonos.

## Qué comprobar en el teléfono

- Crear una tarea, elegir hoy/mañana/otra fecha y editar notas con el teclado abierto.
- Editar una repetición; en los campos numéricos usar **Ocultar teclado**.
- Desplazarse hasta el final de las listas: la barra inferior debe dejar visible el contenido.
- Cambiar idioma y tema; comprobar el calendario y abrir los menús de proyectos.
- Asignar una tarea a un hito, editarla y comprobar que conserva el hito.
- Exportar una copia a Archivos, importarla y volver a abrir la app.

## Instalación nativa opcional

La configuración incluye compilaciones para simulador, dispositivos registrados y distribución en tienda. No se ejecutan al probar con Expo Go.

| Comando | Destino | Requisito |
| --- | --- | --- |
| `npm run build:ios` | Bundle JavaScript de iOS | Node.js; no instala una app |
| `npm run ios` | Compilación local y simulador | Mac y Xcode |
| `npm run build:ios:simulator` | App de simulador compilada en EAS | Cuenta Expo; Mac para ejecutarla |
| `npm run build:ios:preview` | iPhone registrado | Cuenta Expo y Apple Developer |
| `npm run build:ipa` | IPA para TestFlight/App Store | Cuenta Expo y Apple Developer |

Para EAS, inicia sesión con `npx eas-cli@21.4.0 login` y vincula el proyecto con `npx eas-cli@21.4.0 init`. Para una preview física, registra el teléfono con `npx eas-cli@21.4.0 device:create` antes de compilar. Las credenciales se configuran interactivamente en EAS; no se guardan en el repositorio. Una compilación de simulador no se puede instalar en un iPhone.

La publicación requiere pasos adicionales de Apple y no forma parte de la prueba con Expo Go. Consulta las guías oficiales de [simuladores](https://docs.expo.dev/build-reference/simulators/) y [distribución interna](https://docs.expo.dev/build/internal-distribution/).

## Verificación desde el ordenador

```powershell
npm run type-check
npm test
npm run build
```

Las pruebas usan SQLite real en memoria y necesitan Node.js 22.13 o posterior. La exportación comprueba ambos bundles, pero no sustituye una prueba en un iPhone ni una compilación nativa con Xcode/EAS.

Comprobaciones realizadas el 17 de septiembre de 2026 desde Windows: TypeScript correcto, 11 pruebas aprobadas, Expo Doctor 18/18 y exportación de iOS y Android correcta. La auditoría de npm pasa el umbral de gravedad alta: 0 altas y 0 críticas. Quedan 15 avisos moderados, incluidas sus dependencias afectadas, derivados de `decode-uri-component` y `uuid`. No se ha forzado un cambio de SDK ni una sustitución incompatible de esas dependencias. Sigue pendiente la comprobación visual en un dispositivo Apple.
