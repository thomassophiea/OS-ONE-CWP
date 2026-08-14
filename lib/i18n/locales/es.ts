import type { Messages } from "./en";

/**
 * Spanish.
 *
 * Neutral Latin-American/peninsular register, `usted`-free second person
 * ("acepta", "conéctese" avoided in favour of plain imperatives) because a
 * captive portal is read in a hurry.
 *
 * Names of things a guest will see on their own device are left alone —
 * `Safari`, `Settings`, `netsh`, the security-mode labels — so the instruction
 * matches the screen they are looking at.
 */
export const es: Messages = {
  common: {
    portalName: "OS-ONE-CWP",
    languageLabel: "Idioma",
    continue: "Continuar",
    back: "Atrás",
    copy: "Copiar",
    copied: "Copiado",
    loading: "Cargando…",
    optional: "opcional",
    required: "obligatorio",
  },

  landing: {
    title: "Portal de Wi-Fi para invitados",
    body: "Conéctate a la red inalámbrica de invitados y tu dispositivo abrirá la página de acceso automáticamente.",
  },

  entry: {
    title: "Wi-Fi para invitados",
    body: "Para conectarte, abre cualquier página web en tu navegador. Volverás aquí directamente para aceptar las condiciones.",
    hint: "Si no ocurre nada, desconéctate de la red Wi-Fi y vuelve a conectarte.",
  },

  consent: {
    title: "Acceso Wi-Fi para invitados",
    subtitle: "Revisa y acepta las condiciones de uso para conectarte.",
    networkLabel: "Red",
    deviceLabel: "Dispositivo",
    terms:
      "Al usar esta red inalámbrica de invitados aceptas utilizar el servicio de forma lícita y responsable. El tráfico puede ser supervisado y registrado por motivos de seguridad y operativos. El acceso se ofrece sin garantía y puede retirarse en cualquier momento.",
    agree: "He leído y acepto las condiciones de uso anteriores.",
    submitOpen: "Conectarse a Internet",
    tickToContinue: "Marca la casilla de arriba para continuar.",
    destinationLost:
      "No pudimos restaurar de forma segura la página que estabas viendo, así que volverás aquí después de conectarte.",
    or: "o",
  },

  privacy: {
    checkbox: "No guardar mis datos personales",
    explainer:
      "Todo lo que escribas aquí —tu nombre, correo electrónico o teléfono— se usa solo para darte acceso y nunca se guarda. Seguimos registrando los datos técnicos necesarios para operar la red, como el identificador de tu dispositivo.",
    activeTitle: "Tus datos personales no se guardarán",
    activeBody:
      "Puedes usar la red con normalidad. Nada de lo que escribas se conservará después de esta sesión.",
    fieldsNotStored: "No se guarda",
  },

  fields: {
    heading: "Tus datos",
    subheading: "Se utilizan para darte acceso.",
    fullName: { label: "Nombre completo", placeholder: "Alex Morgan" },
    email: { label: "Correo electrónico", placeholder: "tu@ejemplo.com" },
    phone: { label: "Teléfono", placeholder: "+34 600 000 000" },
    company: { label: "Empresa", placeholder: "Acme S.L." },
    roomNumber: { label: "Número de habitación", placeholder: "204" },
    validation: {
      required: "{field} es obligatorio.",
      tooLong: "{field} es demasiado largo.",
      email: "Introduce una dirección de correo válida.",
      phone: "Introduce un número de teléfono válido.",
      invalid: "Revisa {field} e inténtalo de nuevo.",
    },
  },

  secureOffer: {
    title: "Acceso seguro para invitados",
    body: "Para mayor seguridad y reconexión automática, configura este dispositivo en nuestra red Wi-Fi cifrada.",
    submit: "Aceptar y conectar de forma segura",
    note: "Primero tendrás acceso a Internet y después te ayudamos a cambiar.",
  },

  success: {
    title: "Ya estás conectado",
    forwarding: "Volviendo a donde lo dejaste…",
    connected: "Tu dispositivo ya tiene acceso a la red.",
    networkLabel: "Red",
    deviceLabel: "Dispositivo",
    authorizedLabel: "Autorizado",
    sessionLabel: "Sesión",
    continuingIn: "Continuando en {seconds} s",
    goNow: "ir ahora",
  },

  secure: {
    connectedTitle: "Ya estás conectado",
    connectedOn: "Tienes acceso a Internet en {ssid}.",
    connectedGeneric: "Tienes acceso a Internet en la red de invitados.",
    title: "Acceso seguro para invitados",
    subtitle: "Usa nuestra red Wi-Fi cifrada para mayor seguridad y reconexión automática.",
    preparing: "Preparando la configuración segura…",
    unavailableTitle: "La configuración de Wi-Fi segura no está disponible",
    unavailableBody:
      "No pudimos acceder a la configuración de la red segura. Tu acceso de invitado no se ve afectado.",
    unavailableStart:
      "No pudimos iniciar la configuración segura. Tu acceso de invitado no se ve afectado.",
    unavailableGeneric:
      "La configuración de Wi-Fi segura no está disponible ahora mismo. Tu acceso de invitado no se ve afectado.",
    continueToInternet: "Continuar a Internet",
    skip: "Omitir y continuar a Internet",
    closeAnyTime: "Puedes cerrar esta página cuando quieras: tu acceso de invitado sigue activo.",
    onSecureTitle: "Estás en {ssid}",
    onSecureBody: "La red ha confirmado que este dispositivo ya está conectado a la red segura.",
    waiting: "Esperando a que este dispositivo aparezca en {ssid}…",
    exhausted:
      "Hemos dejado de comprobarlo. Si tu dispositivo usa una dirección Wi-Fi privada, no podemos confirmar el cambio desde aquí: abre los ajustes de Wi-Fi para ver si estás en {ssid}.",
    unknown:
      "No podemos confirmar el cambio desde aquí. Abre los ajustes de Wi-Fi para comprobar si estás en {ssid}.",
  },

  handoff: {
    title: "Primero un paso",
    body: "Esta ventana de Wi-Fi no puede instalar ajustes de Wi-Fi. Abre esta página en Safari para continuar: ya tienes conexión, así que se cargará.",
    openInSafari: "Abrir en Safari",
    stalledTitle: "¿No se abrió? Copia este enlace en Safari.",
    copyLink: "Copiar enlace",
    linkNote: "El enlace funciona una sola vez y caduca en unos minutos.",
    manualWorksHere: "La configuración manual funciona aquí mismo, sin salir de esta ventana.",
  },

  methods: {
    setUpSecureWifi: "Configurar Wi-Fi segura",
    installProfile: "Instalar perfil de Wi-Fi",
    showQr: "Mostrar código QR",
    manualSetup: "Configuración manual",
    downloadWindowsProfile: "Descargar perfil de Windows",
    appleDescription: "Añade {ssid} a este dispositivo y se conectará automáticamente a partir de ahora.",
    appleDescriptionMac: "Añade {ssid} a este Mac y se conectará automáticamente a partir de ahora.",
    qrDescriptionPrimary: "Escanéalo con el dispositivo que quieres conectar a {ssid}.",
    qrDescriptionSecondary: "Escanéalo desde otro teléfono o tablet para unirte.",
    manualDescriptionPrimary:
      "Muestra los datos para conectarte a {ssid} desde los ajustes de Wi-Fi.",
    manualDescriptionSecondary: "Muestra el nombre de la red y la contraseña para introducirlos tú.",
    windowsDescription: "Un perfil WLAN que puedes importar con un solo comando.",
    appleFollowUp:
      "Configuración de Wi-Fi descargada. Abre Settings y sigue las indicaciones para terminar de conectarte de forma segura.",
    macFollowUp:
      "Configuración de Wi-Fi descargada. Abre System Settings > General > VPN & Device Management e instala el perfil descargado.",
    windowsFollowUp:
      "Perfil descargado. Abre una ventana de comandos en tu carpeta de descargas y ejecuta: netsh wlan add profile filename=\"secure-wifi.xml\"",
    manualFollowUp: "Abre los ajustes de Wi-Fi, elige {ssid} e introduce la contraseña mostrada.",
  },

  qr: {
    title: "Escanea para conectarte a {ssid} de forma segura",
    handheld: "Escanéalo desde el otro dispositivo que quieres conectar.",
    desktop: "Abre la cámara del teléfono o la tablet que quieres conectar.",
    alt: "Código QR de Wi-Fi para {ssid}",
    cantScan: "¿No puedes escanear? Configuración manual",
  },

  manual: {
    title: "Configuración manual",
    networkLabel: "Red",
    securityLabel: "Seguridad",
    passwordLabel: "Contraseña",
    showPassword: "Mostrar contraseña",
    instructions: "Abre los ajustes de Wi-Fi, elige {ssid} e introduce la contraseña de arriba.",
    failed: "No se pudieron obtener los datos de la red.",
  },

  security: {
    "wpa2-psk": "WPA2 Personal",
    "wpa3-sae": "WPA3 Personal",
    "wpa2-wpa3-psk": "WPA2/WPA3 Personal",
    open: "Abierta",
    owe: "Enhanced Open (OWE)",
  },

  onboardingStatus: {
    OFFERED: "Configuración segura disponible",
    STARTED: "Listo para configurar",
    PROFILE_DOWNLOADED: "Configuración de Wi-Fi descargada",
    QR_DISPLAYED: "Código QR mostrado",
    MANUAL_SETUP_VIEWED: "Datos de configuración mostrados",
    COMPLETED: "Conectado a la red segura",
    FAILED: "No se pudo completar la configuración segura",
    EXPIRED: "La sesión de configuración segura ha terminado",
  },

  errors: {
    bad_request: {
      title: "Este enlace no es válido",
      body: "La solicitud de conexión estaba incompleta. Desconéctate de la red, vuelve a conectarte e inténtalo de nuevo.",
    },
    untrusted: {
      title: "No pudimos verificar esta solicitud",
      body: "La solicitud no proviene de una pasarela de red reconocida. Vuelve a conectarte a la red Wi-Fi e inténtalo de nuevo.",
    },
    expired: {
      title: "Este enlace ha caducado",
      body: "Los enlaces de acceso solo son válidos durante poco tiempo. Vuelve a conectarte a la red Wi-Fi para obtener uno nuevo.",
    },
    no_session: {
      title: "Tu sesión ha terminado",
      body: "Vuelve a conectarte a la red Wi-Fi para empezar de nuevo.",
    },
    unsupported_gateway: {
      title: "Red no compatible",
      body: "Este portal no está configurado para la red desde la que te conectas. Ponte en contacto con el administrador de la red.",
    },
    consent: {
      title: "Debes aceptar las condiciones",
      body: "Marca la casilla de aceptación en la página de acceso y pulsa Conectar. Si tu dispositivo abrió esta página automáticamente, abre un navegador e inténtalo de nuevo.",
    },
    csrf: {
      title: "No se pudo confirmar tu sesión",
      body: "Por seguridad no pudimos confirmar este envío. Vuelve a conectarte a la red Wi-Fi e inténtalo de nuevo.",
    },
    authorization_failed: {
      title: "No pudimos completar tu conexión",
      body: "La pasarela de red rechazó la solicitud. Vuelve a conectarte a la red Wi-Fi e inténtalo de nuevo, o contacta con el administrador de la red.",
    },
    revoked: {
      title: "Se ha retirado el acceso de invitado",
      body: "Este dispositivo ya no puede usar la red de invitados. Ponte en contacto con el administrador de la red.",
    },
    unavailable: {
      title: "El portal no está disponible temporalmente",
      body: "Espera un momento e inténtalo de nuevo. Si continúa, contacta con el administrador de la red.",
    },
    handoff_invalid: {
      title: "Este enlace de configuración ha caducado",
      body: "Los enlaces de configuración segura solo son válidos unos minutos. Vuelve a la ventana de acceso Wi-Fi y pulsa Abrir en Safari otra vez.",
    },
    handoff_used: {
      title: "Este enlace de configuración ya se ha usado",
      body: "Cada enlace funciona una sola vez. Vuelve a la ventana de acceso Wi-Fi y pulsa Abrir en Safari para obtener uno nuevo.",
    },
    invalid_details: {
      title: "Revisa tus datos",
      body: "Parte de la información que introdujiste no se pudo aceptar. Vuelve a la página de acceso e inténtalo de nuevo.",
    },
  },

  api: {
    noOnboardingSession: "Esta sesión de configuración segura ha terminado.",
    onboardingUnavailable:
      "Esta sesión de configuración segura ha caducado. Vuelve a conectarte a la red de invitados para empezar de nuevo.",
    rateLimited: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
    secureUnavailable: "La configuración de Wi-Fi segura no está disponible en esta red.",
    sessionEnded: "Tu sesión de invitado ha terminado. Vuelve a conectarte para empezar de nuevo.",
    notAuthorized:
      "Termina de conectarte a la red de invitados antes de configurar la Wi-Fi segura.",
    networkUnavailable:
      "No se pudieron leer los datos de la red segura. Inténtalo de nuevo en un momento.",
    unsupportedPlatform:
      "La configuración de Wi-Fi segura no es compatible con este dispositivo. Puedes seguir usando la red de invitados.",
    temporarilyUnavailable: "La configuración segura no está disponible temporalmente.",
    methodNotSupportedProfile:
      "Este dispositivo no puede usar un perfil de configuración de Wi-Fi. Usa la configuración manual.",
    methodNotSupportedQr:
      "No se puede usar un código QR de Wi-Fi para esta red. Usa la configuración manual.",
    methodNotSupportedWindows:
      "Este dispositivo no puede usar un perfil de Wi-Fi de Windows. Usa la configuración manual.",
    providerUnavailable: "La configuración de Wi-Fi segura no está disponible.",
    profileFailed:
      "No se pudo preparar el archivo de configuración de Wi-Fi. Prueba con la configuración manual.",
    qrFailed: "No se pudo preparar el código QR. Prueba con la configuración manual.",
    credentialFailed:
      "No se pudieron obtener los datos de la red. Ponte en contacto con el administrador de la red.",
    secureNetworkUnavailable: "La red segura no está disponible.",
  },
};
