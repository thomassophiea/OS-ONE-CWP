import type { Messages } from "./en";

/**
 * Japanese. です・ます調, kept short. Device-facing names stay in English so
 * the instruction matches what the guest sees on their own screen.
 */
export const ja: Messages = {
  common: {
    portalName: "OS-ONE-CWP",
    languageLabel: "言語",
    continue: "続ける",
    back: "戻る",
    copy: "コピー",
    copied: "コピーしました",
    loading: "読み込み中…",
    optional: "任意",
    required: "必須",
  },

  landing: {
    title: "ゲスト Wi-Fi ポータル",
    body: "ゲスト用の無線ネットワークに接続すると、サインインページが自動的に開きます。",
  },

  entry: {
    title: "ゲスト Wi-Fi",
    body: "インターネットに接続するには、ブラウザで任意のウェブページを開いてください。利用規約に同意する画面に戻ります。",
    hint: "何も表示されない場合は、Wi-Fi をいったん切断して接続し直してください。",
  },

  consent: {
    title: "ゲスト Wi-Fi アクセス",
    subtitle: "利用規約をご確認のうえ同意すると接続できます。",
    networkLabel: "ネットワーク",
    deviceLabel: "デバイス",
    terms:
      "このゲスト用無線ネットワークを利用することで、適法かつ責任ある方法でサービスを使用することに同意したものとみなされます。通信はセキュリティおよび運用の目的で監視・記録される場合があります。本サービスは無保証で提供され、アクセス権はいつでも取り消される場合があります。",
    agree: "上記の利用規約を読み、同意します。",
    submitOpen: "インターネットに接続",
    tickToContinue: "続けるには上のチェックボックスをオンにしてください。",
    destinationLost:
      "表示していたページを安全に復元できなかったため、接続後はこの画面に戻ります。",
    or: "または",
  },

  privacy: {
    checkbox: "個人データを保存しない",
    explainer:
      "ここに入力した内容（氏名・メールアドレス・電話番号）は接続のためだけに使用され、保存されることはありません。ネットワークの運用に必要な技術情報（デバイス識別子など）は引き続き記録されます。",
    activeTitle: "個人データは保存されません",
    activeBody:
      "ネットワークは通常どおりご利用いただけます。入力した内容はこのセッション終了後に残りません。",
    fieldsNotStored: "保存しません",
  },

  fields: {
    heading: "お客様の情報",
    subheading: "アクセスを許可するために使用します。",
    fullName: { label: "氏名", placeholder: "山田 太郎" },
    email: { label: "メールアドレス", placeholder: "you@example.com" },
    phone: { label: "電話番号", placeholder: "090-0000-0000" },
    company: { label: "会社名", placeholder: "株式会社サンプル" },
    roomNumber: { label: "部屋番号", placeholder: "204" },
    validation: {
      required: "{field}は必須です。",
      tooLong: "{field}が長すぎます。",
      email: "有効なメールアドレスを入力してください。",
      phone: "有効な電話番号を入力してください。",
      invalid: "{field}を確認して、もう一度お試しください。",
    },
  },

  secureOffer: {
    title: "セキュアゲストアクセス",
    body: "セキュリティを高め自動的に再接続できるよう、このデバイスを暗号化された Wi-Fi ネットワークに設定できます。",
    submit: "同意してセキュアに接続",
    note: "先にインターネットに接続してから、切り替えをご案内します。",
  },

  success: {
    title: "接続しました",
    forwarding: "元のページに戻っています…",
    connected: "デバイスがネットワークに接続されました。",
    networkLabel: "ネットワーク",
    deviceLabel: "デバイス",
    authorizedLabel: "承認日時",
    sessionLabel: "セッション",
    continuingIn: "{seconds} 秒後に続行します",
    goNow: "今すぐ移動",
  },

  secure: {
    connectedTitle: "接続しました",
    connectedOn: "{ssid} でインターネットに接続しています。",
    connectedGeneric: "ゲストネットワークでインターネットに接続しています。",
    title: "セキュアゲストアクセス",
    subtitle:
      "暗号化された Wi-Fi ネットワークを使うと、セキュリティが高まり自動的に再接続できます。",
    preparing: "セキュア設定を準備しています…",
    unavailableTitle: "セキュア Wi-Fi の設定を利用できません",
    unavailableBody:
      "セキュアネットワークの設定を取得できませんでした。ゲストアクセスには影響ありません。",
    unavailableStart:
      "セキュア設定を開始できませんでした。ゲストアクセスには影響ありません。",
    unavailableGeneric:
      "セキュア Wi-Fi の設定は現在利用できません。ゲストアクセスには影響ありません。",
    continueToInternet: "インターネットへ進む",
    skip: "スキップしてインターネットへ",
    closeAnyTime: "このページはいつでも閉じられます。ゲストアクセスは有効なままです。",
    onSecureTitle: "{ssid} に接続しました",
    onSecureBody:
      "このデバイスがセキュアネットワークに接続されたことをネットワーク側で確認しました。",
    waiting: "{ssid} 上にこのデバイスが現れるのを待っています…",
    exhausted:
      "確認を終了しました。デバイスがプライベート Wi-Fi アドレスを使用している場合、こちらからは切り替えを確認できません。Wi-Fi 設定を開いて {ssid} に接続されているかご確認ください。",
    unknown:
      "こちらからは切り替えを確認できません。Wi-Fi 設定を開いて {ssid} に接続されているかご確認ください。",
  },

  handoff: {
    title: "先にひとつ操作が必要です",
    body: "この Wi-Fi ウィンドウでは Wi-Fi 設定をインストールできません。続けるにはこのページを Safari で開いてください。すでにインターネットに接続しているため、問題なく読み込まれます。",
    openInSafari: "Safari で開く",
    stalledTitle: "開かない場合は、このリンクを Safari にコピーしてください。",
    copyLink: "リンクをコピー",
    linkNote: "このリンクは一度だけ有効で、数分で期限切れになります。",
    manualSetup: "手動設定",
    manualWorksHere: "手動設定はこのウィンドウのまま行えます。",
  },

  methods: {
    setUpSecureWifi: "セキュア Wi-Fi を設定",
    installProfile: "Wi-Fi プロファイルをインストール",
    showQr: "QR コードを表示",
    manualSetup: "手動設定",
    downloadWindowsProfile: "Windows プロファイルをダウンロード",
    appleDescription: "{ssid} をこのデバイスに追加し、以降は自動的に接続します。",
    appleDescriptionMac: "{ssid} をこの Mac に追加し、以降は自動的に接続します。",
    qrDescriptionPrimary: "{ssid} に接続したいデバイスで読み取ってください。",
    qrDescriptionSecondary: "別のスマートフォンやタブレットで読み取って接続できます。",
    manualDescriptionPrimary: "Wi-Fi 設定から {ssid} に接続するための情報を表示します。",
    manualDescriptionSecondary: "ネットワーク名とパスワードを表示し、手動で入力します。",
    windowsDescription: "コマンド 1 つでインポートできる WLAN プロファイルです。",
    appleFollowUp:
      "Wi-Fi 設定をダウンロードしました。Settings を開き、画面の指示に従ってセキュア接続を完了してください。",
    macFollowUp:
      "Wi-Fi 設定をダウンロードしました。System Settings > General > VPN & Device Management を開き、ダウンロードしたプロファイルをインストールしてください。",
    windowsFollowUp:
      "プロファイルをダウンロードしました。ダウンロードフォルダーでコマンドプロンプトを開き、次を実行してください： netsh wlan add profile filename=\"secure-wifi.xml\"",
    manualFollowUp:
      "Wi-Fi 設定を開き、{ssid} を選んで、表示されたパスワードを入力してください。",
  },

  qr: {
    title: "読み取って {ssid} にセキュアに接続",
    handheld: "接続したいもう一方のデバイスで読み取ってください。",
    desktop: "接続したいスマートフォンやタブレットのカメラを開いてください。",
    alt: "{ssid} の Wi-Fi QR コード",
    cantScan: "読み取れない場合は手動設定へ",
  },

  manual: {
    title: "手動設定",
    networkLabel: "ネットワーク",
    securityLabel: "セキュリティ",
    passwordLabel: "パスワード",
    showPassword: "パスワードを表示",
    instructions:
      "Wi-Fi 設定を開き、{ssid} を選んで、上のパスワードを入力してください。",
    failed: "ネットワーク情報を取得できませんでした。",
  },

  security: {
    "wpa2-psk": "WPA2 Personal",
    "wpa3-sae": "WPA3 Personal",
    "wpa2-wpa3-psk": "WPA2/WPA3 Personal",
    open: "オープン",
    owe: "Enhanced Open (OWE)",
  },

  onboardingStatus: {
    OFFERED: "セキュア設定を利用できます",
    STARTED: "設定の準備ができました",
    PROFILE_DOWNLOADED: "Wi-Fi 設定をダウンロードしました",
    QR_DISPLAYED: "QR コードを表示しました",
    MANUAL_SETUP_VIEWED: "設定情報を表示しました",
    COMPLETED: "セキュアネットワークに接続しました",
    FAILED: "セキュア設定を完了できませんでした",
    EXPIRED: "セキュア設定のセッションが終了しました",
  },

  errors: {
    bad_request: {
      title: "このリンクは無効です",
      body: "接続要求が不完全でした。ネットワークを切断して接続し直し、もう一度お試しください。",
    },
    untrusted: {
      title: "この要求を検証できませんでした",
      body: "認識できないネットワークゲートウェイからの要求です。Wi-Fi に接続し直してもう一度お試しください。",
    },
    expired: {
      title: "このリンクは期限切れです",
      body: "サインインリンクは短時間しか有効ではありません。Wi-Fi に接続し直して新しいリンクを取得してください。",
    },
    no_session: {
      title: "セッションが終了しました",
      body: "Wi-Fi に接続し直して、最初からやり直してください。",
    },
    unsupported_gateway: {
      title: "このネットワークには対応していません",
      body: "このポータルは、お使いのネットワーク向けに設定されていません。ネットワーク管理者にお問い合わせください。",
    },
    consent: {
      title: "利用規約への同意が必要です",
      body: "サインインページで同意のチェックボックスをオンにし、接続を押してください。デバイスがこのページを自動的に開いた場合は、ブラウザを開いてもう一度お試しください。",
    },
    csrf: {
      title: "セッションを確認できませんでした",
      body: "安全のため、この送信を確認できませんでした。Wi-Fi に接続し直してもう一度お試しください。",
    },
    authorization_failed: {
      title: "接続を完了できませんでした",
      body: "ネットワークゲートウェイが要求を拒否しました。Wi-Fi に接続し直してお試しいただくか、ネットワーク管理者にお問い合わせください。",
    },
    revoked: {
      title: "ゲストアクセスが取り消されました",
      body: "このデバイスはゲストネットワークを利用できません。ネットワーク管理者にお問い合わせください。",
    },
    unavailable: {
      title: "ポータルは一時的に利用できません",
      body: "しばらくしてからもう一度お試しください。問題が続く場合はネットワーク管理者にお問い合わせください。",
    },
    handoff_invalid: {
      title: "この設定リンクは期限切れです",
      body: "セキュア設定のリンクは数分間のみ有効です。Wi-Fi サインイン画面に戻り、もう一度「Safari で開く」を押してください。",
    },
    handoff_used: {
      title: "この設定リンクは使用済みです",
      body: "各リンクは一度だけ有効です。Wi-Fi サインイン画面に戻り、「Safari で開く」を押して新しいリンクを取得してください。",
    },
    invalid_details: {
      title: "入力内容をご確認ください",
      body: "入力された情報の一部を受け付けられませんでした。サインインページに戻ってもう一度お試しください。",
    },
  },

  api: {
    noOnboardingSession: "このセキュア設定セッションは終了しました。",
    onboardingUnavailable:
      "このセキュア設定セッションは期限切れです。ゲストネットワークに接続し直して、最初からやり直してください。",
    rateLimited: "要求が多すぎます。しばらくしてからもう一度お試しください。",
    secureUnavailable: "このネットワークではセキュア Wi-Fi 設定を利用できません。",
    sessionEnded: "ゲストセッションが終了しました。接続し直してやり直してください。",
    notAuthorized: "セキュア Wi-Fi を設定する前に、ゲストネットワークへの接続を完了してください。",
    networkUnavailable:
      "セキュアネットワークの情報を読み取れませんでした。しばらくしてからお試しください。",
    unsupportedPlatform:
      "このデバイスはセキュア Wi-Fi 設定に対応していません。ゲストネットワークは引き続きご利用いただけます。",
    temporarilyUnavailable: "セキュア設定は一時的に利用できません。",
    methodNotSupportedProfile:
      "このデバイスでは Wi-Fi 構成プロファイルを使用できません。手動設定をご利用ください。",
    methodNotSupportedQr:
      "このネットワークでは Wi-Fi QR コードを使用できません。手動設定をご利用ください。",
    methodNotSupportedWindows:
      "このデバイスでは Windows の Wi-Fi プロファイルを使用できません。手動設定をご利用ください。",
    providerUnavailable: "セキュア Wi-Fi 設定を利用できません。",
    profileFailed: "Wi-Fi 設定ファイルを準備できませんでした。手動設定をお試しください。",
    qrFailed: "QR コードを準備できませんでした。手動設定をお試しください。",
    credentialFailed:
      "ネットワーク情報を取得できませんでした。ネットワーク管理者にお問い合わせください。",
    secureNetworkUnavailable: "セキュアネットワークを利用できません。",
  },
};
