@echo off
setlocal
echo ============================================
echo MebleCal hinge v9 Blum-shape installer
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

echo [2/3] Sprawdzam renderer...
findstr /C:"HingeModel v9" "frontend\src\scene\HingeModel.tsx" >nul
if errorlevel 1 (
  echo [ERROR] HingeModel.tsx nie zostal poprawnie podmieniony.
  pause
  exit /b 1
)

echo [3/3] Gotowe.
echo.
echo Uruchom:
echo cd frontend
echo npm run build
echo npm run dev
echo.
pause
endlocal
