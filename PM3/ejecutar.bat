@echo off
title Lanzador PM3 (Huffman + Hamming)
color 0B
echo ==========================================
echo    INICIANDO LABORATORIO FINAL PM3
echo ==========================================
echo.

echo [1/2] Liberando puerto 8083 si esta en uso...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8083 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

echo [2/2] Lanzando servidor Java en http://localhost:8083 ...
echo.
echo TIP: Podes entrar en el navegador una vez iniciado.
echo.

if not exist "pm3.jar" (
    color 0C
    echo [ERROR] No se encontro pm3.jar. 
    echo Por favor ejecuta primero 'build.bat' para compilar el proyecto.
    pause
    exit /b 1
)

java -jar pm3.jar
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo [ERROR] No se pudo iniciar la aplicacion.
    echo Asegurate de tener Java 21+ instalado y de haber corrido 'build.bat'.
    pause
)
