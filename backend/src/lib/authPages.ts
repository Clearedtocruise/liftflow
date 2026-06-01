function authLandingPage(options: {
  title: string;
  message: string;
  deepLinkPath: string;
  fallbackLabel: string;
}): string {
  const { title, message, deepLinkPath, fallbackLabel } = options;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — LiftFlow</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0A0A0B; color: #F4F4F5; margin: 0; padding: 2rem; text-align: center; }
    main { max-width: 28rem; margin: 4rem auto; }
    h1 { font-size: 1.5rem; margin-bottom: 0.75rem; }
    p { color: #A1A1AA; line-height: 1.5; }
    a { display: inline-block; margin-top: 1.5rem; padding: 0.875rem 1.25rem; background: #6366F1; color: #0A0A0B; text-decoration: none; border-radius: 12px; font-weight: 600; }
    #status { margin-top: 1rem; font-size: 0.875rem; color: #71717A; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${message}</p>
    <a id="open-app" href="#">${fallbackLabel}</a>
    <p id="status">Opening LiftFlow…</p>
  </main>
  <script>
    (function () {
      var hash = window.location.hash || '';
      var search = window.location.search || '';
      var suffix = hash || search;
      var appUrl = 'liftflow://${deepLinkPath}' + suffix;
      var link = document.getElementById('open-app');
      link.href = appUrl;
      window.location.replace(appUrl);
      setTimeout(function () {
        document.getElementById('status').textContent =
          'If LiftFlow did not open automatically, tap the button above or open the app and sign in.';
      }, 2500);
    })();
  </script>
</body>
</html>`;
}

export function emailConfirmHtml(): string {
  return authLandingPage({
    title: 'Email verified',
    message: 'Your LiftFlow account is confirmed. Return to the app to sign in.',
    deepLinkPath: 'auth/confirm',
    fallbackLabel: 'Open LiftFlow',
  });
}

export function passwordResetHtml(): string {
  return authLandingPage({
    title: 'Reset your password',
    message: 'Continue in LiftFlow to choose a new password.',
    deepLinkPath: 'reset-password',
    fallbackLabel: 'Open LiftFlow',
  });
}
