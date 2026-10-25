import type { CoachLanguage } from "../coach-language.ts";

export const PRO_BUTTON_JA = "Pro になる";
export const PRO_BUTTON_EN = "Become Pro";
export const MANAGE_BUTTON_JA = "プランを管理";
export const MANAGE_BUTTON_EN = "Manage plan";

export function billingCopy(language: CoachLanguage) {
  if (language === "en") {
    return {
      becomePro: PRO_BUTTON_EN,
      manage: MANAGE_BUTTON_EN,
      notConfigured: "Billing is not configured yet. No charge was made.",
      checkoutFailed: "Could not open checkout. No charge was made.",
      portalFailed: "Could not open plan management.",
      noAccount: "There is no billing account yet.",
      returned: "Back from checkout. Pro turns on only after payment is confirmed.",
      canceled: "Checkout was canceled.",
      working: "Opening…",
    };
  }
  return {
    becomePro: PRO_BUTTON_JA,
    manage: MANAGE_BUTTON_JA,
    notConfigured: "決済はまだ設定されていません。請求は発生していません。",
    checkoutFailed: "決済画面を開けませんでした。請求は発生していません。",
    portalFailed: "プラン管理を開けませんでした。",
    noAccount: "まだ請求先がありません。",
    returned: "決済画面から戻りました。Pro になるのは、支払い確認のあとだけです。",
    canceled: "手続きをキャンセルしました。",
    working: "移動しています…",
  };
}

export function authCopy(language: CoachLanguage) {
  if (language === "en") {
    return {
      title: "Sign in",
      body: "Enter your email. We will send you a sign-in link.",
      email: "Email",
      submit: "Send sign-in link",
      sending: "Sending…",
      sent: "Check your email. Open the link to come back in this browser.",
      missing: "Sign-in is not configured yet.",
      failed: "Could not send a sign-in link.",
      invalid: "Check the email address.",
      callback: "That sign-in link did not work. Send it again.",
      back: "Back to the app",
    };
  }
  return {
    title: "ログイン",
    body: "メールアドレスを入力してください。ログイン用のリンクを送ります。",
    email: "メールアドレス",
    submit: "ログインリンクを送る",
    sending: "送信しています…",
    sent: "メールを確認してください。リンクを開くと、このブラウザに戻ります。",
    missing: "ログインはまだ設定されていません。",
    failed: "ログインリンクを送れませんでした。",
    invalid: "メールアドレスを確認してください。",
    callback: "ログインリンクが無効です。もう一度送ってください。",
    back: "アプリに戻る",
  };
}
