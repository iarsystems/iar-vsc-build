/*
 * Copyright (c) 1996 - 2016 IAR Systems AB.
 *
 * IAR Embedded Workbench tutorial
 *
 * Fibonacci.c
 *
 * Prints the Fibonacci sequence.
 *
 * See the file <cpuname>/doc/licenses/IARSourceLicense.txt for detailed
 * license information. 
 *
 * $Revision: 113247 $
 */

#include <stdint.h>
#include "Fibonacci.h"

static void NextCounter(void);
static void DoForegroundProcess(void);

static int_fast8_t callCount;


/* Increase the 'callCount' variable by one. */
static void NextCounter(void)
{
  callCount += 1;
}

/* Increase the 'callCount' variable. */
/* Get and print the associated Fibonacci number. */
static void DoForegroundProcess(void)
{
  uint32_t fib;
  NextCounter();
  fib = GetFib(callCount);
  PutFib(fib);
}

/* Main program. */
/* Prints the Fibonacci sequence. */
int32_t main(void)
{
  callCount = 0;

  InitFib();

  while (callCount < MAX_FIB)
  {
    DoForegroundProcess();
  }
  return 0;
}
