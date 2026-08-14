import type { Messages } from "./en";

/** French. `vous` throughout; device-facing names left untranslated. */
export const fr: Messages = {
  common: {
    portalName: "OS-ONE-CWP",
    languageLabel: "Langue",
    continue: "Continuer",
    back: "Retour",
    copy: "Copier",
    copied: "Copié",
    loading: "Chargement…",
    optional: "facultatif",
    required: "obligatoire",
  },

  landing: {
    title: "Portail Wi-Fi invité",
    body: "Connectez-vous au réseau sans fil invité et votre appareil ouvrira automatiquement la page de connexion.",
  },

  entry: {
    title: "Wi-Fi invité",
    body: "Pour vous connecter, ouvrez n'importe quelle page web dans votre navigateur. Vous reviendrez directement ici pour accepter les conditions.",
    hint: "Si rien ne se passe, déconnectez-vous du réseau Wi-Fi puis reconnectez-vous.",
  },

  consent: {
    title: "Accès Wi-Fi invité",
    subtitle: "Consultez et acceptez les conditions d'utilisation pour vous connecter.",
    networkLabel: "Réseau",
    deviceLabel: "Appareil",
    terms:
      "En utilisant ce réseau sans fil invité, vous acceptez d'utiliser le service de manière licite et responsable. Le trafic peut être surveillé et journalisé à des fins de sécurité et d'exploitation. L'accès est fourni sans garantie et peut être retiré à tout moment.",
    agree: "J'ai lu et j'accepte les conditions d'utilisation ci-dessus.",
    submitOpen: "Se connecter à Internet",
    tickToContinue: "Cochez la case ci-dessus pour continuer.",
    destinationLost:
      "Nous n'avons pas pu restaurer en toute sécurité la page que vous consultiez ; vous reviendrez donc ici après la connexion.",
    or: "ou",
  },

  privacy: {
    checkbox: "Ne pas conserver mes données personnelles",
    explainer:
      "Tout ce que vous saisissez ici — nom, adresse e-mail ou numéro de téléphone — sert uniquement à vous connecter et n'est jamais enregistré. Nous conservons toujours les données techniques nécessaires au fonctionnement du réseau, comme l'identifiant de votre appareil.",
    activeTitle: "Vos données personnelles ne seront pas conservées",
    activeBody:
      "Vous pouvez utiliser le réseau normalement. Rien de ce que vous avez saisi ne sera conservé après cette session.",
    fieldsNotStored: "Non conservé",
  },

  fields: {
    heading: "Vos informations",
    subheading: "Elles servent à vous donner accès au réseau.",
    fullName: { label: "Nom complet", placeholder: "Alex Morgan" },
    email: { label: "Adresse e-mail", placeholder: "vous@exemple.com" },
    phone: { label: "Numéro de téléphone", placeholder: "+33 6 00 00 00 00" },
    company: { label: "Société", placeholder: "Acme SARL" },
    roomNumber: { label: "Numéro de chambre", placeholder: "204" },
    validation: {
      required: "{field} est obligatoire.",
      tooLong: "{field} est trop long.",
      email: "Saisissez une adresse e-mail valide.",
      phone: "Saisissez un numéro de téléphone valide.",
      invalid: "Vérifiez {field} et réessayez.",
    },
  },

  secureOffer: {
    title: "Accès invité sécurisé",
    body: "Pour plus de sécurité et une reconnexion automatique, configurez cet appareil sur notre réseau Wi-Fi chiffré.",
    submit: "Accepter et se connecter en sécurité",
    note: "Vous aurez d'abord accès à Internet, puis nous vous aiderons à basculer.",
  },

  success: {
    title: "Vous êtes connecté",
    forwarding: "Retour à votre page précédente…",
    connected: "Votre appareil dispose maintenant d'un accès au réseau.",
    networkLabel: "Réseau",
    deviceLabel: "Appareil",
    authorizedLabel: "Autorisé",
    sessionLabel: "Session",
    continuingIn: "Reprise dans {seconds} s",
    goNow: "y aller maintenant",
  },

  secure: {
    connectedTitle: "Vous êtes connecté",
    connectedOn: "Vous avez accès à Internet sur {ssid}.",
    connectedGeneric: "Vous avez accès à Internet sur le réseau invité.",
    title: "Accès invité sécurisé",
    subtitle:
      "Utilisez notre réseau Wi-Fi chiffré pour plus de sécurité et une reconnexion automatique.",
    preparing: "Préparation de la configuration sécurisée…",
    unavailableTitle: "La configuration Wi-Fi sécurisée est indisponible",
    unavailableBody:
      "Nous n'avons pas pu accéder à la configuration du réseau sécurisé. Votre accès invité n'est pas affecté.",
    unavailableStart:
      "Nous n'avons pas pu démarrer la configuration sécurisée. Votre accès invité n'est pas affecté.",
    unavailableGeneric:
      "La configuration Wi-Fi sécurisée est indisponible pour le moment. Votre accès invité n'est pas affecté.",
    continueToInternet: "Continuer vers Internet",
    skip: "Ignorer et continuer vers Internet",
    closeAnyTime:
      "Vous pouvez fermer cette page à tout moment — votre accès invité reste actif.",
    onSecureTitle: "Vous êtes sur {ssid}",
    onSecureBody: "Le réseau a confirmé que cet appareil est maintenant connecté au réseau sécurisé.",
    waiting: "En attente de l'apparition de cet appareil sur {ssid}…",
    exhausted:
      "Nous avons arrêté de vérifier. Si votre appareil utilise une adresse Wi-Fi privée, nous ne pouvons pas confirmer le changement d'ici — ouvrez vos réglages Wi-Fi pour voir si vous êtes sur {ssid}.",
    unknown:
      "Nous ne pouvons pas confirmer le changement d'ici. Ouvrez vos réglages Wi-Fi pour vérifier si vous êtes sur {ssid}.",
  },

  handoff: {
    title: "Une étape d'abord",
    body: "Cette fenêtre Wi-Fi ne peut pas installer de réglages Wi-Fi. Ouvrez cette page dans Safari pour continuer — vous êtes déjà en ligne, elle se chargera.",
    openInSafari: "Ouvrir dans Safari",
    stalledTitle: "Rien ne s'est ouvert ? Copiez ce lien dans Safari.",
    copyLink: "Copier le lien",
    linkNote: "Le lien fonctionne une seule fois et expire dans quelques minutes.",
    manualSetup: "Configuration manuelle",
    manualWorksHere:
      "La configuration manuelle fonctionne ici même, sans quitter cette fenêtre.",
  },

  methods: {
    setUpSecureWifi: "Configurer le Wi-Fi sécurisé",
    installProfile: "Installer le profil Wi-Fi",
    showQr: "Afficher le code QR",
    manualSetup: "Configuration manuelle",
    downloadWindowsProfile: "Télécharger le profil Windows",
    appleDescription:
      "Ajoute {ssid} à cet appareil, qui s'y connectera automatiquement désormais.",
    appleDescriptionMac: "Ajoute {ssid} à ce Mac, qui s'y connectera automatiquement désormais.",
    qrDescriptionPrimary: "Scannez avec l'appareil que vous voulez connecter à {ssid}.",
    qrDescriptionSecondary: "Scannez depuis un autre téléphone ou une tablette pour rejoindre.",
    manualDescriptionPrimary:
      "Affiche les informations pour rejoindre {ssid} depuis vos réglages Wi-Fi.",
    manualDescriptionSecondary: "Affiche le nom du réseau et le mot de passe à saisir vous-même.",
    windowsDescription: "Un profil WLAN que vous pouvez importer avec une seule commande.",
    appleFollowUp:
      "Configuration Wi-Fi téléchargée. Ouvrez Settings et suivez les instructions pour terminer la connexion sécurisée.",
    macFollowUp:
      "Configuration Wi-Fi téléchargée. Ouvrez System Settings > General > VPN & Device Management et installez le profil téléchargé.",
    windowsFollowUp:
      "Profil téléchargé. Ouvrez une invite de commandes dans votre dossier Téléchargements et exécutez : netsh wlan add profile filename=\"secure-wifi.xml\"",
    manualFollowUp:
      "Ouvrez les réglages Wi-Fi, choisissez {ssid} et saisissez le mot de passe affiché.",
  },

  qr: {
    title: "Scannez pour rejoindre {ssid} en toute sécurité",
    handheld: "Scannez depuis l'autre appareil que vous voulez connecter.",
    desktop: "Ouvrez l'appareil photo du téléphone ou de la tablette à connecter.",
    alt: "Code QR Wi-Fi pour {ssid}",
    cantScan: "Impossible de scanner ? Configuration manuelle",
  },

  manual: {
    title: "Configuration manuelle",
    networkLabel: "Réseau",
    securityLabel: "Sécurité",
    passwordLabel: "Mot de passe",
    showPassword: "Afficher le mot de passe",
    instructions:
      "Ouvrez vos réglages Wi-Fi, choisissez {ssid} et saisissez le mot de passe ci-dessus.",
    failed: "Les informations du réseau n'ont pas pu être récupérées.",
  },

  security: {
    "wpa2-psk": "WPA2 Personal",
    "wpa3-sae": "WPA3 Personal",
    "wpa2-wpa3-psk": "WPA2/WPA3 Personal",
    open: "Ouvert",
    owe: "Enhanced Open (OWE)",
  },

  onboardingStatus: {
    OFFERED: "Configuration sécurisée disponible",
    STARTED: "Prêt à configurer",
    PROFILE_DOWNLOADED: "Configuration Wi-Fi téléchargée",
    QR_DISPLAYED: "Code QR affiché",
    MANUAL_SETUP_VIEWED: "Informations de configuration affichées",
    COMPLETED: "Connecté au réseau sécurisé",
    FAILED: "La configuration sécurisée n'a pas pu aboutir",
    EXPIRED: "La session de configuration sécurisée est terminée",
  },

  errors: {
    bad_request: {
      title: "Ce lien n'est pas valide",
      body: "La demande de connexion était incomplète. Déconnectez-vous du réseau, reconnectez-vous et réessayez.",
    },
    untrusted: {
      title: "Nous n'avons pas pu vérifier cette demande",
      body: "La demande ne provient pas d'une passerelle réseau reconnue. Reconnectez-vous au réseau Wi-Fi et réessayez.",
    },
    expired: {
      title: "Ce lien a expiré",
      body: "Les liens de connexion ne sont valides que peu de temps. Reconnectez-vous au réseau Wi-Fi pour en obtenir un nouveau.",
    },
    no_session: {
      title: "Votre session est terminée",
      body: "Reconnectez-vous au réseau Wi-Fi pour recommencer.",
    },
    unsupported_gateway: {
      title: "Réseau non pris en charge",
      body: "Ce portail n'est pas configuré pour le réseau depuis lequel vous vous connectez. Contactez l'administrateur réseau.",
    },
    consent: {
      title: "Vous devez accepter les conditions",
      body: "Cochez la case d'acceptation sur la page de connexion puis appuyez sur Se connecter. Si votre appareil a ouvert cette page automatiquement, ouvrez un navigateur et réessayez.",
    },
    csrf: {
      title: "Votre session n'a pas pu être confirmée",
      body: "Pour votre sécurité, nous n'avons pas pu confirmer cet envoi. Reconnectez-vous au réseau Wi-Fi et réessayez.",
    },
    authorization_failed: {
      title: "Nous n'avons pas pu établir votre connexion",
      body: "La passerelle réseau a refusé la demande. Reconnectez-vous au réseau Wi-Fi et réessayez, ou contactez l'administrateur réseau.",
    },
    revoked: {
      title: "L'accès invité a été retiré",
      body: "Cet appareil n'est plus autorisé sur le réseau invité. Contactez l'administrateur réseau.",
    },
    unavailable: {
      title: "Le portail est temporairement indisponible",
      body: "Patientez un instant et réessayez. Si cela persiste, contactez l'administrateur réseau.",
    },
    handoff_invalid: {
      title: "Ce lien de configuration a expiré",
      body: "Les liens de configuration sécurisée ne sont valides que quelques minutes. Revenez à la fenêtre de connexion Wi-Fi et appuyez de nouveau sur Ouvrir dans Safari.",
    },
    handoff_used: {
      title: "Ce lien de configuration a déjà été utilisé",
      body: "Chaque lien ne fonctionne qu'une fois. Revenez à la fenêtre de connexion Wi-Fi et appuyez sur Ouvrir dans Safari pour en obtenir un nouveau.",
    },
    invalid_details: {
      title: "Vérifiez vos informations",
      body: "Certaines informations saisies n'ont pas pu être acceptées. Revenez à la page de connexion et réessayez.",
    },
  },

  api: {
    noOnboardingSession: "Cette session de configuration sécurisée est terminée.",
    onboardingUnavailable:
      "Cette session de configuration sécurisée a expiré. Reconnectez-vous au réseau invité pour recommencer.",
    rateLimited: "Trop de requêtes. Patientez un instant et réessayez.",
    secureUnavailable: "La configuration Wi-Fi sécurisée n'est pas disponible sur ce réseau.",
    sessionEnded: "Votre session invité est terminée. Reconnectez-vous pour recommencer.",
    notAuthorized:
      "Terminez la connexion au réseau invité avant de configurer le Wi-Fi sécurisé.",
    networkUnavailable:
      "Les informations du réseau sécurisé n'ont pas pu être lues. Réessayez dans un instant.",
    unsupportedPlatform:
      "La configuration Wi-Fi sécurisée n'est pas prise en charge sur cet appareil. Vous pouvez continuer à utiliser le réseau invité.",
    temporarilyUnavailable: "La configuration sécurisée est temporairement indisponible.",
    methodNotSupportedProfile:
      "Cet appareil ne peut pas utiliser de profil de configuration Wi-Fi. Utilisez la configuration manuelle.",
    methodNotSupportedQr:
      "Un code QR Wi-Fi ne peut pas être utilisé pour ce réseau. Utilisez la configuration manuelle.",
    methodNotSupportedWindows:
      "Cet appareil ne peut pas utiliser de profil Wi-Fi Windows. Utilisez la configuration manuelle.",
    providerUnavailable: "La configuration Wi-Fi sécurisée est indisponible.",
    profileFailed:
      "Le fichier de configuration Wi-Fi n'a pas pu être préparé. Essayez la configuration manuelle.",
    qrFailed: "Le code QR n'a pas pu être préparé. Essayez la configuration manuelle.",
    credentialFailed:
      "Les informations du réseau n'ont pas pu être récupérées. Contactez l'administrateur réseau.",
    secureNetworkUnavailable: "Le réseau sécurisé est indisponible.",
  },
};
