import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(site)/app-actions", () => ({ savePushSubscription: async () => ({ ok: true }), removePushSubscription: async () => ({ ok: true }) }));

import { inAppBrowser, iosShareAtTop, platform } from "./pwa";

const as = (userAgent: string, maxTouchPoints = 0) => vi.stubGlobal("navigator", { userAgent, maxTouchPoints });
afterEach(() => vi.unstubAllGlobals());

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1";
const IPHONE_INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 335.0.2.0.82 (iPhone15,2; iOS 17_5; en_NG)";
const IPHONE_FACEBOOK = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.97;FBBV/603361364]";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36";
const ANDROID_WEBVIEW = "Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36";
const ANDROID_TIKTOK = "Mozilla/5.0 (Linux; Android 13; TECNO KI5k; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 musical_ly_2023408040 BytedanceWebview/d8a21c6";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("which device and browser", () => {
  it("tells iPhone, Android and computers apart, including an iPad that says it's a Mac", () => {
    as(IPHONE_SAFARI);
    expect(platform()).toBe("ios");
    as(ANDROID_CHROME);
    expect(platform()).toBe("android");
    as(IPAD, 5);
    expect(platform()).toBe("ios");
    as(MAC_CHROME);
    expect(platform()).toBe("desktop");
  });

  it("spots the browsers inside other apps, which can't install Basket", () => {
    as(IPHONE_INSTAGRAM);
    expect(inAppBrowser()).toBe("Instagram");
    as(IPHONE_FACEBOOK);
    expect(inAppBrowser()).toBe("Facebook");
    as(ANDROID_TIKTOK);
    expect(inAppBrowser()).toBe("TikTok");
    as(ANDROID_WEBVIEW);
    expect(inAppBrowser()).toBe("this app");
  });

  it("leaves real browsers alone", () => {
    for (const ua of [IPHONE_SAFARI, IPHONE_CHROME, ANDROID_CHROME, MAC_CHROME]) {
      as(ua);
      expect(inAppBrowser()).toBeNull();
    }
  });

  it("knows Chrome on iPhone keeps Share at the top", () => {
    as(IPHONE_CHROME);
    expect(iosShareAtTop()).toBe(true);
    as(IPHONE_SAFARI);
    expect(iosShareAtTop()).toBe(false);
  });
});
