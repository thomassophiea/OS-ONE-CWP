/**
 * English — the source catalogue.
 *
 * Every other locale is typed against `Messages`, which is inferred from this
 * object. A missing or misspelled key in a translation is therefore a build
 * error, not a string that silently renders in English at three in the
 * afternoon in Osaka. That property is what makes "add a language" a small
 * lift: copy this file, translate the values, add one registry entry, and the
 * compiler tells you if you missed anything.
 *
 * What is deliberately *not* in here: SSIDs, security-mode identifiers, URLs,
 * API field names, `netsh`, `Settings`, product names. Those are identifiers,
 * not prose — translating them would produce instructions that do not match
 * what is on the guest's screen. Where a name has to appear inside a sentence
 * it arrives as a `{placeholder}`.
 */

export const en = {
  common: {
    portalName: "OS-ONE-CWP",
    languageLabel: "Language",
    continue: "Continue",
    back: "Back",
    copy: "Copy",
    copied: "Copied",
    loading: "Loading…",
    optional: "optional",
    required: "required",
  },

  landing: {
    title: "Guest Wi-Fi Portal",
    body: "Connect to the guest wireless network and your device will open the sign-in page automatically.",
  },

  entry: {
    title: "Guest Wi-Fi",
    body: "To get online, open any web page in your browser. You'll be brought straight back here to accept the terms.",
    hint: "If nothing happens, disconnect from the Wi-Fi network and reconnect.",
  },

  consent: {
    title: "Guest Wi-Fi Access",
    subtitle: "Review and accept the terms of use to get online.",
    networkLabel: "Network",
    deviceLabel: "Device",
    terms:
      "By using this guest wireless network you agree to use the service lawfully and responsibly. Traffic may be monitored and logged for security and operational purposes. Access is provided without warranty and may be withdrawn at any time.",
    agree: "I have read and agree to the terms of use above.",
    submitOpen: "Connect to the Internet",
    tickToContinue: "Tick the box above to continue.",
    destinationLost:
      "We could not safely restore the page you were visiting, so you will be returned here after connecting.",
    or: "or",
  },

  privacy: {
    checkbox: "Do not store my personal data",
    explainer:
      "Anything you type here — your name, email or phone number — is used only to get you online and is never saved. We still record the technical details needed to run the network, such as your device identifier.",
    activeTitle: "Your personal data won't be saved",
    activeBody:
      "You can still use the network normally. Nothing you typed will be kept after this session.",
    fieldsNotStored: "Not saved",
  },

  fields: {
    heading: "Your details",
    subheading: "These are used to give you access.",
    fullName: {
      label: "Full name",
      placeholder: "Alex Morgan",
    },
    email: {
      label: "Email address",
      placeholder: "you@example.com",
    },
    phone: {
      label: "Phone number",
      placeholder: "+1 555 010 0100",
    },
    company: {
      label: "Company",
      placeholder: "Acme Ltd",
    },
    roomNumber: {
      label: "Room number",
      placeholder: "204",
    },
    validation: {
      required: "{field} is required.",
      tooLong: "{field} is too long.",
      email: "Enter a valid email address.",
      phone: "Enter a valid phone number.",
      invalid: "Check {field} and try again.",
    },
  },

  secureOffer: {
    title: "Secure Guest Access",
    body: "For better security and automatic reconnect, set up this device on our encrypted Wi-Fi network.",
    submit: "Accept & Connect Securely",
    note: "You'll get internet access first, then we'll help you switch.",
  },

  success: {
    title: "You're connected",
    forwarding: "Taking you back to where you left off…",
    connected: "Your device now has network access.",
    networkLabel: "Network",
    deviceLabel: "Device",
    authorizedLabel: "Authorized",
    sessionLabel: "Session",
    continuingIn: "Continuing in {seconds}s",
    goNow: "go now",
  },

  secure: {
    connectedTitle: "You're connected",
    connectedOn: "You have internet access on {ssid}.",
    connectedGeneric: "You have internet access on the guest network.",
    title: "Secure Guest Access",
    subtitle: "Use our encrypted Wi-Fi network for better security and automatic reconnect.",
    preparing: "Preparing secure setup…",
    unavailableTitle: "Secure Wi-Fi setup is unavailable",
    unavailableBody:
      "We couldn't reach the secure network's configuration. Your guest access is unaffected.",
    unavailableStart: "We couldn't start secure setup. Your guest access is unaffected.",
    unavailableGeneric:
      "Secure Wi-Fi setup is unavailable right now. Your guest access is unaffected.",
    continueToInternet: "Continue to the internet",
    skip: "Skip and continue to the internet",
    closeAnyTime: "You can close this page at any time — your guest access stays active.",
    onSecureTitle: "You're on {ssid}",
    onSecureBody: "The network confirmed this device is now connected to the secure network.",
    waiting: "Waiting for this device to appear on {ssid}…",
    exhausted:
      "We stopped checking. If your device is set to use a private Wi-Fi address, we can't confirm the switch from here — open your Wi-Fi settings to see whether you're on {ssid}.",
    unknown:
      "We can't confirm the switch from here. Open your Wi-Fi settings to check whether you're on {ssid}.",
  },

  handoff: {
    title: "One step first",
    body: "This Wi-Fi window can't install Wi-Fi settings. Open this page in Safari to continue — you're already online, so it will load.",
    openInSafari: "Open in Safari",
    stalledTitle: "Didn't open? Copy this link into Safari.",
    copyLink: "Copy link",
    linkNote: "The link works once and expires in a few minutes.",
    manualSetup: "Manual Setup",
    manualWorksHere: "Manual setup works right here, without leaving this window.",
  },

  methods: {
    setUpSecureWifi: "Set Up Secure Wi-Fi",
    installProfile: "Install Wi-Fi Profile",
    showQr: "Show QR Code",
    manualSetup: "Manual Setup",
    downloadWindowsProfile: "Download Windows Profile",
    appleDescription: "Adds {ssid} to this device and connects automatically from now on.",
    appleDescriptionMac: "Adds {ssid} to this Mac and connects automatically from now on.",
    qrDescriptionPrimary: "Scan with the device you want to connect to {ssid}.",
    qrDescriptionSecondary: "Scan from another phone or tablet to join.",
    manualDescriptionPrimary: "Shows the details for joining {ssid} from your Wi-Fi settings.",
    manualDescriptionSecondary: "Show the network name and password to enter yourself.",
    windowsDescription: "A WLAN profile you can import with a single command.",
    appleFollowUp:
      "Wi-Fi setup downloaded. Open Settings and follow the prompts to finish connecting securely.",
    macFollowUp:
      "Wi-Fi setup downloaded. Open System Settings > General > VPN & Device Management and install the downloaded profile.",
    windowsFollowUp:
      "Profile downloaded. Open a Command Prompt in your Downloads folder and run: netsh wlan add profile filename=\"secure-wifi.xml\"",
    manualFollowUp: "Open Wi-Fi settings, choose {ssid}, and enter the password shown.",
  },

  qr: {
    title: "Scan to join {ssid} securely",
    handheld: "Scan this from the other device you want to connect.",
    desktop: "Open the camera on the phone or tablet you want to connect.",
    alt: "Wi-Fi QR code for {ssid}",
    cantScan: "Can't scan? Manual setup",
  },

  manual: {
    title: "Manual setup",
    networkLabel: "Network",
    securityLabel: "Security",
    passwordLabel: "Password",
    showPassword: "Show password",
    instructions: "Open your Wi-Fi settings, choose {ssid}, and enter the password above.",
    failed: "The network details couldn't be retrieved.",
  },

  security: {
    "wpa2-psk": "WPA2 Personal",
    "wpa3-sae": "WPA3 Personal",
    "wpa2-wpa3-psk": "WPA2/WPA3 Personal",
    open: "Open",
    owe: "Enhanced Open (OWE)",
  },

  onboardingStatus: {
    OFFERED: "Secure setup available",
    STARTED: "Ready to set up",
    PROFILE_DOWNLOADED: "Wi-Fi setup downloaded",
    QR_DISPLAYED: "QR code shown",
    MANUAL_SETUP_VIEWED: "Setup details shown",
    COMPLETED: "Connected to the secure network",
    FAILED: "Secure setup could not be completed",
    EXPIRED: "Secure setup session ended",
  },

  errors: {
    bad_request: {
      title: "This link isn't valid",
      body: "The connection request was incomplete. Disconnect from the network, reconnect, and try again.",
    },
    untrusted: {
      title: "We couldn't verify this request",
      body: "The request did not come from a recognised network gateway. Reconnect to the Wi-Fi network and try again.",
    },
    expired: {
      title: "This link has expired",
      body: "Sign-in links are only valid for a short time. Reconnect to the Wi-Fi network to get a fresh one.",
    },
    no_session: {
      title: "Your session has ended",
      body: "Reconnect to the Wi-Fi network to start again.",
    },
    unsupported_gateway: {
      title: "Network not supported",
      body: "This portal is not configured for the network you are connecting from. Please contact the network administrator.",
    },
    consent: {
      title: "You need to accept the terms",
      body: "Tick the agreement box on the sign-in page and press Connect. If your device opened this page automatically, open a browser and try again.",
    },
    csrf: {
      title: "Your session could not be confirmed",
      body: "For your security we could not confirm this form submission. Reconnect to the Wi-Fi network and try again.",
    },
    authorization_failed: {
      title: "We couldn't complete your connection",
      body: "The network gateway declined the request. Reconnect to the Wi-Fi network and try again, or contact the network administrator.",
    },
    revoked: {
      title: "Guest access has been withdrawn",
      body: "This device is no longer permitted on the guest network. Please contact the network administrator.",
    },
    unavailable: {
      title: "The portal is temporarily unavailable",
      body: "Please wait a moment and try again. If this continues, contact the network administrator.",
    },
    handoff_invalid: {
      title: "This setup link has expired",
      body: "Secure setup links are only valid for a few minutes. Go back to the Wi-Fi sign-in window and tap Open in Safari again.",
    },
    handoff_used: {
      title: "This setup link has already been used",
      body: "Each link works once. Go back to the Wi-Fi sign-in window and tap Open in Safari again to get a fresh one.",
    },
    invalid_details: {
      title: "Check your details",
      body: "Some of the information you entered couldn't be accepted. Go back to the sign-in page and try again.",
    },
  },

  api: {
    noOnboardingSession: "This secure setup session has ended.",
    onboardingUnavailable:
      "This secure setup session has expired. Reconnect to the guest network to start again.",
    rateLimited: "Too many requests. Wait a moment and try again.",
    secureUnavailable: "Secure Wi-Fi setup is not available on this network.",
    sessionEnded: "Your guest session has ended. Reconnect to start again.",
    notAuthorized: "Finish connecting to the guest network before setting up secure Wi-Fi.",
    networkUnavailable:
      "The secure network's details could not be read. Please try again shortly.",
    unsupportedPlatform:
      "Secure Wi-Fi setup is not supported on this device. You can still use the guest network.",
    temporarilyUnavailable: "Secure setup is temporarily unavailable.",
    methodNotSupportedProfile:
      "This device cannot use a Wi-Fi configuration profile. Use manual setup instead.",
    methodNotSupportedQr:
      "A Wi-Fi QR code cannot be used for this network. Use manual setup instead.",
    methodNotSupportedWindows:
      "This device cannot use a Windows Wi-Fi profile. Use manual setup instead.",
    providerUnavailable: "Secure Wi-Fi setup is unavailable.",
    profileFailed: "The Wi-Fi setup file could not be prepared. Try manual setup instead.",
    qrFailed: "The QR code could not be prepared. Try manual setup instead.",
    credentialFailed:
      "The network details could not be retrieved. Please contact the network administrator.",
    secureNetworkUnavailable: "The secure network is unavailable.",
  },
};

/**
 * The shape every locale must satisfy.
 *
 * Inferred from the English catalogue, deliberately *without* `as const`: with
 * it, every value narrows to its own literal type and a translation becomes a
 * type error simply for not being in English. Widened, the contract is exactly
 * the useful one — same keys, same nesting, values are strings — so a missing
 * or misspelled key still fails the build while a translated value does not.
 */
export type Messages = typeof en;
