/*******************************************************************************
 *      (c) Copyright IAR System 2013
 *
 *      File name   : config.h
 *      Description : Board specific functions and declarations.
 *
 *      History :
 *      1. Date        : 13, September 2013
 *         Author      : Stefan Risberg
 *         Description : Create
 *
 *      $Revision: 39 $
 ******************************************************************************/
#ifndef CONFIG_H_
#define CONFIG_H_

#include <stdint.h>

#define STM32F429II_EXP
//#define STM32L152VB-EXP

#if defined STM32F429II_EXP

#include "stm32f4xx.h"
#include "stm32f4xx_gpio.h"
#include "stm32f4xx_exti.h"
#include "stm32f4xx_tim.h"

/* Led pins. Have to be changed when ported. */
uint16_t led_pins[] = {
    GPIO_Pin_0,
    GPIO_Pin_1
};
/* External interrupt line for the USER button. */
#define LED_RCC_Periph_PORT RCC_AHB1Periph_GPIOE
#define LED_PORT GPIOE

#define USER_BUTTON_EXTI_IRQn EXTI0_IRQn
#define USER_BUTTON_EXTI_LINE EXTI_Line0
#define BUTTON_RCC_Periph_PORT RCC_AHB1Periph_GPIOA
#define USER_BUTTON_PIN GPIO_Pin_0
#define USER_BUTTON_PORT GPIOA
#define USER_BUTTON_EXTI_PORT_SOURCE EXTI_PortSourceGPIOA
#define USER_BUTTON_EXTI_PIN_SOURCE EXTI_PinSource0

#elif defined (STM32L152VB-EXP)

#include "stm32l1xx.h"
#include "stm32l1xx_gpio.h"
#include "stm32l1xx_exti.h"
#include "stm32l1xx_tim.h"

uint16_t led_pins[] = {
    GPIO_PIN_10,
    GPIO_PIN_11
};

/* External interrupt line for the USER button. */
#define LED_RCC_Periph_PORT RCC_AHB1Periph_GPIOE
#define LED_PORT GPIOE

#define USER_BUTTON_EXTI_IRQn EXTI15_10_IRQn
#define USER_BUTTON_EXTI_LINE EXTI_Line15_10
#define BUTTON_RCC_Periph_PORT RCC_AHB1Periph_GPIOA
#define USER_BUTTON_PIN GPIO_Pin_13
#define USER_BUTTON_PORT GPIOC
#define USER_BUTTON_EXTI_PORT_SOURCE EXTI_PortSourceGPIOC
#define USER_BUTTON_EXTI_PIN_SOURCE EXTI_PinSource13

#endif

#endif
