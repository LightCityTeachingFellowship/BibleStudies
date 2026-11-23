# Website and Android workflow

Use `LightCity-Website` as the shared website project. It contains the articles, summaries, scripts, styles and `v2` app interface. Use `LightCity-Android` for the native Android project. Keep the production signing key in `LightCity-Release-Keys`, outside the website repository.

The updated Windows Studio has a **Project** menu for uploading selected website files and building an APK. See `Studio-Project-Controls.md`. Until the updated Studio app is installed, follow `Windows-Website-Build-Guide.md` and `How-to-Build-an-Android-APK.md`.

The earlier website and preview folders have been retained while their local changes and background services are reconciled. Do not delete them or assume copying changes into them updates this project. Confirm the GitHub project is current before a release.
