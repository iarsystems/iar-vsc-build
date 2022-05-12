/*
 * Copyright (c) 1996 - 2016 IAR Systems AB.
 *
 * IAR Embedded Workbench tutorial
 *
 * Utilities.h
 *
 * Utility header file for Utilities.c.
 *
 * See the file <cpuname>/doc/licenses/IARSourceLicense.txt for detailed
 * license information. 
 *
 * $Revision: 113247 $
 */

#ifndef UTILITIES_H
#define UTILITIES_H

#include <stdint.h>

#define MAX_FIB 10
void InitFib(void);
uint32_t GetFib(int_fast8_t n);
void PutFib(uint32_t out);

#endif
