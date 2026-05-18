"use client";

import Script from "next/script";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { googleLoginAction } from "@/app/(main)/actions";
import { type FormActionState } from "@/lib/marketplace";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenClient = {
  requestAccessToken(options?: { prompt?: string }): void;
};

type GoogleButtonConfiguration = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
};

type GooglePromptMomentNotification = {
  isDisplayed?: () => boolean;
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
};

type GoogleAccountsId = {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: "popup" | "redirect";
    auto_select?: boolean;
    context?: "signin" | "signup" | "use";
    cancel_on_tap_outside?: boolean;
    itp_support?: boolean;
    use_fedcm_for_button?: boolean;
    button_auto_select?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: GoogleButtonConfiguration): void;
  prompt(callback?: (notification: GooglePromptMomentNotification) => void): void;
  cancel(): void;
};

type GoogleOAuth2 = {
  initTokenClient(options: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: () => void;
    include_granted_scopes?: boolean;
  }): GoogleTokenClient;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
        oauth2?: GoogleOAuth2;
      };
    };
  }
}

const initialState: FormActionState = {
  message: null,
};

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const googleDevMode = process.env.NEXT_PUBLIC_GOOGLE_AUTH_DEV_MODE === "true";
const googlePhoneScope =
  "https://www.googleapis.com/auth/user.phonenumbers.read";
const googleSuggestionDismissedKey =
  "classified-marketplace-google-suggestion-dismissed-until";
const googleSuggestionDismissMs = 24 * 60 * 60 * 1000;

