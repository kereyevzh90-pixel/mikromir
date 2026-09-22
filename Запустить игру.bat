@echo off
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
if not exist node_modules\electron (
  echo Первый запуск: ставлю Electron, это займёт пару минут...
  call npm install
)
call npx electron .
