cmake_minimum_required(VERSION 3.20)
project(CerebrumOS VERSION 0.1.0 LANGUAGES CXX)

# Enforce C++20 strictly
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# FAANG-Level Code Quality Flags
if(MSVC)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /W4 /O2 /arch:AVX2")
else()
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra -Wpedantic -O3 -march=native")
endif()

# Threading Support
set(THREADS_PREFER_PTHREAD_FLAG ON)
find_package(Threads REQUIRED)

# Pybind11 Integration
include(FetchContent)
FetchContent_Declare(
  pybind11
  GIT_REPOSITORY https://github.com/pybind/pybind11.git
  GIT_TAG v2.11.1
)
FetchContent_MakeAvailable(pybind11)

# Core Architecture Library (Header-only for templates and inline lock-free structures)
add_library(cerebrum_core INTERFACE)
target_include_directories(cerebrum_core INTERFACE core_cpp/include)
target_link_libraries(cerebrum_core INTERFACE Threads::Threads)

# Expose C++ Engine to Python
pybind11_add_module(cerebrum_engine core_cpp/src/engine_wrapper.cpp)
target_link_libraries(cerebrum_engine PRIVATE cerebrum_core)

# GoogleTest Integration
enable_testing()
FetchContent_Declare(
  googletest
  GIT_REPOSITORY https://github.com/google/googletest.git
  GIT_TAG release-1.12.1
)
FetchContent_MakeAvailable(googletest)

add_executable(cerebrum_tests tests/cpp/test_cache.cpp)
target_link_libraries(cerebrum_tests PRIVATE cerebrum_core gtest_main)
include(GoogleTest)
gtest_discover_tests(cerebrum_tests)
