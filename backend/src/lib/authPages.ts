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
  <title>${title} — ONE MORE</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #080B10; color: #FFFFFF; margin: 0; padding: 2rem; text-align: center; }
    main { max-width: 28rem; margin: 4rem auto; }
    .brand { font-size: 0.75rem; letter-spacing: 0.35em; font-weight: 800; color: #FFFFFF; margin-bottom: 0.25rem; }
    .tagline { font-size: 0.7rem; letter-spacing: 0.2em; color: #00E5FF; margin-bottom: 2rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.75rem; }
    p { color: #A6B0C3; line-height: 1.5; }
    a { display: inline-block; margin-top: 1.5rem; padding: 0.875rem 1.25rem; background: #1F6BFF; color: #FFFFFF; text-decoration: none; border-radius: 12px; font-weight: 600; }
    #status { margin-top: 1rem; font-size: 0.875rem; color: #6B7589; }
    footer { margin-top: 3rem; font-size: 0.7rem; letter-spacing: 0.2em; color: #00E5FF; }
  </style>
</head>
<body>
  <main>
    <div class="brand">ONE MORE</div>
    <div class="tagline">Only One.</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a id="open-app" href="#">${fallbackLabel}</a>
    <p id="status">Opening ONE MORE…</p>
    <footer>Only One.</footer>
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
          'If ONE MORE did not open automatically, tap the button above or open the app and sign in.';
      }, 2500);
    })();
  </script>
</body>
</html>`;
}

export function emailConfirmHtml(): string {
  return authLandingPage({
    title: 'Email verified',
    message: 'Your ONE MORE account is confirmed. Return to the app to sign in.',
    deepLinkPath: 'auth/confirm',
    fallbackLabel: 'Open ONE MORE',
  });
}

export function passwordResetHtml(): string {
  return authLandingPage({
    title: 'Reset your password',
    message: 'Continue in ONE MORE to choose a new password.',
    deepLinkPath: 'reset-password',
    fallbackLabel: 'Open ONE MORE',
  });
}
