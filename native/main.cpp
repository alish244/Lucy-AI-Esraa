// ==============================================================================
// Lucy — Native C++ Launcher (WebView2 host)
// Al-Esraa University · Computer Techniques Engineering · Section A3
// Supervisor: Prof. Ali Hussein
// Developers: Zahraa Haider · Ali Shihab · Rafid Jawad
// ==============================================================================
//
// Responsibilities of this native layer:
//   1. Create a modern, DPI-aware native Win32 window.
//   2. Host an embedded Microsoft Edge WebView2 control.
//   3. Navigate to the bundled local web UI (app/index.html).
//   4. Bridge native metadata (app version, offline flag) into JavaScript
//      via the `window.chrome.webview` host object.
//
// Language/intelligence/voice all live in the web UI. This file is intentionally
// the smallest useful C++ surface: a robust launcher.
// ==============================================================================

#define UNICODE
#define _UNICODE
#define WIN32_LEAN_AND_MEAN

#include <windows.h>
#include <shlwapi.h>
#include <wrl.h>
#include <WebView2.h>
#include <string>
#include <vector>

#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "user32.lib")

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

// ------------------------------------------------------------------------------
// Globals (scoped to this translation unit)
// ------------------------------------------------------------------------------
namespace {
    HINSTANCE g_hInst = nullptr;
    HWND      g_hWnd = nullptr;
    ComPtr<ICoreWebView2Controller> g_controller;
    ComPtr<ICoreWebView2>           g_webview;

    constexpr wchar_t kWindowClass[] = L"LucyNeuralWindow";
    constexpr wchar_t kWindowTitle[] = L"Lucy — Al-Esraa AI Assistant";
    constexpr int     kDefaultWidth  = 1280;
    constexpr int     kDefaultHeight = 860;
}

// ------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------
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

static void ResizeWebViewToClient() {
    if (!g_controller) return;
    RECT rc;
    GetClientRect(g_hWnd, &rc);
    g_controller->put_Bounds(rc);
}

static void ShowRuntimeMissingDialog() {
    MessageBoxW(
        g_hWnd,
        L"Microsoft Edge WebView2 Runtime is not installed on this machine.\n\n"
        L"Lucy needs this runtime to render its neural UI.\n\n"
        L"Please download and install the Evergreen runtime from:\n"
        L"https://developer.microsoft.com/en-us/microsoft-edge/webview2/\n\n"
        L"After installation, relaunch Lucy.",
        L"Lucy — WebView2 Runtime Required",
        MB_OK | MB_ICONWARNING
    );
}

// ------------------------------------------------------------------------------
// WebView2 bring-up
// ------------------------------------------------------------------------------
static HRESULT OnControllerCreated(HRESULT hr, ICoreWebView2Controller* controller) {
    if (FAILED(hr) || !controller) {
        MessageBoxW(g_hWnd, L"Failed to create WebView2 controller.", kWindowTitle, MB_OK | MB_ICONERROR);
        PostQuitMessage(1);
        return hr;
    }

    g_controller = controller;
    g_controller->get_CoreWebView2(&g_webview);

    // Dark canvas background so the neural UI flashes in on color, not white.
    COREWEBVIEW2_COLOR color{ 255, 3, 6, 15 }; // A R G B  (#03060F)
    ComPtr<ICoreWebView2Controller2> controller2;
    if (SUCCEEDED(g_controller.As(&controller2))) {
        controller2->put_DefaultBackgroundColor(color);
    }

    // Configure settings: no context menu, no status bar, but allow devtools in dev.
    ComPtr<ICoreWebView2Settings> settings;
    if (SUCCEEDED(g_webview->get_Settings(&settings))) {
        settings->put_AreDefaultContextMenusEnabled(FALSE);
        settings->put_IsStatusBarEnabled(FALSE);
        settings->put_AreDevToolsEnabled(TRUE);
        settings->put_IsZoomControlEnabled(FALSE);
    }

    // Inject a small bridge object BEFORE navigation.
    const wchar_t* kBridge =
        L"window.LucyNative = {"
        L"  version: '1.0.0',"
        L"  platform: 'win32',"
        L"  host: 'cpp-webview2',"
        L"  universityUrl: 'https://www.esraa.edu.iq/'"
        L"};";
    g_webview->AddScriptToExecuteOnDocumentCreated(kBridge, nullptr);

    // Size the WebView to the window client area.
    ResizeWebViewToClient();

    // Navigate to the bundled web UI.
    const std::wstring folder = GetExecutableFolder();
    const std::wstring url    = BuildLocalUrl(folder, L"app/index.html");
    g_webview->Navigate(url.c_str());

    return S_OK;
}

