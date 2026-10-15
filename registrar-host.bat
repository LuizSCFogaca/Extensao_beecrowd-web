@echo off
chcp 65001 >nul
echo ======================================================
echo    Instalando Beecrowd Companion Native Host (PC)
echo ======================================================
node "%~dp0native-host\install.js" %*
pause
