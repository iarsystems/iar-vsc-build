#ifndef CONFIG_H_
#define CONFIG_H_

#include <stdint.h>

#include "gpio.h"

uint16_t led_pins[] = {
    GPIO_Pin_0,
    GPIO_Pin_1
};

#endif
