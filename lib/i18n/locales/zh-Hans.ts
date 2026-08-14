import type { Messages } from "./en";

/**
 * Simplified Chinese.
 *
 * Short sentences, no honorific padding — a captive portal is scanned, not
 * read. Device-facing names (`Safari`, `Settings`, `netsh`, security modes)
 * stay in English because that is what the guest's own screen says.
 */
export const zhHans: Messages = {
  common: {
    portalName: "OS-ONE-CWP",
    languageLabel: "语言",
    continue: "继续",
    back: "返回",
    copy: "复制",
    copied: "已复制",
    loading: "加载中…",
    optional: "选填",
    required: "必填",
  },

  landing: {
    title: "访客 Wi-Fi 门户",
    body: "连接访客无线网络后，设备会自动打开登录页面。",
  },

  entry: {
    title: "访客 Wi-Fi",
    body: "要接入网络，请在浏览器中打开任意网页。系统会直接把您带回此处接受条款。",
    hint: "如果没有任何反应，请断开 Wi-Fi 后重新连接。",
  },

  consent: {
    title: "访客 Wi-Fi 接入",
    subtitle: "查看并接受使用条款即可上网。",
    networkLabel: "网络",
    deviceLabel: "设备",
    terms:
      "使用本访客无线网络，即表示您同意合法、负责任地使用该服务。出于安全和运营目的，流量可能会被监控和记录。本服务不提供任何担保，接入权限可能随时被撤销。",
    agree: "我已阅读并同意以上使用条款。",
    submitOpen: "连接到互联网",
    tickToContinue: "请勾选上方复选框以继续。",
    destinationLost: "我们无法安全地恢复您之前浏览的页面，连接后将返回此页面。",
    or: "或",
  },

  privacy: {
    checkbox: "不要保存我的个人数据",
    explainer:
      "您在此处填写的任何信息（姓名、电子邮箱或电话号码）仅用于为您开通网络，绝不会被保存。运行网络所需的技术信息（例如设备标识）仍会记录。",
    activeTitle: "不会保存您的个人数据",
    activeBody: "您仍可正常使用网络。本次会话结束后，您填写的内容都不会被保留。",
    fieldsNotStored: "不保存",
  },

  fields: {
    heading: "您的信息",
    subheading: "这些信息用于为您开通网络。",
    fullName: { label: "姓名", placeholder: "张三" },
    email: { label: "电子邮箱", placeholder: "you@example.com" },
    phone: { label: "电话号码", placeholder: "+86 138 0000 0000" },
    company: { label: "公司", placeholder: "示例有限公司" },
    roomNumber: { label: "房间号", placeholder: "204" },
    validation: {
      required: "请填写{field}。",
      tooLong: "{field}过长。",
      email: "请输入有效的电子邮箱地址。",
      phone: "请输入有效的电话号码。",
      invalid: "请检查{field}后重试。",
    },
  },

  secureOffer: {
    title: "安全访客接入",
    body: "为获得更好的安全性并自动重连，可将此设备设置到我们的加密 Wi-Fi 网络。",
    submit: "接受并安全连接",
    note: "您会先获得互联网访问权限，然后我们再协助您切换。",
  },

  success: {
    title: "已连接",
    forwarding: "正在返回您之前的页面…",
    connected: "您的设备现已接入网络。",
    networkLabel: "网络",
    deviceLabel: "设备",
    authorizedLabel: "授权时间",
    sessionLabel: "会话",
    continuingIn: "{seconds} 秒后继续",
    goNow: "立即前往",
  },

  secure: {
    connectedTitle: "已连接",
    connectedOn: "您已通过 {ssid} 接入互联网。",
    connectedGeneric: "您已通过访客网络接入互联网。",
    title: "安全访客接入",
    subtitle: "使用我们的加密 Wi-Fi 网络，获得更好的安全性并自动重连。",
    preparing: "正在准备安全设置…",
    unavailableTitle: "安全 Wi-Fi 设置不可用",
    unavailableBody: "我们无法读取安全网络的配置。您的访客接入不受影响。",
    unavailableStart: "无法启动安全设置。您的访客接入不受影响。",
    unavailableGeneric: "安全 Wi-Fi 设置暂时不可用。您的访客接入不受影响。",
    continueToInternet: "继续访问互联网",
    skip: "跳过并继续访问互联网",
    closeAnyTime: "您可以随时关闭此页面——访客接入将保持有效。",
    onSecureTitle: "您已接入 {ssid}",
    onSecureBody: "网络已确认此设备现已连接到安全网络。",
    waiting: "正在等待此设备出现在 {ssid} 上…",
    exhausted:
      "我们已停止检查。如果您的设备使用专用 Wi-Fi 地址，我们无法在此确认切换结果——请打开 Wi-Fi 设置查看是否已接入 {ssid}。",
    unknown: "我们无法在此确认切换结果。请打开 Wi-Fi 设置查看是否已接入 {ssid}。",
  },

  handoff: {
    title: "请先完成一步",
    body: "此 Wi-Fi 窗口无法安装 Wi-Fi 设置。请在 Safari 中打开此页面以继续——您已经联网，页面可以正常加载。",
    openInSafari: "在 Safari 中打开",
    stalledTitle: "没有打开？请复制此链接到 Safari。",
    copyLink: "复制链接",
    linkNote: "该链接仅可使用一次，几分钟后失效。",
    manualWorksHere: "手动设置可直接在此窗口完成，无需离开。",
  },

  methods: {
    setUpSecureWifi: "设置安全 Wi-Fi",
    installProfile: "安装 Wi-Fi 配置文件",
    showQr: "显示二维码",
    manualSetup: "手动设置",
    downloadWindowsProfile: "下载 Windows 配置文件",
    appleDescription: "将 {ssid} 添加到此设备，之后会自动连接。",
    appleDescriptionMac: "将 {ssid} 添加到这台 Mac，之后会自动连接。",
    qrDescriptionPrimary: "请用要连接 {ssid} 的设备扫描。",
    qrDescriptionSecondary: "用另一部手机或平板扫描即可加入。",
    manualDescriptionPrimary: "显示从 Wi-Fi 设置加入 {ssid} 所需的信息。",
    manualDescriptionSecondary: "显示网络名称和密码，由您自行输入。",
    windowsDescription: "一个可用单条命令导入的 WLAN 配置文件。",
    appleFollowUp: "Wi-Fi 设置已下载。请打开 Settings 并按照提示完成安全连接。",
    macFollowUp:
      "Wi-Fi 设置已下载。请打开 System Settings > General > VPN & Device Management 并安装已下载的配置文件。",
    windowsFollowUp:
      "配置文件已下载。请在下载文件夹中打开命令提示符并运行：netsh wlan add profile filename=\"secure-wifi.xml\"",
    manualFollowUp: "打开 Wi-Fi 设置，选择 {ssid}，然后输入显示的密码。",
  },

  qr: {
    title: "扫码安全加入 {ssid}",
    handheld: "请用要连接的另一台设备扫描。",
    desktop: "打开要连接的手机或平板的相机。",
    alt: "{ssid} 的 Wi-Fi 二维码",
    cantScan: "无法扫描？改用手动设置",
  },

  manual: {
    title: "手动设置",
    networkLabel: "网络",
    securityLabel: "安全类型",
    passwordLabel: "密码",
    showPassword: "显示密码",
    instructions: "打开 Wi-Fi 设置，选择 {ssid}，然后输入上方的密码。",
    failed: "无法获取网络信息。",
  },

  security: {
    "wpa2-psk": "WPA2 Personal",
    "wpa3-sae": "WPA3 Personal",
    "wpa2-wpa3-psk": "WPA2/WPA3 Personal",
    open: "开放",
    owe: "Enhanced Open (OWE)",
  },

  onboardingStatus: {
    OFFERED: "可进行安全设置",
    STARTED: "已准备好设置",
    PROFILE_DOWNLOADED: "Wi-Fi 设置已下载",
    QR_DISPLAYED: "已显示二维码",
    MANUAL_SETUP_VIEWED: "已显示设置信息",
    COMPLETED: "已连接到安全网络",
    FAILED: "安全设置未能完成",
    EXPIRED: "安全设置会话已结束",
  },

  errors: {
    bad_request: {
      title: "此链接无效",
      body: "连接请求不完整。请断开网络后重新连接并重试。",
    },
    untrusted: {
      title: "无法验证此请求",
      body: "该请求并非来自已识别的网络网关。请重新连接 Wi-Fi 后重试。",
    },
    expired: {
      title: "此链接已过期",
      body: "登录链接仅在短时间内有效。请重新连接 Wi-Fi 以获取新链接。",
    },
    no_session: {
      title: "您的会话已结束",
      body: "请重新连接 Wi-Fi 以重新开始。",
    },
    unsupported_gateway: {
      title: "不支持该网络",
      body: "此门户未针对您所连接的网络进行配置。请联系网络管理员。",
    },
    consent: {
      title: "您需要接受条款",
      body: "请在登录页面勾选同意框并点按“连接”。如果设备自动打开了此页面，请打开浏览器后重试。",
    },
    csrf: {
      title: "无法确认您的会话",
      body: "出于安全考虑，我们无法确认此次提交。请重新连接 Wi-Fi 后重试。",
    },
    authorization_failed: {
      title: "无法完成连接",
      body: "网络网关拒绝了此请求。请重新连接 Wi-Fi 后重试，或联系网络管理员。",
    },
    revoked: {
      title: "访客接入权限已被撤销",
      body: "此设备已不再允许接入访客网络。请联系网络管理员。",
    },
    unavailable: {
      title: "门户暂时不可用",
      body: "请稍候重试。如果问题持续，请联系网络管理员。",
    },
    handoff_invalid: {
      title: "此设置链接已过期",
      body: "安全设置链接仅在几分钟内有效。请返回 Wi-Fi 登录窗口并再次点按“在 Safari 中打开”。",
    },
    handoff_used: {
      title: "此设置链接已被使用",
      body: "每个链接只能使用一次。请返回 Wi-Fi 登录窗口并点按“在 Safari 中打开”获取新链接。",
    },
    invalid_details: {
      title: "请检查您的信息",
      body: "您填写的部分信息无法被接受。请返回登录页面后重试。",
    },
  },

  api: {
    noOnboardingSession: "此安全设置会话已结束。",
    onboardingUnavailable: "此安全设置会话已过期。请重新连接访客网络以重新开始。",
    rateLimited: "请求过于频繁。请稍候重试。",
    secureUnavailable: "此网络不提供安全 Wi-Fi 设置。",
    sessionEnded: "您的访客会话已结束。请重新连接以重新开始。",
    notAuthorized: "请先完成访客网络连接，再设置安全 Wi-Fi。",
    networkUnavailable: "无法读取安全网络的信息。请稍后重试。",
    unsupportedPlatform: "此设备不支持安全 Wi-Fi 设置。您仍可使用访客网络。",
    temporarilyUnavailable: "安全设置暂时不可用。",
    methodNotSupportedProfile: "此设备无法使用 Wi-Fi 配置文件。请改用手动设置。",
    methodNotSupportedQr: "此网络无法使用 Wi-Fi 二维码。请改用手动设置。",
    methodNotSupportedWindows: "此设备无法使用 Windows Wi-Fi 配置文件。请改用手动设置。",
    providerUnavailable: "安全 Wi-Fi 设置不可用。",
    profileFailed: "无法生成 Wi-Fi 设置文件。请改用手动设置。",
    qrFailed: "无法生成二维码。请改用手动设置。",
    credentialFailed: "无法获取网络信息。请联系网络管理员。",
    secureNetworkUnavailable: "安全网络不可用。",
  },
};
