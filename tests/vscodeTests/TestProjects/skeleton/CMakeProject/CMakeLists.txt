# CMake requires to set its minimum required version
cmake_minimum_required(VERSION 3.23)

set(CMAKE_SYSTEM_NAME Generic)

set(CMAKE_CONFIGURATION_TYPES Debug RelWithDebInfo)

project(SimpleProject LANGUAGES C)

add_executable(SimpleProject main.c)

# Set the target's compiler options
target_compile_options(SimpleProject PRIVATE -D_MYDEFINE=42)
