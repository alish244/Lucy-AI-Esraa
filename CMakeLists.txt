# ==============================================================================
# Lucy — CMake build
#
# Produces Lucy.exe (Win32 C++ WebView2 launcher) and copies the web UI
# alongside it into build/app/ so a packaged folder ships self-contained.
#
# Requirements:
#   - Windows 10 or 11
#   - Visual Studio 2022 (MSVC v143) OR Build Tools for VS 2022
#   - CMake >= 3.20
#   - PowerShell (bundled) to fetch the WebView2 SDK via build.bat
# ==============================================================================

cmake_minimum_required(VERSION 3.20)
project(Lucy
    VERSION 1.0.0
    DESCRIPTION "Intelligent Neural Assistant for Al-Esraa University"
    LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Windows-only build
if(NOT WIN32)
    message(FATAL_ERROR "Lucy's native launcher targets Windows only. "
                        "On other platforms, serve the web UI directly "
                        "(e.g. `python -m http.server` at the repo root).")
endif()

# ------------------------------------------------------------------------------
# WebView2 SDK (fetched by scripts/setup-sdk.ps1)
# ------------------------------------------------------------------------------
set(WEBVIEW2_ROOT "${CMAKE_SOURCE_DIR}/third_party/webview2")

if(NOT EXISTS "${WEBVIEW2_ROOT}/build/native/include/WebView2.h")
    message(FATAL_ERROR
        "WebView2 SDK not found at ${WEBVIEW2_ROOT}.\n"
        "Run  scripts/setup-sdk.ps1  (or use build.bat) first to download it.")
endif()

# Pick the correct WebView2Loader library for the target architecture.
if(CMAKE_GENERATOR_PLATFORM STREQUAL "x64" OR CMAKE_SIZEOF_VOID_P EQUAL 8)
    set(WV2_ARCH "x64")
elseif(CMAKE_GENERATOR_PLATFORM STREQUAL "ARM64")
    set(WV2_ARCH "arm64")
else()
    set(WV2_ARCH "x86")
endif()

add_library(webview2::loader STATIC IMPORTED)
set_target_properties(webview2::loader PROPERTIES
    IMPORTED_LOCATION           "${WEBVIEW2_ROOT}/build/native/${WV2_ARCH}/WebView2LoaderStatic.lib"
    INTERFACE_INCLUDE_DIRECTORIES "${WEBVIEW2_ROOT}/build/native/include"
)

# ------------------------------------------------------------------------------
# Lucy.exe
# ------------------------------------------------------------------------------
add_executable(Lucy WIN32
    native/main.cpp
    native/app.rc
)

target_link_libraries(Lucy PRIVATE
    webview2::loader
    Shlwapi
    user32
    ole32
    version
)

# Windows subsystem entry point
if(MSVC)
    target_compile_options(Lucy PRIVATE /W4 /utf-8 /EHsc /permissive-)
    set_target_properties(Lucy PROPERTIES LINK_FLAGS "/SUBSYSTEM:WINDOWS /ENTRY:wWinMainCRTStartup")
endif()

# ------------------------------------------------------------------------------
# Stage the web UI next to Lucy.exe so the packaged folder is self-contained.
# Layout after build:
#   build/Release/
#       Lucy.exe
#       app/
#           index.html
#           styles/...
#           scripts/...
#           data/...
#           assets/...
# ------------------------------------------------------------------------------
set(WEB_SRC "${CMAKE_SOURCE_DIR}")
set(WEB_DST "$<TARGET_FILE_DIR:Lucy>/app")

add_custom_command(TARGET Lucy POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory "${WEB_DST}"
    COMMAND ${CMAKE_COMMAND} -E copy "${WEB_SRC}/index.html" "${WEB_DST}/index.html"
    COMMAND ${CMAKE_COMMAND} -E copy_directory "${WEB_SRC}/styles"  "${WEB_DST}/styles"
    COMMAND ${CMAKE_COMMAND} -E copy_directory "${WEB_SRC}/scripts" "${WEB_DST}/scripts"
    COMMAND ${CMAKE_COMMAND} -E copy_directory "${WEB_SRC}/data"    "${WEB_DST}/data"
    COMMAND ${CMAKE_COMMAND} -E copy_directory "${WEB_SRC}/assets"  "${WEB_DST}/assets"
    COMMENT "Staging web UI alongside Lucy.exe"
)

# Informational summary
message(STATUS "================ Lucy build config ================")
message(STATUS "  WebView2 SDK : ${WEBVIEW2_ROOT}")
message(STATUS "  Architecture : ${WV2_ARCH}")
message(STATUS "  Output       : $<TARGET_FILE:Lucy>")
message(STATUS "====================================================")
