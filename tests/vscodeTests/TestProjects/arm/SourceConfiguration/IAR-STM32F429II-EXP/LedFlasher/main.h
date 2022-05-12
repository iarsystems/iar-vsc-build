/*******************************************************************************
 *      (c) Copyright IAR System 2013
 *
 *      File name   : main.h
 *      Description : Type and function declarations.
 *
 *      History :
 *      1. Date        : 9, July 2013
 *         Author      : Stefan Risberg
 *         Description : Create
 *      2. Date        : 13, September 2013
 *         Author      : Stefan Risberg
 *         Description : Made code easier for fast port to other chip
 *                       configurations.
 *
 *      $Revision: 39 $
 ******************************************************************************/

#ifndef MAIN_H_
#define MAIN_H_

#include <stdint.h>

#include "config.h"

/*******************************************************************************
 ** Enum name   : led_t
 **
 ** Description : All leds.
 ******************************************************************************/
typedef enum {
	LED1 = 0,
	LED2 = 1
} led_t;

void init_led(led_t led);
void init_button();

void enable_button();
void enable_timer(TIM_TypeDef * timer,
                  uint32_t enable_reg,
                  uint16_t prescaler,
                  uint32_t period);
void enable_interrupt(IRQn_Type interrupt,
                      uint8_t preemption_prio,
                      uint8_t sub_prio);

void tim2_interrupt_handler();
void USER_button_interrupt_handler();
void led_on(led_t led);
void led_off(led_t led);
void led_toggle(led_t led);

#endif
