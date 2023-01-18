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

// VSC-353 Test that gcc-style attributes are ignored
int deprecated __attribute__ ((deprecated));

void main()
{
    #ifdef __ARM_ARCH
	__enable_interrupt();
    #endif

    init_leds();

    // VSC-290 (#1) test that ms-style unnamed members are accepted by intellisense
    AnonymousMember str;
    str.a = 1;

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
