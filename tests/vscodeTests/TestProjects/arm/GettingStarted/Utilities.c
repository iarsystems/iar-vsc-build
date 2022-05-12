/*
 * Copyright (c) 1996 - 2016 IAR Systems AB.
 *
 * IAR Embedded Workbench tutorial
 *
 * Utilities.c
 *
 * Contains utility functions used in Fibonacci.c.
 *
 * See the file <cpuname>/doc/licenses/IARSourceLicense.txt for detailed
 * license information. 
 *
 * $Revision: 113247 $
 */

#include <stdint.h>
#include <stdio.h>
#include "Utilities.h"

static uint32_t Fib[MAX_FIB];

/* Initializes MAX_FIB Fibonacci numbers. */
void InitFib(void)
{
  int_fast8_t i;
  Fib[0] = Fib[1] = 1u;

  for (i = 2; i < MAX_FIB; i++)
  {
    Fib[i] = GetFib(i) + GetFib(i-1);
  }
}

/* Returns the Fibonacci number 'n'. */
uint32_t GetFib(int_fast8_t n)
{
  uint32_t retval;
  if ((n > 0) && (n <= MAX_FIB))
  {
    retval = Fib[n-1];
  }
  else
  {
    retval = 0u;
  }
  return retval;
}

/* Sends a number between 0 and 65535 to stdout. */
void PutFib(uint32_t out)
{
  uint32_t dec = 10u, temp;

  if (out >= 10000u)  /* Value too large. */
  {
    putchar('#');    /* Print a '#'. */
  }
  else
  {
    putchar('\n');
    while (dec <= out)
    {
      dec *= 10u;
    }

    while ((dec /= 10u) >= 10u)
    {
      temp = out / dec;
      putchar('0' + (char)temp);
      out -= temp * dec;
    }     

    putchar('0' + (char)out);
  }
}