export function GoogleAuthForm({
  nextPath,
  mode,
}: {
  nextPath: string;
  mode: "signin" | "signup";
}) {
  const [state, formAction, pending] = useActionState(
    googleLoginAction,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);
  const idTokenRef = useRef<HTMLInputElement>(null);
  const accessTokenRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [buttonWidth, setButtonWidth] = useState(320);
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  const buttonText = mode === "signup" ? "signup_with" : "signin_with";
  const label = mode === "signup" ? "Sign up with Google" : "Sign in with Google";

  const submitCredential = useCallback(
    (credential?: string, requestPhone = false) => {
      if (!credential) {
        setLocalMessage("Google did not return a sign-in token. Try again.");
        return;
      }

      const submit = (accessToken = "") => {
        setLocalMessage(null);

        if (idTokenRef.current && accessTokenRef.current && formRef.current) {
          idTokenRef.current.value = credential;
          accessTokenRef.current.value = accessToken;
          formRef.current.requestSubmit();
        }
      };

      if (!requestPhone) {
        submit();
        return;
      }

      const oauth2 = window.google?.accounts?.oauth2;

      if (!oauth2) {
        submit();
        return;
      }

      let completed = false;
      const complete = (accessToken = "") => {
        if (completed) {
          return;
        }

        completed = true;
        submit(accessToken);
      };

      try {
        const tokenClient = oauth2.initTokenClient({
          client_id: googleClientId,
          scope: googlePhoneScope,
          include_granted_scopes: true,
          callback: (response) => complete(response.access_token),
          error_callback: () => complete(),
        });

        tokenClient.requestAccessToken({ prompt: "consent" });
      } catch {
        complete();
      }
    },
    []
  );

  useEffect(() => {
    if (!googleClientId || !buttonRef.current) {
      return;
    }

    const buttonElement = buttonRef.current;
    const updateWidth = () => {
      const measuredWidth = Math.floor(buttonElement.getBoundingClientRect().width);
      setButtonWidth(Math.max(240, Math.min(400, measuredWidth || 320)));
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(buttonElement);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const googleAccounts = window.google?.accounts?.id;
    const buttonElement = buttonRef.current;

    if (!googleClientId || !scriptReady || !googleAccounts || !buttonElement) {
      return;
    }

    buttonElement.replaceChildren();
    googleAccounts.initialize({
      client_id: googleClientId,
      callback: (response) => submitCredential(response.credential, true),
      ux_mode: "popup",
      auto_select: false,
      context: mode,
      itp_support: true,
      use_fedcm_for_button: true,
    });
    googleAccounts.renderButton(buttonElement, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: buttonText,
      shape: "pill",
      logo_alignment: "left",
      width: buttonWidth,
    });

    return () => {
      buttonElement.replaceChildren();
    };
  }, [buttonText, buttonWidth, mode, scriptReady, submitCredential]);

  const message = localMessage ?? state.message;

  return (
    <div className="panel">
      {googleClientId ? (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => setScriptReady(true)}
          onReady={() => setScriptReady(true)}
          onError={() =>
            setLocalMessage("Google sign-in could not load. Check your connection.")
          }
        />
      ) : null}

      <form ref={formRef} action={formAction} className="hidden">
        <input type="hidden" name="next" value={nextPath} />
        <input ref={idTokenRef} type="hidden" name="idToken" />
        <input ref={accessTokenRef} type="hidden" name="accessToken" />
      </form>

      {googleClientId ? (
        <div className="grid gap-3">
          <div
            ref={buttonRef}
            className="min-h-10 w-full max-w-[400px]"
            aria-busy={pending}
            aria-label={label}
          />
          {pending ? (
            <p className="text-sm font-semibold text-[var(--muted)]">
              Connecting with Google...
            </p>
          ) : null}
        </div>
      ) : googleDevMode ? (
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="next" value={nextPath} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="email"
              type="email"
              className="surface-input text-sm"
              placeholder="Dev mode email"
            />
            <input
              name="displayName"
              className="surface-input text-sm"
              placeholder="Dev mode name"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="action-secondary px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? "Connecting..." : "Continue with Google"}
          </button>
        </form>
      ) : (
        <p className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--muted)]">
          Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google sign-in.
        </p>
      )}

      {message ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function GoogleOneTapPrompt({ nextPath }: { nextPath: string }) {
  const [, formAction] = useActionState(googleLoginAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const idTokenRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [fallbackVisible, setFallbackVisible] = useState(false);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const canShowFallback = useCallback(() => {
    try {
      const dismissedUntil = Number(
        window.localStorage.getItem(googleSuggestionDismissedKey) ?? "0"
      );
      return !dismissedUntil || dismissedUntil <= Date.now();
    } catch {
      return true;
    }
  }, []);

  const showFallbackSoon = useCallback(
    (delay = 0) => {
      clearFallbackTimer();

      if (!canShowFallback()) {
        return;
      }

      fallbackTimerRef.current = setTimeout(() => {
        setFallbackVisible(true);
      }, delay);
    },
    [canShowFallback, clearFallbackTimer]
  );

  const submitCredential = useCallback((credential?: string) => {
    if (!credential || !idTokenRef.current || !formRef.current) {
      return;
    }

    setFallbackVisible(false);
    idTokenRef.current.value = credential;
    formRef.current.requestSubmit();
  }, []);

  const dismissFallback = useCallback(() => {
    setFallbackVisible(false);
    clearFallbackTimer();
    window.google?.accounts?.id?.cancel();

    try {
      window.localStorage.setItem(
        googleSuggestionDismissedKey,
        String(Date.now() + googleSuggestionDismissMs)
      );
    } catch {
      // Ignore storage restrictions and only dismiss for this page view.
    }
  }, [clearFallbackTimer]);

  useEffect(() => {
    const googleAccounts = window.google?.accounts?.id;

    if (!googleClientId || !scriptReady || !googleAccounts) {
      return;
    }

    googleAccounts.initialize({
      client_id: googleClientId,
      callback: (response) => submitCredential(response.credential),
      ux_mode: "popup",
      auto_select: false,
      context: "signin",
      cancel_on_tap_outside: true,
      itp_support: true,
      use_fedcm_for_button: true,
    });
    googleAccounts.prompt((notification) => {
      if (notification.isDisplayed?.()) {
        clearFallbackTimer();
        return;
      }

      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        showFallbackSoon();
        return;
      }

      if (notification.isDismissedMoment?.()) {
        clearFallbackTimer();
      }
    });
    showFallbackSoon(6000);

    return () => {
      clearFallbackTimer();
      googleAccounts.cancel();
    };
  }, [
    clearFallbackTimer,
    scriptReady,
    showFallbackSoon,
    submitCredential,
  ]);

  useEffect(() => {
    const googleAccounts = window.google?.accounts?.id;
    const buttonElement = buttonRef.current;

    if (
      !fallbackVisible ||
      !googleClientId ||
      !scriptReady ||
      !googleAccounts ||
      !buttonElement
    ) {
      return;
    }

    buttonElement.replaceChildren();
    googleAccounts.renderButton(buttonElement, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      logo_alignment: "left",
      width: 288,
    });

    return () => {
      buttonElement.replaceChildren();
    };
  }, [fallbackVisible, scriptReady]);

  if (!googleClientId) {
    return null;
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
      />
      <form ref={formRef} action={formAction} className="hidden">
        <input type="hidden" name="next" value={nextPath} />
        <input ref={idTokenRef} type="hidden" name="idToken" />
      </form>
      {fallbackVisible ? (
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xl sm:bottom-6 sm:right-6">
          <button
            type="button"
            onClick={dismissFallback}
            className="absolute right-3 top-3 rounded-md px-2 py-1 text-sm font-black text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]"
            aria-label="Dismiss Google sign-in suggestion"
          >
            X
          </button>
          <div className="grid gap-3 pr-8">
            <div>
              <p className="text-sm font-black text-[var(--foreground)]">
                Continue with Google
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                Sign in faster with your Google account.
              </p>
            </div>
            <div
              ref={buttonRef}
              className="min-h-10 w-full max-w-[288px]"
              aria-label="Continue with Google"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
