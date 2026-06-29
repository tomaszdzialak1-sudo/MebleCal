@echo off
setlocal
echo ============================================
echo MebleCal hinge v11 gray finish installer
echo ============================================
echo.

if not exist "frontend\package.json" (
  echo [ERROR] Uruchom BAT z glownego folderu projektu:
  echo C:\Users\tomwi\Desktop\Projekt
  pause
  exit /b 1
)

echo [1/3] Kopiuje pliki...
xcopy /E /I /Y "patch\frontend\src\scene\HingeModel.tsx" "frontend\src\scene\" >nul
xcopy /E /I /Y "patch\frontend\src\model\hardware-visuals.ts" "frontend\src\model\" >nul
xcopy /E /I /Y "patch\frontend\public\models\hardware\blum\hinges\71B3550_67\*" "frontend\public\models\hardware\blum\hinges\71B3550_67\" >nul

echo [2/3] Sprawdzam domyslny kolor...
findstr /C:"defaultFinish: 'gray'" "frontend\src\model\hardware-visuals.ts" >nul
if errorlevel 1 (
  echo [ERROR] hardware-visuals.ts nie zostal poprawnie podmieniony.
  pause
  exit /b 1
)

echo [3/3] Gotowe.
echo.
echo Teraz uruchom:
echo cd frontend
echo npm run build
echo npm run dev
echo.
pause
endlocal
