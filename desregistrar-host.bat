@echo off
chcp 65001 >nul
echo ======================================================
echo    Removendo Beecrowd Companion Native Host (PC)
echo ======================================================
node "%~dp0native-host\uninstall.js"
pause
