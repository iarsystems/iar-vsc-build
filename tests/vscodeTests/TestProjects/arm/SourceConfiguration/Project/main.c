#include "main.h"
#include "config.h"
#ifdef __ARM_ARCH
#include "intrinsics.h"
#endif

typedef struct {
    union _u {
    // union {
        int a;
    };
} AnonymousMember;

void main()
{
    #ifdef __ARM_ARCH
	__enable_interrupt();
    #endif

    init_leds();

    // VSC-290 (#1) test that ms-style unnamed members are accepted by intellisense
    AnonymousMember str;
    str.a = 1;

    while (1) {}
}

void init_leds()
{
    for (int i = 0; i < sizeof(led_pins)/sizeof(led_pins[0]); i++) {
        init_pin(led_pins[i]);
    }
}
