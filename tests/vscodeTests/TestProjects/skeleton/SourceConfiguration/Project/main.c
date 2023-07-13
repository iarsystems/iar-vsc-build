#include "main.h"
#include "config.h"
#include <intrinsics.h>

// VSC-353 Test that gcc-style attributes are ignored
int deprecated __attribute__ ((deprecated));

void main()
{
	__enable_interrupt();

    init_leds();

    // VSC-358 Test that inline assembly is accepted
    __asm("nop");

    // VSC-353 Test that the __section_begin intrinsic returns void*
    void* stack_start = __section_begin("CSTACK");

    while (1) {}
}

void init_leds()
{
    for (int i = 0; i < sizeof(led_pins)/sizeof(led_pins[0]); i++) {
        init_pin(led_pins[i]);
    }
}