static HRESULT OnEnvironmentCreated(HRESULT hr, ICoreWebView2Environment* env) {
    if (FAILED(hr) || !env) {
        ShowRuntimeMissingDialog();
        PostQuitMessage(1);
        return hr;
    }
    return env->CreateCoreWebView2Controller(
        g_hWnd,
        Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(&OnControllerCreated).Get()
    );
}

static HRESULT InitWebView() {
    return CreateCoreWebView2EnvironmentWithOptions(
        nullptr, nullptr, nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(&OnEnvironmentCreated).Get()
    );
}

// ------------------------------------------------------------------------------
// Window procedure
// ------------------------------------------------------------------------------
static LRESULT CALLBACK WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_SIZE:
            ResizeWebViewToClient();
            return 0;

        case WM_DESTROY:
            g_controller.Reset();
            g_webview.Reset();
            PostQuitMessage(0);
            return 0;

        case WM_GETMINMAXINFO: {
            auto* info = reinterpret_cast<MINMAXINFO*>(lParam);
            info->ptMinTrackSize.x = 720;
            info->ptMinTrackSize.y = 560;
            return 0;
        }
    }
    return DefWindowProcW(hWnd, msg, wParam, lParam);
}

// ------------------------------------------------------------------------------
// Entry point
// ------------------------------------------------------------------------------
int APIENTRY wWinMain(HINSTANCE hInstance, HINSTANCE, LPWSTR, int nShowCmd) {
    g_hInst = hInstance;

    // Best-effort DPI awareness. Ignored on older Windows.
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

    // Initialize COM (required before WRL callbacks).
    HRESULT coInit = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    if (FAILED(coInit) && coInit != RPC_E_CHANGED_MODE) {
        MessageBoxW(nullptr, L"CoInitializeEx failed.", kWindowTitle, MB_OK | MB_ICONERROR);
        return 1;
    }

    // Register window class.
    WNDCLASSEXW wc{ sizeof(wc) };
    wc.lpfnWndProc   = WndProc;
    wc.hInstance     = hInstance;
    wc.hCursor       = LoadCursorW(nullptr, IDC_ARROW);
    wc.hbrBackground = CreateSolidBrush(RGB(3, 6, 15)); // match UI background
    wc.lpszClassName = kWindowClass;
    wc.hIcon         = LoadIconW(hInstance, MAKEINTRESOURCEW(101));
    wc.hIconSm       = wc.hIcon;
    if (!RegisterClassExW(&wc)) {
        MessageBoxW(nullptr, L"Window class registration failed.", kWindowTitle, MB_OK | MB_ICONERROR);
        return 1;
    }

    // Center window on primary monitor.
    const int screenW = GetSystemMetrics(SM_CXSCREEN);
    const int screenH = GetSystemMetrics(SM_CYSCREEN);
    const int x = (screenW - kDefaultWidth)  / 2;
    const int y = (screenH - kDefaultHeight) / 2;

    g_hWnd = CreateWindowExW(
        0,
        kWindowClass,
        kWindowTitle,
        WS_OVERLAPPEDWINDOW,
        x, y, kDefaultWidth, kDefaultHeight,
        nullptr, nullptr, hInstance, nullptr
    );
    if (!g_hWnd) {
        MessageBoxW(nullptr, L"Window creation failed.", kWindowTitle, MB_OK | MB_ICONERROR);
        return 1;
    }

    ShowWindow(g_hWnd, nShowCmd);
    UpdateWindow(g_hWnd);

    if (FAILED(InitWebView())) {
        ShowRuntimeMissingDialog();
        return 1;
    }

    // Message pump.
    MSG msg{};
    while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    CoUninitialize();
    return static_cast<int>(msg.wParam);
}
