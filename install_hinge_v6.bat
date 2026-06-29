@echo off
setlocal

echo ============================================
echo MebleCal hinge visual v6 installer
echo ============================================
echo.

if not exist "frontend\package.json" (
  echo [ERROR] Nie widze frontend\package.json.
  echo Uruchom ten plik BAT z glownego folderu projektu:
  echo C:\Users\tomwi\Desktop\Projekt
  echo.
  pause
  exit /b 1
)

echo [1/4] Kopiuje pliki...
xcopy /E /I /Y "patch\frontend\src\scene\HingeModel.tsx" "frontend\src\scene\" >nul
xcopy /E /I /Y "patch\frontend\src\model\hardware-visuals.ts" "frontend\src\model\" >nul
xcopy /E /I /Y "patch\frontend\public\models\hardware\blum\hinges\71B3550_67\*" "frontend\public\models\hardware\blum\hinges\71B3550_67\" >nul

echo [2/4] Sprawdzam czy pliki sa w dobrym miejscu...
if not exist "frontend\src\scene\HingeModel.tsx" (
  echo [ERROR] Brak frontend\src\scene\HingeModel.tsx
  pause
  exit /b 1
)
if not exist "frontend\src\model\hardware-visuals.ts" (
  echo [ERROR] Brak frontend\src\model\hardware-visuals.ts
  pause
  exit /b 1
)
if not exist "frontend\public\models\hardware\blum\hinges\71B3550_67\body.dae" (
  echo [ERROR] Brak body.dae
  pause
  exit /b 1
)
if not exist "frontend\public\models\hardware\blum\hinges\71B3550_67\plate.dae" (
  echo [ERROR] Brak plate.dae
  pause
  exit /b 1
)

echo [3/4] Weryfikuje, czy HingeModel renderuje body + plate...
findstr /C:"visual.bodyUrl" "frontend\src\scene\HingeModel.tsx" >nul
if errorlevel 1 (
  echo [ERROR] HingeModel.tsx nie wyglada na nowa wersje. Brak visual.bodyUrl.
  pause
  exit /b 1
)
findstr /C:"visual.plateUrl" "frontend\src\scene\HingeModel.tsx" >nul
if errorlevel 1 (
  echo [ERROR] HingeModel.tsx nie wyglada na nowa wersje. Brak visual.plateUrl.
  pause
  exit /b 1
)

echo [4/4] Gotowe.
echo.
echo Teraz uruchom:
echo cd frontend
echo npm run build
echo npm run dev
echo.
pause
endlocal
