import os
import io
import shutil
import zipfile
import tarfile

def main():
    print("1. Cleaning dist/downloads if present...")
    if os.path.exists("dist/downloads"):
        shutil.rmtree("dist/downloads")

    dist_files = []
    for root, dirs, files in os.walk("dist"):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, "dist")
            dist_files.append((full_path, rel_path))

    print(f"Found {len(dist_files)} files in dist/")

    # Read the 432159-byte PE Windows stub
    print("2. Reading PE Windows launcher stub...")
    with open("public/downloads/FS_Chat.exe", "rb") as f:
        stub = f.read(432159)

    if stub[:2] != b"MZ":
        raise Exception("Invalid PE stub header!")

    # Create fresh embedded zip for the executable
    print("3. Creating fresh embedded zip for FS_Chat.exe...")
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as z:
        for full_p, rel_p in dist_files:
            z.write(full_p, rel_p)
        if os.path.exists("КАК_СЕ_СТАРТИРА.txt"):
            z.write("КАК_СЕ_СТАРТИРА.txt", "КАК_СЕ_СТАРТИРА.txt")
        if os.path.exists("HOW_TO_START.txt"):
            z.write("HOW_TO_START.txt", "HOW_TO_START.txt")
        if os.path.exists("browser_config.json"):
            z.write("browser_config.json", "browser_config.json")

    embedded_zip_bytes = zip_buffer.getvalue()
    print(f"Embedded zip size: {len(embedded_zip_bytes)} bytes")

    # Write new FS_Chat.exe
    new_exe_path = "public/downloads/FS_Chat.exe"
    with open(new_exe_path, "wb") as f:
        f.write(stub)
        f.write(embedded_zip_bytes)
    print(f"Updated {new_exe_path} (Total size: {os.path.getsize(new_exe_path)} bytes)")

    # 4. Rebuild FS_Chat-Windows.zip
    print("4. Rebuilding FS_Chat-Windows.zip...")
    win_zip_path = "public/downloads/FS_Chat-Windows.zip"
    with zipfile.ZipFile(win_zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(new_exe_path, "FS_Chat.exe")
        z.write("КАК_СЕ_СТАРТИРА.txt", "КАК_СЕ_СТАРТИРА.txt")
        z.write("HOW_TO_START.txt", "HOW_TO_START.txt")
    print(f"Updated {win_zip_path} (Total size: {os.path.getsize(win_zip_path)} bytes)")

    # 5. Rebuild FS_Chat-Mac.zip
    print("5. Rebuilding FS_Chat-Mac.zip...")
    mac_command_script = """#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

CONFIG_FILE="$HOME/.config/fs_chat/browser_config.json"
LOCAL_CONFIG="$DIR/browser_config.json"
BROWSER="auto"
if [ -f "$LOCAL_CONFIG" ]; then
  BROWSER=$(grep -o '"browser": *"[^"]*"' "$LOCAL_CONFIG" | cut -d'"' -f4)
elif [ -f "$CONFIG_FILE" ]; then
  BROWSER=$(grep -o '"browser": *"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
fi

PORT=3344
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; do
  PORT=$((PORT + 1))
done

if command -v node >/dev/null 2>&1; then
  node "$DIR/www/server.cjs" >/dev/null 2>&1 &
  SERVER_PID=$!
elif command -v python3 >/dev/null 2>&1; then
  python3 -m http.server $PORT --directory "$DIR/www" >/dev/null 2>&1 &
  SERVER_PID=$!
else
  python -m SimpleHTTPServer $PORT >/dev/null 2>&1 &
  SERVER_PID=$!
fi

sleep 1
URL="http://127.0.0.1:$PORT/"

if [ "$BROWSER" = "ask" ]; then
  CHOICE=$(osascript -e 'try
    choose from list {"Google Chrome", "Microsoft Edge", "Brave Browser", "Firefox", "Opera", "Safari (По подразбиране)"} with title "FS_Chat" with prompt "Изберете браузър за FS_Chat:" OK button name "Стартирай"
  end try')
  case "$CHOICE" in
    *"Chrome"*) BROWSER="chrome" ;;
    *"Edge"*) BROWSER="msedge" ;;
    *"Brave"*) BROWSER="brave" ;;
    *"Firefox"*) BROWSER="firefox" ;;
    *"Opera"*) BROWSER="opera" ;;
    *) BROWSER="auto" ;;
  esac
fi

case "$BROWSER" in
  chrome)   open -a "Google Chrome" --args --app="$URL" || open "$URL" ;;
  msedge)   open -a "Microsoft Edge" --args --app="$URL" || open "$URL" ;;
  brave)    open -a "Brave Browser" --args --app="$URL" || open "$URL" ;;
  firefox)  open -a "Firefox" "$URL" || open "$URL" ;;
  opera)    open -a "Opera" "$URL" || open "$URL" ;;
  *)        open "$URL" ;;
esac

wait $SERVER_PID 2>/dev/null
"""
    mac_zip_path = "public/downloads/FS_Chat-Mac.zip"
    with zipfile.ZipFile(mac_zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        # FS_Chat.command
        zip_info = zipfile.ZipInfo("FS_Chat-Mac/FS_Chat.command")
        zip_info.external_attr = 0o755 << 16
        z.writestr(zip_info, mac_command_script)
        z.write("КАК_СЕ_СТАРТИРА.txt", "FS_Chat-Mac/КАК_СЕ_СТАРТИРА.txt")
        z.write("HOW_TO_START.txt", "FS_Chat-Mac/HOW_TO_START.txt")
        for full_p, rel_p in dist_files:
            z.write(full_p, f"FS_Chat-Mac/www/{rel_p}")
    print(f"Updated {mac_zip_path} (Total size: {os.path.getsize(mac_zip_path)} bytes)")

    # 6. Rebuild FS_Chat-Linux.tar.gz
    print("6. Rebuilding FS_Chat-Linux.tar.gz...")
    linux_sh_script = """#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

CONFIG_FILE="$HOME/.config/fs_chat/browser_config.json"
LOCAL_CONFIG="$DIR/browser_config.json"
BROWSER="auto"
if [ -f "$LOCAL_CONFIG" ]; then
  BROWSER=$(grep -o '"browser": *"[^"]*"' "$LOCAL_CONFIG" | cut -d'"' -f4)
elif [ -f "$CONFIG_FILE" ]; then
  BROWSER=$(grep -o '"browser": *"[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
fi

PORT=3355
while netstat -tuln 2>/dev/null | grep -q ":$PORT " ; do
  PORT=$((PORT + 1))
done

if command -v node >/dev/null 2>&1; then
  node "$DIR/www/server.cjs" >/dev/null 2>&1 &
  SERVER_PID=$!
elif command -v python3 >/dev/null 2>&1; then
  python3 -m http.server $PORT --directory "$DIR/www" >/dev/null 2>&1 &
  SERVER_PID=$!
else
  python -m SimpleHTTPServer $PORT >/dev/null 2>&1 &
  SERVER_PID=$!
fi

sleep 1
URL="http://127.0.0.1:$PORT/"

if [ "$BROWSER" = "ask" ]; then
  if command -v zenity >/dev/null 2>&1; then
    BROWSER=$(zenity --list --title="FS_Chat - Стартиращ браузър" --column="ID" --column="Браузър" \\
      "auto" "Системен браузър по подразбиране" \\
      "chrome" "Google Chrome / Chromium" \\
      "msedge" "Microsoft Edge" \\
      "brave" "Brave Browser" \\
      "firefox" "Mozilla Firefox" \\
      "opera" "Opera")
  fi
fi

case "$BROWSER" in
  chrome)  google-chrome --app="$URL" 2>/dev/null || chromium --app="$URL" 2>/dev/null || xdg-open "$URL" ;;
  msedge)  microsoft-edge --app="$URL" 2>/dev/null || xdg-open "$URL" ;;
  brave)   brave-browser --app="$URL" 2>/dev/null || xdg-open "$URL" ;;
  firefox) firefox -new-window "$URL" 2>/dev/null || xdg-open "$URL" ;;
  opera)   opera "$URL" 2>/dev/null || xdg-open "$URL" ;;
  *)       xdg-open "$URL" 2>/dev/null || sensible-browser "$URL" 2>/dev/null ;;
esac

wait $SERVER_PID 2>/dev/null
"""
    linux_desktop_entry = """[Desktop Entry]
Name=FS_Chat
Comment=FS_Chat / Намери Секс - Децентрализиран Чат
Exec=bash -c "cd $(dirname %k) && ./FS_Chat.sh"
Icon=application-default-icon
Terminal=false
Type=Application
Categories=Network;Chat;
"""
    linux_tar_path = "public/downloads/FS_Chat-Linux.tar.gz"
    with tarfile.open(linux_tar_path, "w:gz") as tar:
        # FS_Chat.sh
        sh_bytes = linux_sh_script.encode("utf-8")
        ti = tarfile.TarInfo(name="FS_Chat-Linux/FS_Chat.sh")
        ti.size = len(sh_bytes)
        ti.mode = 0o755
        tar.addfile(ti, io.BytesIO(sh_bytes))

        # FS_Chat.desktop
        dt_bytes = linux_desktop_entry.encode("utf-8")
        ti = tarfile.TarInfo(name="FS_Chat-Linux/FS_Chat.desktop")
        ti.size = len(dt_bytes)
        ti.mode = 0o755
        tar.addfile(ti, io.BytesIO(dt_bytes))

        # Guides
        tar.add("КАК_СЕ_СТАРТИРА.txt", arcname="FS_Chat-Linux/КАК_СЕ_СТАРТИРА.txt")
        tar.add("HOW_TO_START.txt", arcname="FS_Chat-Linux/HOW_TO_START.txt")

        # dist files into www/
        for full_p, rel_p in dist_files:
            tar.add(full_p, arcname=f"FS_Chat-Linux/www/{rel_p}")
    print(f"Updated {linux_tar_path} (Total size: {os.path.getsize(linux_tar_path)} bytes)")
    print("\nALL REPACKAGING COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
