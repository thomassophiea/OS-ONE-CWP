import type { Messages } from "./en";

/** German. `Sie` throughout; device-facing names left untranslated. */
export const de: Messages = {
  common: {
    portalName: "OS-ONE-CWP",
    languageLabel: "Sprache",
    continue: "Weiter",
    back: "Zurück",
    copy: "Kopieren",
    copied: "Kopiert",
    loading: "Wird geladen…",
    optional: "optional",
    required: "erforderlich",
  },

  landing: {
    title: "Gäste-WLAN-Portal",
    body: "Verbinden Sie sich mit dem Gäste-WLAN – Ihr Gerät öffnet die Anmeldeseite automatisch.",
  },

  entry: {
    title: "Gäste-WLAN",
    body: "Um online zu gehen, öffnen Sie eine beliebige Webseite in Ihrem Browser. Sie werden direkt hierher zurückgeführt, um die Nutzungsbedingungen zu akzeptieren.",
    hint: "Wenn nichts passiert, trennen Sie die WLAN-Verbindung und verbinden Sie sich erneut.",
  },

  consent: {
    title: "Gäste-WLAN-Zugang",
    subtitle: "Lesen und akzeptieren Sie die Nutzungsbedingungen, um online zu gehen.",
    networkLabel: "Netzwerk",
    deviceLabel: "Gerät",
    terms:
      "Mit der Nutzung dieses Gäste-WLANs erklären Sie sich damit einverstanden, den Dienst rechtmäßig und verantwortungsvoll zu nutzen. Der Datenverkehr kann aus Sicherheits- und Betriebsgründen überwacht und protokolliert werden. Der Zugang wird ohne Gewähr bereitgestellt und kann jederzeit entzogen werden.",
    agree: "Ich habe die oben stehenden Nutzungsbedingungen gelesen und akzeptiere sie.",
    submitOpen: "Mit dem Internet verbinden",
    tickToContinue: "Aktivieren Sie das Kästchen oben, um fortzufahren.",
    destinationLost:
      "Wir konnten die zuvor besuchte Seite nicht sicher wiederherstellen. Sie kehren nach dem Verbinden hierher zurück.",
    or: "oder",
  },

  privacy: {
    checkbox: "Meine personenbezogenen Daten nicht speichern",
    explainer:
      "Alles, was Sie hier eingeben – Name, E-Mail-Adresse oder Telefonnummer – wird ausschließlich für den Verbindungsaufbau verwendet und niemals gespeichert. Technische Daten, die für den Netzbetrieb erforderlich sind, etwa die Kennung Ihres Geräts, werden weiterhin erfasst.",
    activeTitle: "Ihre personenbezogenen Daten werden nicht gespeichert",
    activeBody:
      "Sie können das Netzwerk normal nutzen. Nichts von dem, was Sie eingegeben haben, wird über diese Sitzung hinaus aufbewahrt.",
    fieldsNotStored: "Nicht gespeichert",
  },

  fields: {
    heading: "Ihre Angaben",
    subheading: "Sie dienen dazu, Ihnen Zugang zu gewähren.",
    fullName: { label: "Vollständiger Name", placeholder: "Alex Morgan" },
    email: { label: "E-Mail-Adresse", placeholder: "sie@beispiel.de" },
    phone: { label: "Telefonnummer", placeholder: "+49 151 00000000" },
    company: { label: "Unternehmen", placeholder: "Acme GmbH" },
    roomNumber: { label: "Zimmernummer", placeholder: "204" },
    validation: {
      required: "{field} ist erforderlich.",
      tooLong: "{field} ist zu lang.",
      email: "Geben Sie eine gültige E-Mail-Adresse ein.",
      phone: "Geben Sie eine gültige Telefonnummer ein.",
      invalid: "Prüfen Sie {field} und versuchen Sie es erneut.",
    },
  },

  secureOffer: {
    title: "Sicherer Gastzugang",
    body: "Für mehr Sicherheit und automatische Wiederverbindung richten Sie dieses Gerät in unserem verschlüsselten WLAN ein.",
    submit: "Akzeptieren und sicher verbinden",
    note: "Sie erhalten zuerst Internetzugang, danach helfen wir Ihnen beim Wechsel.",
  },

  success: {
    title: "Sie sind verbunden",
    forwarding: "Sie werden zurück zur vorherigen Seite gebracht…",
    connected: "Ihr Gerät hat jetzt Netzwerkzugang.",
    networkLabel: "Netzwerk",
    deviceLabel: "Gerät",
    authorizedLabel: "Autorisiert",
    sessionLabel: "Sitzung",
    continuingIn: "Weiter in {seconds} s",
    goNow: "jetzt fortfahren",
  },

  secure: {
    connectedTitle: "Sie sind verbunden",
    connectedOn: "Sie haben Internetzugang über {ssid}.",
    connectedGeneric: "Sie haben Internetzugang über das Gästenetzwerk.",
    title: "Sicherer Gastzugang",
    subtitle:
      "Nutzen Sie unser verschlüsseltes WLAN für mehr Sicherheit und automatische Wiederverbindung.",
    preparing: "Sichere Einrichtung wird vorbereitet…",
    unavailableTitle: "Die sichere WLAN-Einrichtung ist nicht verfügbar",
    unavailableBody:
      "Die Konfiguration des sicheren Netzwerks war nicht erreichbar. Ihr Gastzugang ist davon nicht betroffen.",
    unavailableStart:
      "Die sichere Einrichtung konnte nicht gestartet werden. Ihr Gastzugang ist davon nicht betroffen.",
    unavailableGeneric:
      "Die sichere WLAN-Einrichtung ist derzeit nicht verfügbar. Ihr Gastzugang ist davon nicht betroffen.",
    continueToInternet: "Weiter ins Internet",
    skip: "Überspringen und ins Internet",
    closeAnyTime:
      "Sie können diese Seite jederzeit schließen – Ihr Gastzugang bleibt aktiv.",
    onSecureTitle: "Sie sind in {ssid}",
    onSecureBody:
      "Das Netzwerk hat bestätigt, dass dieses Gerät jetzt mit dem sicheren Netzwerk verbunden ist.",
    waiting: "Warten, bis dieses Gerät in {ssid} erscheint…",
    exhausted:
      "Wir haben die Prüfung beendet. Wenn Ihr Gerät eine private WLAN-Adresse verwendet, können wir den Wechsel von hier aus nicht bestätigen – öffnen Sie Ihre WLAN-Einstellungen, um zu sehen, ob Sie in {ssid} sind.",
    unknown:
      "Wir können den Wechsel von hier aus nicht bestätigen. Öffnen Sie Ihre WLAN-Einstellungen, um zu prüfen, ob Sie in {ssid} sind.",
  },

  handoff: {
    title: "Zuerst ein Schritt",
    body: "Dieses WLAN-Fenster kann keine WLAN-Einstellungen installieren. Öffnen Sie diese Seite in Safari, um fortzufahren – Sie sind bereits online, sie wird also geladen.",
    openInSafari: "In Safari öffnen",
    stalledTitle: "Nichts passiert? Kopieren Sie diesen Link in Safari.",
    copyLink: "Link kopieren",
    linkNote: "Der Link funktioniert einmal und läuft in wenigen Minuten ab.",
    manualSetup: "Manuelle Einrichtung",
    manualWorksHere:
      "Die manuelle Einrichtung funktioniert direkt hier, ohne dieses Fenster zu verlassen.",
  },

  methods: {
    setUpSecureWifi: "Sicheres WLAN einrichten",
    installProfile: "WLAN-Profil installieren",
    showQr: "QR-Code anzeigen",
    manualSetup: "Manuelle Einrichtung",
    downloadWindowsProfile: "Windows-Profil herunterladen",
    appleDescription:
      "Fügt {ssid} zu diesem Gerät hinzu und verbindet sich künftig automatisch.",
    appleDescriptionMac:
      "Fügt {ssid} zu diesem Mac hinzu und verbindet sich künftig automatisch.",
    qrDescriptionPrimary: "Mit dem Gerät scannen, das Sie mit {ssid} verbinden möchten.",
    qrDescriptionSecondary: "Von einem anderen Telefon oder Tablet scannen, um beizutreten.",
    manualDescriptionPrimary:
      "Zeigt die Angaben, um {ssid} über Ihre WLAN-Einstellungen beizutreten.",
    manualDescriptionSecondary:
      "Netzwerknamen und Passwort anzeigen, um sie selbst einzugeben.",
    windowsDescription: "Ein WLAN-Profil, das Sie mit einem einzigen Befehl importieren können.",
    appleFollowUp:
      "WLAN-Einrichtung heruntergeladen. Öffnen Sie Settings und folgen Sie den Anweisungen, um die sichere Verbindung abzuschließen.",
    macFollowUp:
      "WLAN-Einrichtung heruntergeladen. Öffnen Sie System Settings > General > VPN & Device Management und installieren Sie das heruntergeladene Profil.",
    windowsFollowUp:
      "Profil heruntergeladen. Öffnen Sie eine Eingabeaufforderung in Ihrem Downloads-Ordner und führen Sie aus: netsh wlan add profile filename=\"secure-wifi.xml\"",
    manualFollowUp:
      "Öffnen Sie die WLAN-Einstellungen, wählen Sie {ssid} und geben Sie das angezeigte Passwort ein.",
  },

  qr: {
    title: "Scannen, um {ssid} sicher beizutreten",
    handheld: "Scannen Sie dies mit dem anderen Gerät, das Sie verbinden möchten.",
    desktop: "Öffnen Sie die Kamera des Telefons oder Tablets, das Sie verbinden möchten.",
    alt: "WLAN-QR-Code für {ssid}",
    cantScan: "Scannen nicht möglich? Manuelle Einrichtung",
  },

  manual: {
    title: "Manuelle Einrichtung",
    networkLabel: "Netzwerk",
    securityLabel: "Sicherheit",
    passwordLabel: "Passwort",
    showPassword: "Passwort anzeigen",
    instructions:
      "Öffnen Sie Ihre WLAN-Einstellungen, wählen Sie {ssid} und geben Sie das oben stehende Passwort ein.",
    failed: "Die Netzwerkdaten konnten nicht abgerufen werden.",
  },

  security: {
    "wpa2-psk": "WPA2 Personal",
    "wpa3-sae": "WPA3 Personal",
    "wpa2-wpa3-psk": "WPA2/WPA3 Personal",
    open: "Offen",
    owe: "Enhanced Open (OWE)",
  },

  onboardingStatus: {
    OFFERED: "Sichere Einrichtung verfügbar",
    STARTED: "Bereit zur Einrichtung",
    PROFILE_DOWNLOADED: "WLAN-Einrichtung heruntergeladen",
    QR_DISPLAYED: "QR-Code angezeigt",
    MANUAL_SETUP_VIEWED: "Einrichtungsdaten angezeigt",
    COMPLETED: "Mit dem sicheren Netzwerk verbunden",
    FAILED: "Die sichere Einrichtung konnte nicht abgeschlossen werden",
    EXPIRED: "Die sichere Einrichtungssitzung ist beendet",
  },

  errors: {
    bad_request: {
      title: "Dieser Link ist ungültig",
      body: "Die Verbindungsanfrage war unvollständig. Trennen Sie die Netzwerkverbindung, verbinden Sie sich erneut und versuchen Sie es noch einmal.",
    },
    untrusted: {
      title: "Wir konnten diese Anfrage nicht verifizieren",
      body: "Die Anfrage stammt nicht von einem bekannten Netzwerk-Gateway. Verbinden Sie sich erneut mit dem WLAN und versuchen Sie es noch einmal.",
    },
    expired: {
      title: "Dieser Link ist abgelaufen",
      body: "Anmeldelinks sind nur kurze Zeit gültig. Verbinden Sie sich erneut mit dem WLAN, um einen neuen zu erhalten.",
    },
    no_session: {
      title: "Ihre Sitzung ist beendet",
      body: "Verbinden Sie sich erneut mit dem WLAN, um von vorn zu beginnen.",
    },
    unsupported_gateway: {
      title: "Netzwerk nicht unterstützt",
      body: "Dieses Portal ist nicht für das Netzwerk konfiguriert, aus dem Sie sich verbinden. Wenden Sie sich an die Netzwerkadministration.",
    },
    consent: {
      title: "Sie müssen die Bedingungen akzeptieren",
      body: "Aktivieren Sie das Kästchen auf der Anmeldeseite und tippen Sie auf Verbinden. Wenn Ihr Gerät diese Seite automatisch geöffnet hat, öffnen Sie einen Browser und versuchen Sie es erneut.",
    },
    csrf: {
      title: "Ihre Sitzung konnte nicht bestätigt werden",
      body: "Aus Sicherheitsgründen konnten wir diese Übermittlung nicht bestätigen. Verbinden Sie sich erneut mit dem WLAN und versuchen Sie es noch einmal.",
    },
    authorization_failed: {
      title: "Wir konnten Ihre Verbindung nicht herstellen",
      body: "Das Netzwerk-Gateway hat die Anfrage abgelehnt. Verbinden Sie sich erneut mit dem WLAN und versuchen Sie es noch einmal, oder wenden Sie sich an die Netzwerkadministration.",
    },
    revoked: {
      title: "Der Gastzugang wurde entzogen",
      body: "Dieses Gerät ist im Gästenetzwerk nicht mehr zugelassen. Wenden Sie sich an die Netzwerkadministration.",
    },
    unavailable: {
      title: "Das Portal ist vorübergehend nicht verfügbar",
      body: "Warten Sie einen Moment und versuchen Sie es erneut. Wenden Sie sich an die Netzwerkadministration, falls das Problem bestehen bleibt.",
    },
    handoff_invalid: {
      title: "Dieser Einrichtungslink ist abgelaufen",
      body: "Links zur sicheren Einrichtung sind nur wenige Minuten gültig. Kehren Sie zum WLAN-Anmeldefenster zurück und tippen Sie erneut auf In Safari öffnen.",
    },
    handoff_used: {
      title: "Dieser Einrichtungslink wurde bereits verwendet",
      body: "Jeder Link funktioniert einmal. Kehren Sie zum WLAN-Anmeldefenster zurück und tippen Sie auf In Safari öffnen, um einen neuen zu erhalten.",
    },
    invalid_details: {
      title: "Prüfen Sie Ihre Angaben",
      body: "Einige der eingegebenen Angaben konnten nicht übernommen werden. Kehren Sie zur Anmeldeseite zurück und versuchen Sie es erneut.",
    },
  },

  api: {
    noOnboardingSession: "Diese sichere Einrichtungssitzung ist beendet.",
    onboardingUnavailable:
      "Diese sichere Einrichtungssitzung ist abgelaufen. Verbinden Sie sich erneut mit dem Gästenetzwerk, um von vorn zu beginnen.",
    rateLimited: "Zu viele Anfragen. Warten Sie einen Moment und versuchen Sie es erneut.",
    secureUnavailable: "Die sichere WLAN-Einrichtung ist in diesem Netzwerk nicht verfügbar.",
    sessionEnded: "Ihre Gastsitzung ist beendet. Verbinden Sie sich erneut, um von vorn zu beginnen.",
    notAuthorized:
      "Schließen Sie die Verbindung mit dem Gästenetzwerk ab, bevor Sie sicheres WLAN einrichten.",
    networkUnavailable:
      "Die Daten des sicheren Netzwerks konnten nicht gelesen werden. Versuchen Sie es in Kürze erneut.",
    unsupportedPlatform:
      "Die sichere WLAN-Einrichtung wird auf diesem Gerät nicht unterstützt. Sie können das Gästenetzwerk weiterhin nutzen.",
    temporarilyUnavailable: "Die sichere Einrichtung ist vorübergehend nicht verfügbar.",
    methodNotSupportedProfile:
      "Dieses Gerät kann kein WLAN-Konfigurationsprofil verwenden. Nutzen Sie die manuelle Einrichtung.",
    methodNotSupportedQr:
      "Für dieses Netzwerk kann kein WLAN-QR-Code verwendet werden. Nutzen Sie die manuelle Einrichtung.",
    methodNotSupportedWindows:
      "Dieses Gerät kann kein Windows-WLAN-Profil verwenden. Nutzen Sie die manuelle Einrichtung.",
    providerUnavailable: "Die sichere WLAN-Einrichtung ist nicht verfügbar.",
    profileFailed:
      "Die WLAN-Einrichtungsdatei konnte nicht erstellt werden. Versuchen Sie die manuelle Einrichtung.",
    qrFailed: "Der QR-Code konnte nicht erstellt werden. Versuchen Sie die manuelle Einrichtung.",
    credentialFailed:
      "Die Netzwerkdaten konnten nicht abgerufen werden. Wenden Sie sich an die Netzwerkadministration.",
    secureNetworkUnavailable: "Das sichere Netzwerk ist nicht verfügbar.",
  },
};
