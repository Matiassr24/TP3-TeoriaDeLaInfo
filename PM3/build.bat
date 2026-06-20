@echo off
title Compilando Proyecto PM3 (Huffman + Hamming)
color 0A

echo ==========================================
echo   COMPILANDO PROYECTO UNIFICADO PM3
echo ==========================================
echo.

:: 1. Compilar Frontend
echo [1/4] Instalando dependencias y construyendo Frontend...
cd frontend
call npm install
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Falló la compilación del Frontend.
    pause
    exit /b %errorlevel%
)
cd ..

:: 2. Copiar recursos estáticos al Backend
echo.
echo [2/4] Copiando recursos estáticos al Backend...
if exist "backend\src\main\resources\static" (
    rd /s /q "backend\src\main\resources\static"
)
mkdir "backend\src\main\resources\static"
xcopy /e /y "frontend\dist\*" "backend\src\main\resources\static\"

:: 3. Compilar Backend
echo.
echo [3/4] Compilando Backend y empaquetando JAR...
cd backend

:: Verificar si existe el wrapper mvnw, si no, intentar usar mvn global
if exist "mvnw.cmd" (
    call mvnw.cmd clean package -DskipTests
) else (
    echo [INFO] mvnw.cmd no encontrado en PM3. Intentando usar mvn global...
    call mvn clean package -DskipTests
)

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Falló la compilación del Backend.
    pause
    exit /b %errorlevel%
)
cd ..

:: 4. Extraer el JAR compilado
echo.
echo [4/4] Finalizando y copiando ejecutable...
if exist "pm3.jar" del "pm3.jar"
copy "backend\target\backend-0.0.1-SNAPSHOT.jar" "pm3.jar"

echo.
echo ==========================================
echo   PROCESO COMPLETADO EXITOSAMENTE
echo ==========================================
echo Podes ejecutar el proyecto usando 'ejecutar.bat' o 'java -jar pm3.jar'
echo.
pause
