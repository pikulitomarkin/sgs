@echo off
REM Abre o painel TV no Chrome com politica de autoplay liberada (Windows / TV box)
set URL=http://192.168.18.54:8083/?v=10
set CHROME=
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if "%CHROME%"=="" (
  echo Chrome nao encontrado
  pause
  exit /b 1
)
start "" "%CHROME%" --kiosk --autoplay-policy=no-user-gesture-required --disable-features=PreloadMediaEngagementData --check-for-update-interval=31536000 --noerrdialogs "%URL%"
