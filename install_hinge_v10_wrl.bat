@echo off
setlocal
echo ============================================
echo MebleCal hinge v10 WRL real Blum installer
echo ============================================
echo.

if not exist "frontend\package.json" (
  echo [ERROR] Uruchom BAT z glownego folderu projektu:
  echo C:\Users\tomwi\Desktop\Projekt
  pause
  exit /b 1
)

echo [1/4] Kopiuje pliki...
xcopy /E /I /Y "patch\frontend\src\scene\HingeModel.tsx" "frontend\src\scene\" >nul
xcopy /E /I /Y "patch\frontend\src\model\hardware-visuals.ts" "frontend\src\model\" >nul
xcopy /E /I /Y "patch\frontend\public\models\hardware\blum\hinges\71B3550_67\*" "frontend\public\models\hardware\blum\hinges\71B3550_67\" >nul

echo [2/4] Sprawdzam pliki WRL...
if not exist "frontend\public\models\hardware\blum\hinges\71B3550_67\body.wrl" (
  echo [ERROR] Brak body.wrl
  pause
  exit /b 1
)
if not exist "frontend\public\models\hardware\blum\hinges\71B3550_67\plate.wrl" (
  echo [ERROR] Brak plate.wrl
  pause
  exit /b 1
)

echo [3/4] Sprawdzam renderer...
findstr /C:"HingeModel WRL" "frontend\src\scene\HingeModel.tsx" >nul
if errorlevel 1 (
  echo [ERROR] HingeModel.tsx nie zostal poprawnie podmieniony.
  pause
  exit /b 1
)

echo [4/4] Gotowe.
echo.
echo Uruchom:
echo cd frontend
echo npm run build
echo npm run dev
echo.
pause
endlocal
