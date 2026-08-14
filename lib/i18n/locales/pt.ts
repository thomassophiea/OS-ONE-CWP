import type { Messages } from "./en";

/** Portuguese. Neutral register that reads correctly in both pt-BR and pt-PT. */
export const pt: Messages = {
  common: {
    portalName: "OS-ONE-CWP",
    languageLabel: "Idioma",
    continue: "Continuar",
    back: "Voltar",
    copy: "Copiar",
    copied: "Copiado",
    loading: "A carregar…",
    optional: "opcional",
    required: "obrigatório",
  },

  landing: {
    title: "Portal de Wi-Fi para visitantes",
    body: "Ligue-se à rede sem fios para visitantes e o seu dispositivo abrirá a página de acesso automaticamente.",
  },

  entry: {
    title: "Wi-Fi para visitantes",
    body: "Para ficar online, abra qualquer página web no seu navegador. Voltará diretamente para aqui para aceitar os termos.",
    hint: "Se nada acontecer, desligue-se da rede Wi-Fi e ligue-se novamente.",
  },

  consent: {
    title: "Acesso Wi-Fi para visitantes",
    subtitle: "Leia e aceite os termos de utilização para ficar online.",
    networkLabel: "Rede",
    deviceLabel: "Dispositivo",
    terms:
      "Ao utilizar esta rede sem fios para visitantes, concorda em usar o serviço de forma lícita e responsável. O tráfego pode ser monitorizado e registado por motivos de segurança e operacionais. O acesso é fornecido sem garantia e pode ser retirado a qualquer momento.",
    agree: "Li e aceito os termos de utilização acima.",
    submitOpen: "Ligar à Internet",
    tickToContinue: "Marque a caixa acima para continuar.",
    destinationLost:
      "Não foi possível restaurar em segurança a página que estava a visitar, por isso voltará para aqui depois de se ligar.",
    or: "ou",
  },

  privacy: {
    checkbox: "Não guardar os meus dados pessoais",
    explainer:
      "Tudo o que escrever aqui — nome, e-mail ou telefone — é usado apenas para lhe dar acesso e nunca é guardado. Continuamos a registar os dados técnicos necessários ao funcionamento da rede, como o identificador do seu dispositivo.",
    activeTitle: "Os seus dados pessoais não serão guardados",
    activeBody:
      "Pode usar a rede normalmente. Nada do que escreveu será mantido depois desta sessão.",
    fieldsNotStored: "Não guardado",
  },

  fields: {
    heading: "Os seus dados",
    subheading: "São utilizados para lhe dar acesso.",
    fullName: { label: "Nome completo", placeholder: "Alex Morgan" },
    email: { label: "Endereço de e-mail", placeholder: "voce@exemplo.com" },
    phone: { label: "Número de telefone", placeholder: "+351 900 000 000" },
    company: { label: "Empresa", placeholder: "Acme Lda." },
    roomNumber: { label: "Número do quarto", placeholder: "204" },
    validation: {
      required: "{field} é obrigatório.",
      tooLong: "{field} é demasiado longo.",
      email: "Introduza um endereço de e-mail válido.",
      phone: "Introduza um número de telefone válido.",
      invalid: "Verifique {field} e tente novamente.",
    },
  },

  secureOffer: {
    title: "Acesso seguro para visitantes",
    body: "Para mais segurança e religação automática, configure este dispositivo na nossa rede Wi-Fi encriptada.",
    submit: "Aceitar e ligar em segurança",
    note: "Primeiro terá acesso à Internet e depois ajudamo-lo a mudar.",
  },

  success: {
    title: "Está ligado",
    forwarding: "A levá-lo de volta ao ponto onde estava…",
    connected: "O seu dispositivo tem agora acesso à rede.",
    networkLabel: "Rede",
    deviceLabel: "Dispositivo",
    authorizedLabel: "Autorizado",
    sessionLabel: "Sessão",
    continuingIn: "A continuar em {seconds} s",
    goNow: "ir agora",
  },

  secure: {
    connectedTitle: "Está ligado",
    connectedOn: "Tem acesso à Internet em {ssid}.",
    connectedGeneric: "Tem acesso à Internet na rede de visitantes.",
    title: "Acesso seguro para visitantes",
    subtitle:
      "Use a nossa rede Wi-Fi encriptada para mais segurança e religação automática.",
    preparing: "A preparar a configuração segura…",
    unavailableTitle: "A configuração de Wi-Fi segura não está disponível",
    unavailableBody:
      "Não foi possível aceder à configuração da rede segura. O seu acesso de visitante não é afetado.",
    unavailableStart:
      "Não foi possível iniciar a configuração segura. O seu acesso de visitante não é afetado.",
    unavailableGeneric:
      "A configuração de Wi-Fi segura não está disponível de momento. O seu acesso de visitante não é afetado.",
    continueToInternet: "Continuar para a Internet",
    skip: "Ignorar e continuar para a Internet",
    closeAnyTime:
      "Pode fechar esta página a qualquer momento — o seu acesso de visitante continua ativo.",
    onSecureTitle: "Está em {ssid}",
    onSecureBody: "A rede confirmou que este dispositivo está agora ligado à rede segura.",
    waiting: "A aguardar que este dispositivo apareça em {ssid}…",
    exhausted:
      "Deixámos de verificar. Se o seu dispositivo usar um endereço Wi-Fi privado, não conseguimos confirmar a mudança a partir daqui — abra as definições de Wi-Fi para ver se está em {ssid}.",
    unknown:
      "Não conseguimos confirmar a mudança a partir daqui. Abra as definições de Wi-Fi para verificar se está em {ssid}.",
  },

  handoff: {
    title: "Primeiro um passo",
    body: "Esta janela de Wi-Fi não consegue instalar definições de Wi-Fi. Abra esta página no Safari para continuar — já está online, por isso vai carregar.",
    openInSafari: "Abrir no Safari",
    stalledTitle: "Não abriu? Copie esta ligação para o Safari.",
    copyLink: "Copiar ligação",
    linkNote: "A ligação funciona uma vez e expira dentro de alguns minutos.",
    manualWorksHere:
      "A configuração manual funciona aqui mesmo, sem sair desta janela.",
  },

  methods: {
    setUpSecureWifi: "Configurar Wi-Fi segura",
    installProfile: "Instalar perfil de Wi-Fi",
    showQr: "Mostrar código QR",
    manualSetup: "Configuração manual",
    downloadWindowsProfile: "Transferir perfil do Windows",
    appleDescription:
      "Adiciona {ssid} a este dispositivo e liga-se automaticamente a partir de agora.",
    appleDescriptionMac:
      "Adiciona {ssid} a este Mac e liga-se automaticamente a partir de agora.",
    qrDescriptionPrimary: "Digitalize com o dispositivo que quer ligar a {ssid}.",
    qrDescriptionSecondary: "Digitalize a partir de outro telemóvel ou tablet para se ligar.",
    manualDescriptionPrimary:
      "Mostra os dados para se ligar a {ssid} a partir das definições de Wi-Fi.",
    manualDescriptionSecondary:
      "Mostrar o nome da rede e a palavra-passe para introduzir manualmente.",
    windowsDescription: "Um perfil WLAN que pode importar com um único comando.",
    appleFollowUp:
      "Configuração de Wi-Fi transferida. Abra Settings e siga as instruções para concluir a ligação segura.",
    macFollowUp:
      "Configuração de Wi-Fi transferida. Abra System Settings > General > VPN & Device Management e instale o perfil transferido.",
    windowsFollowUp:
      "Perfil transferido. Abra uma linha de comandos na pasta Transferências e execute: netsh wlan add profile filename=\"secure-wifi.xml\"",
    manualFollowUp:
      "Abra as definições de Wi-Fi, escolha {ssid} e introduza a palavra-passe mostrada.",
  },

  qr: {
    title: "Digitalize para se ligar a {ssid} em segurança",
    handheld: "Digitalize a partir do outro dispositivo que quer ligar.",
    desktop: "Abra a câmara do telemóvel ou tablet que quer ligar.",
    alt: "Código QR de Wi-Fi para {ssid}",
    cantScan: "Não consegue digitalizar? Configuração manual",
  },

  manual: {
    title: "Configuração manual",
    networkLabel: "Rede",
    securityLabel: "Segurança",
    passwordLabel: "Palavra-passe",
    showPassword: "Mostrar palavra-passe",
    instructions:
      "Abra as definições de Wi-Fi, escolha {ssid} e introduza a palavra-passe acima.",
    failed: "Não foi possível obter os dados da rede.",
  },

  security: {
    "wpa2-psk": "WPA2 Personal",
    "wpa3-sae": "WPA3 Personal",
    "wpa2-wpa3-psk": "WPA2/WPA3 Personal",
    open: "Aberta",
    owe: "Enhanced Open (OWE)",
  },

  onboardingStatus: {
    OFFERED: "Configuração segura disponível",
    STARTED: "Pronto para configurar",
    PROFILE_DOWNLOADED: "Configuração de Wi-Fi transferida",
    QR_DISPLAYED: "Código QR mostrado",
    MANUAL_SETUP_VIEWED: "Dados de configuração mostrados",
    COMPLETED: "Ligado à rede segura",
    FAILED: "Não foi possível concluir a configuração segura",
    EXPIRED: "A sessão de configuração segura terminou",
  },

  errors: {
    bad_request: {
      title: "Esta ligação não é válida",
      body: "O pedido de ligação estava incompleto. Desligue-se da rede, ligue-se novamente e tente outra vez.",
    },
    untrusted: {
      title: "Não foi possível verificar este pedido",
      body: "O pedido não veio de um gateway de rede reconhecido. Ligue-se novamente à rede Wi-Fi e tente outra vez.",
    },
    expired: {
      title: "Esta ligação expirou",
      body: "As ligações de acesso são válidas apenas por pouco tempo. Ligue-se novamente à rede Wi-Fi para obter uma nova.",
    },
    no_session: {
      title: "A sua sessão terminou",
      body: "Ligue-se novamente à rede Wi-Fi para recomeçar.",
    },
    unsupported_gateway: {
      title: "Rede não suportada",
      body: "Este portal não está configurado para a rede a partir da qual se está a ligar. Contacte o administrador da rede.",
    },
    consent: {
      title: "Tem de aceitar os termos",
      body: "Marque a caixa de aceitação na página de acesso e toque em Ligar. Se o seu dispositivo abriu esta página automaticamente, abra um navegador e tente outra vez.",
    },
    csrf: {
      title: "Não foi possível confirmar a sua sessão",
      body: "Por segurança, não conseguimos confirmar este envio. Ligue-se novamente à rede Wi-Fi e tente outra vez.",
    },
    authorization_failed: {
      title: "Não foi possível concluir a sua ligação",
      body: "O gateway de rede recusou o pedido. Ligue-se novamente à rede Wi-Fi e tente outra vez, ou contacte o administrador da rede.",
    },
    revoked: {
      title: "O acesso de visitante foi retirado",
      body: "Este dispositivo já não é permitido na rede de visitantes. Contacte o administrador da rede.",
    },
    unavailable: {
      title: "O portal está temporariamente indisponível",
      body: "Aguarde um momento e tente outra vez. Se continuar, contacte o administrador da rede.",
    },
    handoff_invalid: {
      title: "Esta ligação de configuração expirou",
      body: "As ligações de configuração segura são válidas apenas alguns minutos. Volte à janela de acesso Wi-Fi e toque novamente em Abrir no Safari.",
    },
    handoff_used: {
      title: "Esta ligação de configuração já foi utilizada",
      body: "Cada ligação funciona uma vez. Volte à janela de acesso Wi-Fi e toque em Abrir no Safari para obter uma nova.",
    },
    invalid_details: {
      title: "Verifique os seus dados",
      body: "Algumas das informações introduzidas não puderam ser aceites. Volte à página de acesso e tente outra vez.",
    },
  },

  api: {
    noOnboardingSession: "Esta sessão de configuração segura terminou.",
    onboardingUnavailable:
      "Esta sessão de configuração segura expirou. Ligue-se novamente à rede de visitantes para recomeçar.",
    rateLimited: "Demasiados pedidos. Aguarde um momento e tente outra vez.",
    secureUnavailable: "A configuração de Wi-Fi segura não está disponível nesta rede.",
    sessionEnded: "A sua sessão de visitante terminou. Ligue-se novamente para recomeçar.",
    notAuthorized:
      "Conclua a ligação à rede de visitantes antes de configurar a Wi-Fi segura.",
    networkUnavailable:
      "Não foi possível ler os dados da rede segura. Tente novamente dentro de momentos.",
    unsupportedPlatform:
      "A configuração de Wi-Fi segura não é suportada neste dispositivo. Pode continuar a usar a rede de visitantes.",
    temporarilyUnavailable: "A configuração segura está temporariamente indisponível.",
    methodNotSupportedProfile:
      "Este dispositivo não pode usar um perfil de configuração de Wi-Fi. Use a configuração manual.",
    methodNotSupportedQr:
      "Não é possível usar um código QR de Wi-Fi para esta rede. Use a configuração manual.",
    methodNotSupportedWindows:
      "Este dispositivo não pode usar um perfil de Wi-Fi do Windows. Use a configuração manual.",
    providerUnavailable: "A configuração de Wi-Fi segura não está disponível.",
    profileFailed:
      "Não foi possível preparar o ficheiro de configuração de Wi-Fi. Tente a configuração manual.",
    qrFailed: "Não foi possível preparar o código QR. Tente a configuração manual.",
    credentialFailed:
      "Não foi possível obter os dados da rede. Contacte o administrador da rede.",
    secureNetworkUnavailable: "A rede segura não está disponível.",
  },
};
