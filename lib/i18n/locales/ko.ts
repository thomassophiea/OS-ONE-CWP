import type { Messages } from "./en";

/** Korean. 합쇼체, kept short. Device-facing names stay in English. */
export const ko: Messages = {
  common: {
    portalName: "OS-ONE-CWP",
    languageLabel: "언어",
    continue: "계속",
    back: "뒤로",
    copy: "복사",
    copied: "복사됨",
    loading: "불러오는 중…",
    optional: "선택",
    required: "필수",
  },

  landing: {
    title: "게스트 Wi-Fi 포털",
    body: "게스트 무선 네트워크에 연결하면 로그인 페이지가 자동으로 열립니다.",
  },

  entry: {
    title: "게스트 Wi-Fi",
    body: "인터넷에 연결하려면 브라우저에서 아무 웹페이지나 열어 주십시오. 약관 동의 화면으로 바로 돌아옵니다.",
    hint: "아무 반응이 없으면 Wi-Fi 연결을 끊었다가 다시 연결해 주십시오.",
  },

  consent: {
    title: "게스트 Wi-Fi 접속",
    subtitle: "이용 약관을 확인하고 동의하면 인터넷을 사용할 수 있습니다.",
    networkLabel: "네트워크",
    deviceLabel: "기기",
    terms:
      "이 게스트 무선 네트워크를 사용하면 서비스를 합법적이고 책임감 있게 이용하는 데 동의하는 것으로 간주됩니다. 보안 및 운영 목적으로 트래픽이 모니터링·기록될 수 있습니다. 접속은 어떠한 보증도 없이 제공되며 언제든지 철회될 수 있습니다.",
    agree: "위 이용 약관을 읽었으며 이에 동의합니다.",
    submitOpen: "인터넷에 연결",
    tickToContinue: "계속하려면 위 확인란을 선택해 주십시오.",
    destinationLost:
      "보고 계시던 페이지를 안전하게 복원할 수 없어, 연결 후 이 화면으로 돌아옵니다.",
    or: "또는",
  },

  privacy: {
    checkbox: "내 개인정보를 저장하지 않음",
    explainer:
      "여기에 입력하신 내용(이름, 이메일, 전화번호)은 접속을 위해서만 사용되며 저장되지 않습니다. 네트워크 운영에 필요한 기기 식별자 등 기술 정보는 계속 기록됩니다.",
    activeTitle: "개인정보가 저장되지 않습니다",
    activeBody:
      "네트워크는 평소대로 사용하실 수 있습니다. 입력하신 내용은 이 세션이 끝난 뒤 남지 않습니다.",
    fieldsNotStored: "저장 안 함",
  },

  fields: {
    heading: "입력 정보",
    subheading: "접속 권한을 부여하는 데 사용됩니다.",
    fullName: { label: "이름", placeholder: "홍길동" },
    email: { label: "이메일 주소", placeholder: "you@example.com" },
    phone: { label: "전화번호", placeholder: "010-0000-0000" },
    company: { label: "회사", placeholder: "예시 주식회사" },
    roomNumber: { label: "객실 번호", placeholder: "204" },
    validation: {
      required: "{field}은(는) 필수입니다.",
      tooLong: "{field}이(가) 너무 깁니다.",
      email: "유효한 이메일 주소를 입력해 주십시오.",
      phone: "유효한 전화번호를 입력해 주십시오.",
      invalid: "{field}을(를) 확인한 뒤 다시 시도해 주십시오.",
    },
  },

  secureOffer: {
    title: "보안 게스트 접속",
    body: "보안을 강화하고 자동으로 다시 연결되도록, 이 기기를 암호화된 Wi-Fi 네트워크에 설정할 수 있습니다.",
    submit: "동의하고 보안 연결",
    note: "먼저 인터넷에 연결된 뒤 전환을 도와드립니다.",
  },

  success: {
    title: "연결되었습니다",
    forwarding: "이전 페이지로 돌아가는 중…",
    connected: "기기가 네트워크에 연결되었습니다.",
    networkLabel: "네트워크",
    deviceLabel: "기기",
    authorizedLabel: "승인 시각",
    sessionLabel: "세션",
    continuingIn: "{seconds}초 후 계속",
    goNow: "지금 이동",
  },

  secure: {
    connectedTitle: "연결되었습니다",
    connectedOn: "{ssid}에서 인터넷을 사용할 수 있습니다.",
    connectedGeneric: "게스트 네트워크에서 인터넷을 사용할 수 있습니다.",
    title: "보안 게스트 접속",
    subtitle: "암호화된 Wi-Fi 네트워크를 사용하면 보안이 강화되고 자동으로 다시 연결됩니다.",
    preparing: "보안 설정을 준비하는 중…",
    unavailableTitle: "보안 Wi-Fi 설정을 사용할 수 없습니다",
    unavailableBody:
      "보안 네트워크 구성을 가져오지 못했습니다. 게스트 접속에는 영향이 없습니다.",
    unavailableStart: "보안 설정을 시작하지 못했습니다. 게스트 접속에는 영향이 없습니다.",
    unavailableGeneric:
      "지금은 보안 Wi-Fi 설정을 사용할 수 없습니다. 게스트 접속에는 영향이 없습니다.",
    continueToInternet: "인터넷으로 계속",
    skip: "건너뛰고 인터넷으로 계속",
    closeAnyTime: "이 페이지는 언제든지 닫을 수 있으며, 게스트 접속은 계속 유지됩니다.",
    onSecureTitle: "{ssid}에 연결되었습니다",
    onSecureBody: "이 기기가 보안 네트워크에 연결되었음을 네트워크에서 확인했습니다.",
    waiting: "이 기기가 {ssid}에 나타나기를 기다리는 중…",
    exhausted:
      "확인을 중단했습니다. 기기가 비공개 Wi-Fi 주소를 사용하는 경우 여기에서는 전환을 확인할 수 없습니다. Wi-Fi 설정을 열어 {ssid}에 연결되었는지 확인해 주십시오.",
    unknown:
      "여기에서는 전환을 확인할 수 없습니다. Wi-Fi 설정을 열어 {ssid}에 연결되었는지 확인해 주십시오.",
  },

  handoff: {
    title: "먼저 한 단계가 필요합니다",
    body: "이 Wi-Fi 창에서는 Wi-Fi 설정을 설치할 수 없습니다. 계속하려면 이 페이지를 Safari에서 열어 주십시오. 이미 인터넷에 연결되어 있으므로 정상적으로 열립니다.",
    openInSafari: "Safari에서 열기",
    stalledTitle: "열리지 않으면 이 링크를 Safari에 복사해 주십시오.",
    copyLink: "링크 복사",
    linkNote: "이 링크는 한 번만 사용할 수 있으며 몇 분 후 만료됩니다.",
    manualWorksHere: "수동 설정은 이 창을 벗어나지 않고 바로 진행할 수 있습니다.",
  },

  methods: {
    setUpSecureWifi: "보안 Wi-Fi 설정",
    installProfile: "Wi-Fi 프로파일 설치",
    showQr: "QR 코드 표시",
    manualSetup: "수동 설정",
    downloadWindowsProfile: "Windows 프로파일 다운로드",
    appleDescription: "{ssid}을(를) 이 기기에 추가하고 이후 자동으로 연결합니다.",
    appleDescriptionMac: "{ssid}을(를) 이 Mac에 추가하고 이후 자동으로 연결합니다.",
    qrDescriptionPrimary: "{ssid}에 연결할 기기로 스캔해 주십시오.",
    qrDescriptionSecondary: "다른 휴대폰이나 태블릿으로 스캔하여 연결할 수 있습니다.",
    manualDescriptionPrimary: "Wi-Fi 설정에서 {ssid}에 연결하는 데 필요한 정보를 표시합니다.",
    manualDescriptionSecondary: "네트워크 이름과 비밀번호를 표시하여 직접 입력합니다.",
    windowsDescription: "명령 한 줄로 가져올 수 있는 WLAN 프로파일입니다.",
    appleFollowUp:
      "Wi-Fi 설정을 다운로드했습니다. Settings을 열고 안내에 따라 보안 연결을 완료해 주십시오.",
    macFollowUp:
      "Wi-Fi 설정을 다운로드했습니다. System Settings > General > VPN & Device Management를 열고 다운로드한 프로파일을 설치해 주십시오.",
    windowsFollowUp:
      "프로파일을 다운로드했습니다. 다운로드 폴더에서 명령 프롬프트를 열고 다음을 실행해 주십시오: netsh wlan add profile filename=\"secure-wifi.xml\"",
    manualFollowUp: "Wi-Fi 설정을 열고 {ssid}을(를) 선택한 뒤 표시된 비밀번호를 입력해 주십시오.",
  },

  qr: {
    title: "스캔하여 {ssid}에 안전하게 연결",
    handheld: "연결하려는 다른 기기로 스캔해 주십시오.",
    desktop: "연결하려는 휴대폰이나 태블릿의 카메라를 열어 주십시오.",
    alt: "{ssid} Wi-Fi QR 코드",
    cantScan: "스캔할 수 없나요? 수동 설정",
  },

  manual: {
    title: "수동 설정",
    networkLabel: "네트워크",
    securityLabel: "보안",
    passwordLabel: "비밀번호",
    showPassword: "비밀번호 표시",
    instructions: "Wi-Fi 설정을 열고 {ssid}을(를) 선택한 뒤 위 비밀번호를 입력해 주십시오.",
    failed: "네트워크 정보를 가져오지 못했습니다.",
  },

  security: {
    "wpa2-psk": "WPA2 Personal",
    "wpa3-sae": "WPA3 Personal",
    "wpa2-wpa3-psk": "WPA2/WPA3 Personal",
    open: "개방형",
    owe: "Enhanced Open (OWE)",
  },

  onboardingStatus: {
    OFFERED: "보안 설정 사용 가능",
    STARTED: "설정 준비 완료",
    PROFILE_DOWNLOADED: "Wi-Fi 설정 다운로드됨",
    QR_DISPLAYED: "QR 코드 표시됨",
    MANUAL_SETUP_VIEWED: "설정 정보 표시됨",
    COMPLETED: "보안 네트워크에 연결됨",
    FAILED: "보안 설정을 완료하지 못했습니다",
    EXPIRED: "보안 설정 세션이 종료되었습니다",
  },

  errors: {
    bad_request: {
      title: "이 링크는 유효하지 않습니다",
      body: "연결 요청이 불완전했습니다. 네트워크 연결을 끊고 다시 연결한 뒤 시도해 주십시오.",
    },
    untrusted: {
      title: "이 요청을 확인할 수 없습니다",
      body: "인식된 네트워크 게이트웨이에서 온 요청이 아닙니다. Wi-Fi에 다시 연결한 뒤 시도해 주십시오.",
    },
    expired: {
      title: "이 링크는 만료되었습니다",
      body: "로그인 링크는 짧은 시간만 유효합니다. Wi-Fi에 다시 연결하여 새 링크를 받아 주십시오.",
    },
    no_session: {
      title: "세션이 종료되었습니다",
      body: "Wi-Fi에 다시 연결하여 처음부터 시작해 주십시오.",
    },
    unsupported_gateway: {
      title: "지원되지 않는 네트워크입니다",
      body: "이 포털은 접속하신 네트워크용으로 구성되어 있지 않습니다. 네트워크 관리자에게 문의해 주십시오.",
    },
    consent: {
      title: "약관에 동의해야 합니다",
      body: "로그인 페이지에서 동의 확인란을 선택하고 연결을 눌러 주십시오. 기기가 이 페이지를 자동으로 열었다면 브라우저를 열고 다시 시도해 주십시오.",
    },
    csrf: {
      title: "세션을 확인할 수 없습니다",
      body: "보안을 위해 이 제출을 확인할 수 없었습니다. Wi-Fi에 다시 연결한 뒤 시도해 주십시오.",
    },
    authorization_failed: {
      title: "연결을 완료하지 못했습니다",
      body: "네트워크 게이트웨이가 요청을 거부했습니다. Wi-Fi에 다시 연결하여 시도하시거나 네트워크 관리자에게 문의해 주십시오.",
    },
    revoked: {
      title: "게스트 접속 권한이 철회되었습니다",
      body: "이 기기는 더 이상 게스트 네트워크를 사용할 수 없습니다. 네트워크 관리자에게 문의해 주십시오.",
    },
    unavailable: {
      title: "포털을 일시적으로 사용할 수 없습니다",
      body: "잠시 후 다시 시도해 주십시오. 문제가 계속되면 네트워크 관리자에게 문의해 주십시오.",
    },
    handoff_invalid: {
      title: "이 설정 링크는 만료되었습니다",
      body: "보안 설정 링크는 몇 분 동안만 유효합니다. Wi-Fi 로그인 창으로 돌아가 'Safari에서 열기'를 다시 눌러 주십시오.",
    },
    handoff_used: {
      title: "이 설정 링크는 이미 사용되었습니다",
      body: "각 링크는 한 번만 사용할 수 있습니다. Wi-Fi 로그인 창으로 돌아가 'Safari에서 열기'를 눌러 새 링크를 받아 주십시오.",
    },
    invalid_details: {
      title: "입력하신 정보를 확인해 주십시오",
      body: "입력하신 정보 중 일부를 처리할 수 없었습니다. 로그인 페이지로 돌아가 다시 시도해 주십시오.",
    },
  },

  api: {
    noOnboardingSession: "이 보안 설정 세션이 종료되었습니다.",
    onboardingUnavailable:
      "이 보안 설정 세션이 만료되었습니다. 게스트 네트워크에 다시 연결하여 처음부터 시작해 주십시오.",
    rateLimited: "요청이 너무 많습니다. 잠시 후 다시 시도해 주십시오.",
    secureUnavailable: "이 네트워크에서는 보안 Wi-Fi 설정을 사용할 수 없습니다.",
    sessionEnded: "게스트 세션이 종료되었습니다. 다시 연결하여 시작해 주십시오.",
    notAuthorized: "보안 Wi-Fi를 설정하기 전에 게스트 네트워크 연결을 완료해 주십시오.",
    networkUnavailable: "보안 네트워크 정보를 읽지 못했습니다. 잠시 후 다시 시도해 주십시오.",
    unsupportedPlatform:
      "이 기기에서는 보안 Wi-Fi 설정이 지원되지 않습니다. 게스트 네트워크는 계속 사용하실 수 있습니다.",
    temporarilyUnavailable: "보안 설정을 일시적으로 사용할 수 없습니다.",
    methodNotSupportedProfile:
      "이 기기에서는 Wi-Fi 구성 프로파일을 사용할 수 없습니다. 수동 설정을 이용해 주십시오.",
    methodNotSupportedQr:
      "이 네트워크에서는 Wi-Fi QR 코드를 사용할 수 없습니다. 수동 설정을 이용해 주십시오.",
    methodNotSupportedWindows:
      "이 기기에서는 Windows Wi-Fi 프로파일을 사용할 수 없습니다. 수동 설정을 이용해 주십시오.",
    providerUnavailable: "보안 Wi-Fi 설정을 사용할 수 없습니다.",
    profileFailed: "Wi-Fi 설정 파일을 준비하지 못했습니다. 수동 설정을 시도해 주십시오.",
    qrFailed: "QR 코드를 준비하지 못했습니다. 수동 설정을 시도해 주십시오.",
    credentialFailed: "네트워크 정보를 가져오지 못했습니다. 네트워크 관리자에게 문의해 주십시오.",
    secureNetworkUnavailable: "보안 네트워크를 사용할 수 없습니다.",
  },
};
