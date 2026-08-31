// ==============================================================================
// Lucy — Lightweight Edge-App Launcher
// Al-Esraa University . Computer Techniques Engineering . Section A3
// ==============================================================================
//
// This is the MinGW-friendly alternative to native/main.cpp. It opens the
// bundled web UI (app/index.html) in a chromeless Microsoft Edge window via
// the --app= command-line flag. The result is visually identical to the
// WebView2 host: a clean, borderless Lucy window.
//
// Why this file exists:
//   - native/main.cpp uses WebView2 + WRL which requires MSVC + WebView2 SDK.
//   - This file uses only the Win32 API and is buildable with MinGW g++
//     in a single command, no SDK download required.
//
// End-user experience is the same. Microsoft Edge ships with Windows 10/11.
// ==============================================================================

#define UNICODE
#define _UNICODE
#define WIN32_LEAN_AND_MEAN

#include <windows.h>
#include <shlwapi.h>
#include <string>

#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "advapi32.lib")

namespace {
    constexpr wchar_t kTitle[] = L"Lucy - Al-Esraa AI Assistant";
}

static std::wstring GetExecutableFolder() {
    wchar_t buf[MAX_PATH] = {};
    GetModuleFileNameW(nullptr, buf, MAX_PATH);
    PathRemoveFileSpecW(buf);
    return buf;
}

static std::wstring BuildLocalUrl(const std::wstring& folder, const std::wstring& relPath) {
    std::wstring url = L"file:///" + folder + L"\\" + relPath;
    for (auto& c : url) if (c == L'\\') c = L'/';
    return url;
}

// Look up msedge.exe via the Windows App Paths registry entry, then fall back
// to the standard install locations.
static std::wstring FindMsEdge() {
    static const wchar_t* kAppPathsKey =
        L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe";

    HKEY hRoots[2] = { HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER };
    for (HKEY root : hRoots) {
        HKEY hKey = nullptr;
        if (RegOpenKeyExW(root, kAppPathsKey, 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
            wchar_t buf[MAX_PATH] = {};
            DWORD sz = sizeof(buf);
            DWORD type = 0;
            if (RegQueryValueExW(hKey, nullptr, nullptr, &type,
                                 reinterpret_cast<LPBYTE>(buf), &sz) == ERROR_SUCCESS &&
                (type == REG_SZ || type == REG_EXPAND_SZ)) {
                RegCloseKey(hKey);
                return buf;
            }
            RegCloseKey(hKey);
        }
    }

    const wchar_t* fallbacks[] = {
        L"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        L"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    };
    for (const wchar_t* p : fallbacks) {
        if (PathFileExistsW(p)) return p;
    }
    return L"";
}

static void ShowEdgeMissingDialog() {
    MessageBoxW(
        nullptr,
        L"Microsoft Edge was not found on this machine.\n\n"
        L"Lucy uses Edge to render its neural UI.\n"
        L"Edge ships with Windows 10/11. If it has been removed, please reinstall\n"
        L"from: https://www.microsoft.com/edge\n\n"
        L"After installation, relaunch Lucy.",
        kTitle,
        MB_OK | MB_ICONWARNING
    );
}

static void ShowUiMissingDialog(const std::wstring& expected) {
    std::wstring msg =
        L"Could not find the bundled Lucy web UI.\n\n"
        L"Expected location:\n  " + expected + L"\n\n"
        L"Make sure the 'app' folder sits next to Lucy.exe.";
    MessageBoxW(nullptr, msg.c_str(), kTitle, MB_OK | MB_ICONERROR);
}

int APIENTRY wWinMain(HINSTANCE, HINSTANCE, LPWSTR, int) {
    const std::wstring folder = GetExecutableFolder();
    const std::wstring indexPath = folder + L"\\app\\index.html";

    if (!PathFileExistsW(indexPath.c_str())) {
        ShowUiMissingDialog(indexPath);
        return 1;
    }

    const std::wstring edge = FindMsEdge();
    if (edge.empty()) {
        ShowEdgeMissingDialog();
        return 1;
    }

    const std::wstring url = BuildLocalUrl(folder, L"app\\index.html");

    // User data dir scoped to Lucy so we don't interfere with the user's
    // regular Edge profile (and so localStorage for the Gemini key persists
    // specifically for Lucy between runs).
    wchar_t appData[MAX_PATH] = {};
    GetEnvironmentVariableW(L"LOCALAPPDATA", appData, MAX_PATH);
    std::wstring userDataDir = std::wstring(appData) + L"\\Lucy\\EdgeProfile";

    std::wstring cmdLine = L"\"" + edge + L"\""
                           L" --app=\"" + url + L"\""
                           L" --user-data-dir=\"" + userDataDir + L"\""
                           L" --window-size=1280,860"
                           L" --no-first-run"
                           L" --allow-file-access-from-files"
                           L" --disable-features=msEdgeSidebar,msHubApps";

    STARTUPINFOW si{ sizeof(si) };
    PROCESS_INFORMATION pi{};

    std::wstring mutableCmd = cmdLine;
    BOOL ok = CreateProcessW(
        nullptr,
        &mutableCmd[0],
        nullptr, nullptr, FALSE,
        0,
        nullptr, nullptr,
        &si, &pi
    );

    if (!ok) {
        MessageBoxW(nullptr, L"Failed to launch Microsoft Edge in app mode.",
                    kTitle, MB_OK | MB_ICONERROR);
        return 1;
    }

    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return 0;
}
