@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo.
echo ==========================================
echo  ICBANQ OPS Portal 실행
echo ==========================================
echo.
echo 처음 실행이면 필요한 파일을 설치합니다.
call npm.cmd install
echo.
echo 서버를 시작합니다.
echo 브라우저 주소: http://127.0.0.1:3001
echo.
echo 이 창을 닫으면 사이트도 종료됩니다.
echo ==========================================
echo.
call npm.cmd run dev:3001
pause
